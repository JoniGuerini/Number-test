/** Tuning das linhas de produção do Reino — roda O MOTOR REAL (src/game/).
    Não existe mais espelho para manter em dia: qualquer mudança no engine
    reflete aqui na hora, e a prova de reprodutibilidade bit a bit são os
    testes (src/game/engine.test.ts).

    Simula cada linha ISOLADA no modo automático estrito do jogo (desbloqueia
    o próximo gerador ou empilha o mais alto desbloqueado), com o mandato
    ganho pelos passos da própria linha. Uso:
      npm run sim */

import Decimal from 'break_eternity.js';
import {
  BUY_GROWTH,
  SIM_STEP_S,
  advanceKingdom,
  costOf,
  newLine,
  type Line,
} from '../src/game/engine';
import { ENABLED_LINES, type LineDef, type LineId } from '../src/game/lines';
import { emptyUpgrades } from '../src/game/upgrades';

const HORIZON_S = 72 * 3600; // 72h de jogo simulado
const CHUNK_STEPS = 50_000; // lote por chamada (invariância provada por teste)

/** Tempos de desbloqueio (uptime, em s) da linha rodando isolada em auto. */
function unlockPace(def: LineDef): number[] {
  const fresh = newLine();
  fresh.started = true;
  fresh.startedAt = 0;
  fresh.mode = 'auto';

  let lines: Partial<Record<LineId, Line>> = { [def.id]: fresh };
  let mandate = { spent: 0 };
  const total = Math.floor(HORIZON_S / SIM_STEP_S);

  for (let done = 0; done < total; done += CHUNK_STEPS) {
    const r = advanceKingdom(
      lines,
      [def],
      Math.min(CHUNK_STEPS, total - done),
      emptyUpgrades(),
      mandate,
      []
    );
    lines = r.lines;
    mandate = r.mandate;
    const l = lines[def.id]!;
    // Cadeia completa: os 20 desbloqueados — nada mais a medir.
    if (l.gens.length === def.genCount && l.gens[def.genCount - 1].bought > 0) {
      break;
    }
  }

  return lines[def.id]!.gens
    .filter((g) => g.unlockedAt !== undefined)
    .map((g) => g.unlockedAt!);
}

// ===== Formatadores =====
const fmt = (s: number | undefined): string =>
  s == null
    ? '—'
    : s >= 86400
      ? `${(s / 86400).toFixed(1)}d`
      : s >= 3600
        ? `${(s / 3600).toFixed(1)}h`
        : s >= 60
          ? `${(s / 60).toFixed(1)}m`
          : `${s.toFixed(0)}s`;

// Formatador de número curto (K, M, B…) só para a tabela de custos.
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
function n(dec: Decimal): string {
  if (dec.lt(1000)) return Math.round(dec.toNumber()).toString();
  const exp = Math.floor(dec.log10().toNumber());
  const tier = Math.floor(exp / 3);
  const scaled = dec.div(Decimal.pow(10, tier * 3)).toNumber();
  return (
    (scaled < 100 ? scaled.toFixed(1) : Math.floor(scaled).toString()) +
    (SUF[tier] ?? 'e' + tier * 3)
  );
}

// ===== Custos + ritmo de desbloqueio em 72h, por linha =====
const rep = (k: number) => Decimal.pow(BUY_GROWTH, k - 1).toNumber().toFixed(1);
console.log('\n=== Compra repetida (+10% fixo, todas as linhas) ===');
console.log(
  `  10ª unidade = ×${rep(10)} do custo-base  ·  25ª = ×${rep(25)}  ·  50ª = ×${rep(50)}`
);

for (const def of ENABLED_LINES) {
  const eco = def.eco;
  console.log(
    `\n### Linha: ${def.id}  (ciclo ${eco.cycleBaseS}s ×${eco.cycleGrowth}, prod ${eco.prodBase} +${eco.prodStep}, custo universal)`
  );
  const costs: string[] = [];
  for (let i = 0; i < def.genCount; i++) {
    costs.push(`g${i + 1}=${n(costOf(i, 0, eco))}`);
  }
  console.log(`  Custo da 1ª compra: ${costs.join('  ')}`);

  const u = unlockPace(def);
  console.log(
    `  Ritmo no automático (estrito, igual ao jogo): chegou a g${u.length} em ${fmt(u[u.length - 1])}`
  );
  console.log(`    ${u.map((t, i) => `g${i + 1}:${fmt(t)}`).join('  ')}`);
}
