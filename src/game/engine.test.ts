/** Provas do pilar do projeto: a simulação do Reino é determinística bit a
    bit (estado = função pura do número de passos).

    - Golden master: cenário fixo → snapshot do save serializado. Qualquer
      mudança no resultado das contas (intencional ou não) falha aqui. Ao
      rebalancear a economia DE PROPÓSITO, atualize o snapshot (vitest -u) e
      diga no commit.
    - Invariância de lote: avançar N passos de uma vez == em lotes de
      tamanhos arbitrários — é a propriedade que sustenta o catch-up offline
      (FPS/tamanho de frame não podem mudar o resultado).
    - Round-trip do save: serializar e recarregar preserva o estado.
    - Equivalência da réplica: os contadores ao vivo (liveReplay) preveem
      EXATAMENTE as entregas que o motor credita na mesma janela. */

import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import {
  advanceKingdom,
  loadLine,
  newGen,
  newLine,
  serializeLine,
  type Line,
} from './engine';
import { ENABLED_LINES, lineDefOf, type LineId } from './lines';
import { emptyUpgrades, type UpgradeState } from './upgrades';
import { buildLiveSnap, replayValue } from '../components/Reino/liveReplay';

type Lines = Partial<Record<LineId, Line>>;

/** As cinco linhas iniciadas no passo 0 (âncora global), sem compras. */
function startedLines(mode: 'manual' | 'auto'): Lines {
  const lines: Lines = {};
  for (const def of ENABLED_LINES) {
    const l = newLine();
    l.started = true;
    l.startedAt = 0;
    l.mode = mode;
    lines[def.id] = l;
  }
  return lines;
}

/** Melhorias com níveis variados — cobre ciclo composto no piso de 0,1s
    (várias entregas por passo), produção, bônus (chance 50% dispara muito)
    e desconto de preço. */
function testUpgrades(): UpgradeState {
  return {
    global: { cycle: 1, production: 2, bonus: 3, bonusAmount: 1, cost: 1 },
    gen: {
      'comida:0:cycle': 30,
      'comida:0:production': 3,
      'comida:0:bonus': 47,
      'comida:0:bonusAmount': 5,
      'mineracao:0:cycle': 4,
    },
  };
}

const serializeAll = (lines: Lines): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const def of ENABLED_LINES) {
    out[def.id] = serializeLine(lines[def.id]!);
  }
  return out;
};

describe('determinismo do motor', () => {
  it('golden master: 6h de jogo em modo automático, bit a bit', () => {
    const STEPS = 6 * 3600 * 4; // 6h de jogo, passo de 0,25s
    const result = advanceKingdom(
      startedLines('auto'),
      ENABLED_LINES,
      STEPS,
      testUpgrades(),
      { spent: 0 },
      []
    );

    // Sanidade antes do snapshot: a economia andou de verdade.
    const comida = result.lines.comida!;
    expect(comida.steps).toBe(STEPS);
    expect(comida.gens[0].bought).toBeGreaterThan(0);
    expect(comida.base.gt(0)).toBe(true);
    expect(result.mandate.spent).toBeGreaterThan(0);

    expect({
      lines: serializeAll(result.lines),
      mandateSpent: result.mandate.spent,
    }).toMatchSnapshot();
  });

  it('invariância de lote: N passos de uma vez == lotes arbitrários', () => {
    const TOTAL = 20_000;
    const upgrades = testUpgrades();

    const oneShot = advanceKingdom(
      startedLines('auto'),
      ENABLED_LINES,
      TOTAL,
      upgrades,
      { spent: 0 },
      []
    );

    // Lotes irregulares (inclusive de 1 passo e do teto do catch-up)
    const chunks = [1, 7, 250, 1999, 2000, 43, 999, 3];
    let lines = startedLines('auto');
    let mandate = { spent: 0 };
    let done = 0;
    for (let i = 0; done < TOTAL; i++) {
      const todo = Math.min(chunks[i % chunks.length], TOTAL - done);
      const r = advanceKingdom(lines, ENABLED_LINES, todo, upgrades, mandate, []);
      lines = r.lines;
      mandate = r.mandate;
      done += todo;
    }

    expect(serializeAll(lines)).toEqual(serializeAll(oneShot.lines));
    expect(mandate.spent).toBe(oneShot.mandate.spent);
  });

  it('round-trip do save: serializar e recarregar preserva o estado', () => {
    const advanced = advanceKingdom(
      startedLines('auto'),
      ENABLED_LINES,
      5_000,
      testUpgrades(),
      { spent: 0 },
      []
    );
    for (const def of ENABLED_LINES) {
      const line = advanced.lines[def.id]!;
      const reloaded = loadLine(serializeLine(line));
      expect(serializeLine(reloaded)).toEqual(serializeLine(line));
    }
  });
});

