/** Motor determinístico de uma linha de produção do Reino.

    Motor cíclico (produção em batelada por ciclo) com um TETO finito de
    geradores. Cada linha é uma cadeia independente: estado = função pura do
    nº de passos fixos, ancorado no próprio startedAt da linha, então duas
    máquinas com o mesmo save produzem a MESMA sequência de contas —
    requisito para ranking justo bit a bit. */

import Decimal from 'break_eternity.js';
import type { LineId } from './lines';
import { mandateBalance, mandateCostOf, spendMandate, type MandatePurchaseLog, type MandateState } from './mandate';
import {
  applyBonusOutput,
  bonusAmountFraction,
  bonusChance,
  bonusRoll,
  bonusTriggers,
  cycleSpeedFactor,
  discountedGenCost,
  emptyUpgrades,
  productionFactor,
  type UpgradeState,
} from './upgrades';

export { SIM_STEP_S } from './sim';
import { SIM_STEP_S } from './sim';

/** Parâmetros econômicos de UMA cadeia. Cada linha de produção tem os seus:
    ritmo de ciclo, entrega E curva de preços-base — só o encarecimento por
    compra repetida (BUY_GROWTH) é compartilhado por todas.
    A produção é DESACOPLADA do tempo e cresce de forma ARITMÉTICA (+prodStep
    por nível); o ciclo cresce de forma GEOMÉTRICA (×cycleGrowth por nível), então
    a taxa por segundo despenca nos geradores mais fundos (ciclos longos, entrega
    modesta). Economia propositalmente lenta e finita. */
export interface LineEconomy {
  /** Ciclo do gerador 1, em segundos. */
  cycleBaseS: number;
  /** Fator geométrico do ciclo entre um gerador e o seguinte. */
  cycleGrowth: number;
  /** Entrega por ciclo do gerador 1, por unidade. */
  prodBase: number;
  /** Incremento aritmético de entrega a cada gerador. */
  prodStep: number;
  /** Inclinação do expoente da curva de custo: 10^(slope·i + curve·i²).
      Em i=0 dá 10^0 = 1, então o 1º gerador de TODA linha custa 1 e a cadeia
      sempre arranca com a base inicial. */
  costSlope: number;
  /** Termo quadrático do expoente — o quão mais íngreme a escada fica no fundo. */
  costCurve: number;
}

/** Teto de passos por frame no catch-up. */
export const MAX_STEPS_PER_FRAME = 2_000;
/** Encarecimento por unidade repetida do MESMO gerador: +10% por compra,
    fixo e universal (todas as linhas, todos os geradores). Empilhar continua
    viável em qualquer profundidade; o peso das linhas fundas está nos
    preços-base (costSlope/costCurve de cada linha). */
export const BUY_GROWTH = 1.1;
const START_BASE = new Decimal(1);

export type Mode = 'manual' | 'auto';

export interface Gen {
  /** Total possuído (comprados + produzidos pelo gerador seguinte). */
  amount: Decimal;
  /** Unidades compradas manualmente — só elas encarecem o custo. */
  bought: number;
  /** Tempo de jogo (s) em que a primeira unidade foi comprada. */
  unlockedAt?: number;
  /** Passos já cumpridos do ciclo atual. */
  cycleStep: number;
}

export interface Line {
  base: Decimal;
  /** Total de base já produzido na vida da linha (compras não descontam). */
  totalProduced: Decimal;
  gens: Gen[];
  mode: Mode;
  /** false = ainda na tela de escolha de modo. */
  started: boolean;
  /** Date.now() do clique em Iniciar — âncora da simulação da linha. */
  startedAt?: number;
  /** Passos fixos executados desde o início. */
  steps: number;
  /** Tempo de jogo (s), conta a partir da 1ª compra do Gerador 1. */
  uptime: number;
}

/** Forma serializada (Decimals viram string; nada de float não-determinístico). */
export interface LineSave {
  base: string;
  totalProduced: string;
  gens: { amount: string; bought: number; unlockedAt?: number; cycleStep: number }[];
  mode: Mode;
  started: boolean;
  startedAt?: number;
  steps: number;
  uptime: number;
}

/** Duração do ciclo do gerador de índice i, em segundos (crescimento geométrico). */
export const cycleSecondsOf = (i: number, eco: LineEconomy): number =>
  eco.cycleBaseS * Math.pow(eco.cycleGrowth, i);
/** Duração do ciclo em passos de simulação. */
export const cycleStepsOf = (i: number, eco: LineEconomy): number =>
  cycleSecondsOf(i, eco) / SIM_STEP_S;
/** Entrega por unidade ao completar o ciclo (curva própria, independente do
    tempo de ciclo): prodBase + prodStep·i. */
export const prodPerCycleOf = (i: number, eco: LineEconomy): Decimal =>
  new Decimal(eco.prodBase).add(new Decimal(eco.prodStep).mul(i));
/** Taxa média por unidade do gerador i, por segundo (entrega/ciclo ÷ duração).
    Cai a cada nível, já que o ciclo cresce mais rápido que a entrega. */
