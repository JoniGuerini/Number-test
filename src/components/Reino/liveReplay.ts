/** Réplica ao vivo do motor para os contadores a 60fps.

    O motor commita 4x/s (passo de 0,25s); entre commits, os elementos "ao
    vivo" REPRODUZEM as contas do motor (velocidade acumulada, resto
    carregado, bônus determinístico) a partir do estado commitado e escrevem
    direto no DOM. SÓ LEITURA: nada aqui escreve de volta no estado — o bit a
    bit do save fica intacto (a fronteira do determinismo é o motor). */

import Decimal from 'break_eternity.js';
import {
  SIM_STEP_S,
  cycleSecondsOf,
  cycleStepsOf,
  prodPerCycleOf,
  type Gen,
  type Line,
  type LineEconomy,
} from '../../game/engine';
import type { LineId } from '../../game/lines';
import {
  applyBonusOutput,
  bonusAmountFraction,
  bonusChance,
  bonusRoll,
  bonusTriggers,
  cycleSecondsWithUpgrades,
  cycleSpeedFactor,
  productionFactor,
  type UpgradeState,
} from '../../game/upgrades';

/** Ciclo efetivo abaixo disto = produção contínua: a barra fica cheia e
    parada em vez de varrer várias vezes por segundo (vira um estrobo). Os
    contadores ao vivo usam o mesmo limiar para interpolar as entregas DENTRO
    do passo de simulação (o número gira no ritmo real do ciclo). */
export const STEADY_CYCLE_S = 1;

/** Snapshot por commit que os loops de rAF leem (nada de closure de render). */
export interface LiveSnap {
  lineId: LineId;
  gens: Gen[];
  /** Duração-base do ciclo de cada gerador, em passos. */
  needs: number[];
  /** Fator de velocidade (melhorias) acumulado por passo. */
  speeds: number[];
  /** Ciclo efetivo < 1s → interpola entregas dentro do passo corrente. */
  steady: boolean[];
  /** Entrega por ciclo de cada gerador (amount × entrega × fator). */
  outs: Decimal[];
  chances: number[];
  fracs: number[];
  started: boolean;
  anchorStartedAt: number | undefined;
  anchorSteps: number;
}

export function buildLiveSnap(
  line: Line,
  lineId: LineId,
  eco: LineEconomy,
  upgrades: UpgradeState,
  anchorStartedAt: number | undefined,
  anchorSteps: number
): LiveSnap {
  return {
    lineId,
    gens: line.gens,
    needs: line.gens.map((_, i) => cycleStepsOf(i, eco)),
    speeds: line.gens.map((_, i) =>
      cycleSpeedFactor(upgrades, lineId, i, cycleSecondsOf(i, eco))
    ),
    steady: line.gens.map(
      (_, i) =>
        cycleSecondsWithUpgrades(cycleSecondsOf(i, eco), upgrades, lineId, i) <
        STEADY_CYCLE_S
    ),
    outs: line.gens.map((gen, i) =>
      gen.amount
        .mul(prodPerCycleOf(i, eco))
        .mul(productionFactor(upgrades, lineId, i))
    ),
    chances: line.gens.map((_, i) => bonusChance(upgrades, lineId, i)),
    fracs: line.gens.map((_, i) => bonusAmountFraction(upgrades, lineId, i)),
    started: line.started,
    anchorStartedAt,
    anchorSteps,
  };
}

/** Janela desde o commit: `t` em passos (contínuo) e os passos inteiros a
    reproduzir (teto de 256 — mais que isso é catch-up, não interpolação). */
export function liveWindow(snap: LiveSnap): { t: number; replaySteps: number } {
  if (!snap.started || snap.anchorStartedAt === undefined) {
    return { t: 0, replaySteps: 0 };
  }
  const t = Math.max(
    (Date.now() - snap.anchorStartedAt) / 1000 / SIM_STEP_S - snap.anchorSteps,
    0
  );
  return { t, replaySteps: Math.min(Math.floor(t), 256) };
}

/** Soma que o gerador `u` entregou desde o commit: passos inteiros
    decorridos e, se o gerador é rápido (steady), também os ciclos
    completados DENTRO do passo corrente — para o número girar no ritmo real
    e não no teto de 0,25s do passo. Na fronteira do passo a conta fecha
    exata com a do motor. */
export function replayDelivered(
  a: LiveSnap,
  u: number,
  replaySteps: number,
  t: number
): Decimal {
  let sum = new Decimal(0);
  const up = a.gens[u];
  if (!up || up.amount.lte(0)) return sum;

  const n = a.needs[u];
  const v = a.speeds[u];
  let cc = up.cycleStep;
  for (let s = 1; s <= replaySteps; s++) {
    cc += v;
    if (cc >= n) {
      const cycles = Math.floor(cc / n);
      cc -= cycles * n;
      let out = a.outs[u].mul(cycles);
      if (
        a.chances[u] > 0 &&
        bonusTriggers(
          a.chances[u],
          bonusRoll(a.anchorSteps + s - 1, a.lineId, u)
        )
      ) {
        out = applyBonusOutput(out, a.fracs[u]);
      }
      sum = sum.add(out);
    }
  }
  if (a.steady[u]) {
    const fraction = Math.min(Math.max(t - replaySteps, 0), 1);
    const crossed = Math.floor((cc + v * fraction) / n);
    if (crossed > 0) {
      let out = a.outs[u].mul(crossed);
      if (
        a.chances[u] > 0 &&
        bonusTriggers(
          a.chances[u],
          bonusRoll(a.anchorSteps + replaySteps, a.lineId, u)
        )
      ) {
        out = applyBonusOutput(out, a.fracs[u]);
      }
      sum = sum.add(out);
    }
  }
  return sum;
}