describe('equivalência da réplica ao vivo (liveReplay)', () => {
  /** Linha só com o gerador 1 (nada o alimenta): a réplica do recurso base
      tem que ser EXATA em qualquer fronteira de passo — inclusive com o
      ciclo no piso de 0,1s (2,5 ciclos por passo) e bônus frequente. */
  it('recurso base: réplica == motor em toda fronteira de passo', () => {
    const def = lineDefOf('comida');
    const upgrades = testUpgrades();

    const fresh = newLine();
    fresh.started = true;
    fresh.startedAt = 0;
    fresh.gens[0].bought = 1;
    fresh.gens[0].amount = new Decimal(3);

    // Aquecimento com passo primo: cycleStep committed fica no meio do ciclo
    const warm = advanceKingdom(
      { comida: fresh },
      [def],
      137,
      upgrades,
      { spent: 0 },
      []
    );
    const committed = warm.lines.comida!;

    const snap = buildLiveSnap(
      committed,
      'comida',
      def.eco,
      upgrades,
      0,
      committed.steps
    );
    for (const k of [1, 2, 3, 5, 8, 13, 21, 50, 128, 200]) {
      const engineK = advanceKingdom(
        { comida: committed },
        [def],
        k,
        upgrades,
        { spent: 0 },
        []
      ).lines.comida!;
      const predicted = replayValue(snap, 0, k, k, committed.base);
      expect(predicted.toString()).toBe(engineK.base.toString());
    }
  });

  /** Cadeia de dois geradores: a quantidade ao vivo do gerador 1 (committed
      + entregas do gerador 2) tem que bater com o motor. Sem melhorias —
      ciclo lento do g2 (6s), entregas esparsas dentro da janela. */
  it('quantidade do gerador: réplica == motor em toda fronteira de passo', () => {
    const def = lineDefOf('comida');
    const upgrades = emptyUpgrades();

    const fresh = newLine();
    fresh.started = true;
    fresh.startedAt = 0;
    fresh.gens[0].bought = 1;
    fresh.gens[0].amount = new Decimal(2);
    fresh.gens.push(newGen());
    fresh.gens[1].bought = 1;
    fresh.gens[1].amount = new Decimal(5);

    const warm = advanceKingdom(
      { comida: fresh },
      [def],
      101,
      upgrades,
      { spent: 0 },
      []
    );
    const committed = warm.lines.comida!;

    const snap = buildLiveSnap(
      committed,
      'comida',
      def.eco,
      upgrades,
      0,
      committed.steps
    );
    for (const k of [1, 4, 11, 24, 25, 48, 96, 200]) {
      const engineK = advanceKingdom(
        { comida: committed },
        [def],
        k,
        upgrades,
        { spent: 0 },
        []
      ).lines.comida!;
      const predicted = replayValue(snap, 1, k, k, committed.gens[0].amount);
      expect(predicted.toString()).toBe(engineK.gens[0].amount.toString());
    }
  });
});