export const ratePerSecOf = (i: number, eco: LineEconomy): Decimal =>
  prodPerCycleOf(i, eco).div(cycleSecondsOf(i, eco));

/** Custo do gerador N (índice i) na próxima compra: custo-base da linha ×
    1.10^comprados. O round() arredonda só o CUSTO-BASE (deixa 1, 40, 2000…
    limpos e corrige o pow do break_eternity); o +10% é aplicado por cima SEM
    arredondar, então as repetições ficam fracionárias (ex.: 1.10, 1.21) e o
    aumento por compra aparece de verdade, inclusive nas casas decimais. */
export const costOf = (i: number, bought: number, eco: LineEconomy): Decimal =>
  Decimal.pow(10, eco.costSlope * i + eco.costCurve * i * i)
    .round()
    .mul(Decimal.pow(BUY_GROWTH, bought));

/** Custo efetivo da próxima compra do gerador i (com desconto de pesquisas). */
export const genPurchaseCost = (
  i: number,
  bought: number,
  eco: LineEconomy,
  lineId: LineId,
  upgrades: UpgradeState = emptyUpgrades()
): Decimal =>
  discountedGenCost(costOf(i, bought, eco), upgrades, lineId, i);

export const newGen = (): Gen => ({ amount: new Decimal(0), bought: 0, cycleStep: 0 });

export const newLine = (): Line => ({
  base: START_BASE,
  totalProduced: new Decimal(0),
  gens: [newGen()],
  mode: 'manual',
  started: false,
  steps: 0,
  uptime: 0,
});

export function loadLine(s: LineSave | undefined): Line {
  if (!s || !s.gens || s.gens.length === 0) return newLine();
  return {
    base: new Decimal(s.base),
    totalProduced: new Decimal(s.totalProduced ?? s.base),
    gens: s.gens.map((g) => ({
      amount: new Decimal(g.amount),
      bought: g.bought,
      unlockedAt: g.unlockedAt,
      cycleStep: g.cycleStep ?? 0,
    })),
    mode: s.mode ?? 'manual',
    started: s.started ?? false,
    startedAt: s.startedAt,
    steps: s.steps ?? 0,
    uptime: s.uptime ?? 0,
  };
}

export function serializeLine(g: Line): LineSave {
  return {
    base: g.base.toString(),
    totalProduced: g.totalProduced.toString(),
    gens: g.gens.map((x) => ({
      amount: x.amount.toString(),
      bought: x.bought,
      unlockedAt: x.unlockedAt,
      cycleStep: x.cycleStep,
    })),
    mode: g.mode,
    started: g.started,
    startedAt: g.startedAt,
    steps: g.steps,
    uptime: g.uptime,
  };
}

/** Estado de trabalho de uma linha dentro do avanço step-major do reino. */
interface WorkLine {
  id: LineId;
  genCap: number;
  eco: LineEconomy;
  mode: Mode;
  mCost: number;
  startSteps: number;
  src: Line;
  gens: Gen[];
  base: Decimal;
  totalProduced: Decimal;
  uptime: number;
}

/** Um passo de produção de UMA linha (ciclos + entrega). Muta o WorkLine.
    O cycleStep acumula a VELOCIDADE do ciclo por passo (1×, 1.21×, …) contra
    a duração-base em passos, carregando o resto entre ciclos. Antes ele subia
    +1 contra uma meta fracionária (base ÷ fator) e só entregava ao cruzar o
    próximo passo inteiro: o excedente era descartado (todo ciclo pagava até
    ~1 passo de pedágio) e a barra da UI batia em 100% e pausava esperando a
    entrega. Acumular também permite >1 ciclo por passo em níveis altos. */
function stepProduction(w: WorkLine, s: number, upgrades: UpgradeState): void {
  if (w.gens[0].bought > 0) w.uptime += SIM_STEP_S;

  // Do topo da cadeia para a base: cada gerador cumpre seu ciclo e, ao
  // completar, entrega o lote inteiro ao nível de baixo de uma vez.
  for (let i = w.gens.length - 1; i >= 0; i--) {
    const gen = w.gens[i];
    if (gen.amount.lte(0)) continue;

    gen.cycleStep += cycleSpeedFactor(
      upgrades,
      w.id,
      i,
      cycleSecondsOf(i, w.eco)
    );
    const need = cycleStepsOf(i, w.eco);
    if (gen.cycleStep >= need) {
      const cycles = Math.floor(gen.cycleStep / need);
      gen.cycleStep -= cycles * need;
      let out = gen.amount
        .mul(prodPerCycleOf(i, w.eco))
        .mul(productionFactor(upgrades, w.id, i))
        .mul(cycles);
      const chance = bonusChance(upgrades, w.id, i);
      if (
        chance > 0 &&
        bonusTriggers(chance, bonusRoll(w.startSteps + s, w.id, i))
      ) {
        out = applyBonusOutput(out, bonusAmountFraction(upgrades, w.id, i));
      }
      if (i === 0) {
        w.base = w.base.add(out);
        w.totalProduced = w.totalProduced.add(out);
      } else {
        w.gens[i - 1].amount = w.gens[i - 1].amount.add(out);
      }
    }
  }
}

/** Tentativa de compra do modo automático (estrito): só desbloqueia o PRÓXIMO
    bloqueado ou empilha o MAIS ALTO já desbloqueado — nunca níveis abaixo.
    Prioriza desbloquear o próximo; com a cadeia no teto, empilha o último. */
function stepAutoBuy(
  w: WorkLine,
  earnedSteps: number,
  upgrades: UpgradeState,
  m: MandateState,
  mandatePurchases: readonly MandatePurchaseLog[]
): MandateState {
  const last = w.gens.length - 1;
  const lastLocked = w.gens[last].bought === 0;
  const candidates = lastLocked ? [last, last - 1] : [last];
  for (const i of candidates) {
    if (i < 0) continue;
    const cost = genPurchaseCost(i, w.gens[i].bought, w.eco, w.id, upgrades);
    if (w.base.lt(cost) || mandateBalance(earnedSteps, m.spent, mandatePurchases) < w.mCost) continue;
    const wasLocked = w.gens[i].bought === 0;
    w.base = w.base.sub(cost);
    m = spendMandate(m, w.mCost, earnedSteps, mandatePurchases)!;
    w.gens[i].bought += 1;
    w.gens[i].amount = w.gens[i].amount.add(1);
    if (wasLocked) {
      w.gens[i].unlockedAt = w.uptime;
      if (i === last && w.gens.length < w.genCap) w.gens.push(newGen());
    }
    return m;
  }
  return m;
}

/** Executa nSteps passos fixos em TODAS as linhas, step-major: a cada passo
    global, cada linha (em ordem fixa) produz e tenta o auto-buy. Assim o
    mandato — recurso COMPARTILHADO — é ganho e disputado passo a passo,
    independente do tamanho dos lotes por frame (FPS não muda o resultado).
    Função pura e determinística. */
export function advanceKingdom(
  lines: Partial<Record<LineId, Line>>,
  defs: readonly { id: LineId; genCount: number; eco: LineEconomy }[],
  nSteps: number,
  upgrades: UpgradeState = emptyUpgrades(),
  mandate: MandateState = { spent: 0 },
  mandatePurchases: readonly MandatePurchaseLog[] = []
): { lines: Partial<Record<LineId, Line>>; mandate: MandateState } {
  if (nSteps <= 0) return { lines, mandate };

  const work: WorkLine[] = [];
  for (const d of defs) {
    const l = lines[d.id];
    if (!l?.started) continue;
    work.push({
      id: d.id,
      genCap: d.genCount,
      eco: d.eco,
      mode: l.mode,
      mCost: mandateCostOf(d.id),
      startSteps: l.steps,
      src: l,
      gens: l.gens.map((x) => ({ ...x })),
      base: l.base,
      totalProduced: l.totalProduced,
      uptime: l.uptime,
    });
  }
  let m = mandate;

  for (let s = 0; s < nSteps; s++) {
    for (const w of work) {
      stepProduction(w, s, upgrades);
      if (w.mode === 'auto') {
        // Mandato ganho até ESTE passo global — nunca o lote inteiro.
        m = stepAutoBuy(w, w.startSteps + s + 1, upgrades, m, mandatePurchases);
      }
    }
  }

  const out: Partial<Record<LineId, Line>> = { ...lines };
  for (const w of work) {
    out[w.id] = {
      ...w.src,
      base: w.base,
      totalProduced: w.totalProduced,
      gens: w.gens,
      uptime: w.uptime,
      steps: w.startSteps + nSteps,
    };
  }
  return { lines: out, mandate: m };
}

/** Compra manual de 1 unidade do gerador i (respeitando o teto). Pura. */
export function buyGen(
  line: Line,
  i: number,
  genCap: number,
  eco: LineEconomy,
  lineId: LineId,
  upgrades: UpgradeState = emptyUpgrades(),
  mandate: MandateState = { spent: 0 },
  mandatePurchases: readonly MandatePurchaseLog[] = []
): { line: Line; mandate: MandateState } {
  const cost = genPurchaseCost(i, line.gens[i].bought, eco, lineId, upgrades);
  const mCost = mandateCostOf(lineId);
  const nextM = spendMandate(mandate, mCost, line.steps, mandatePurchases);
  if (line.base.lt(cost) || !nextM) return { line, mandate };

  const gens = line.gens.map((x) => ({ ...x }));
  gens[i].bought += 1;
  gens[i].amount = gens[i].amount.add(1);
  if (gens[i].bought === 1) gens[i].unlockedAt = line.uptime;
  // Primeira compra do último gerador desbloqueia o próximo, até o teto.
  if (i === gens.length - 1 && gens.length < genCap) gens.push(newGen());

  return {
    line: { ...line, base: line.base.sub(cost), gens },
    mandate: nextM,
  };
}
