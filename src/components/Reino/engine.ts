/** Motor determinístico de uma linha de produção do Reino.

    Motor cíclico (produção em batelada por ciclo) com um TETO finito de
    geradores. Cada linha é uma cadeia independente: estado = função pura do
    nº de passos fixos, ancorado no próprio startedAt da linha, então duas
    máquinas com o mesmo save produzem a MESMA sequência de contas —
    requisito para ranking justo bit a bit. */

import Decimal from 'break_eternity.js';

/** Timestep fixo da simulação determinística. */
export const SIM_STEP_S = 0.25;

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
    1.10^comprados. O round() arredonda só o CUSTO-BASE (deixa 1, 25, 759…
    limpos e corrige o pow do break_eternity); o +10% é aplicado por cima SEM
    arredondar, então as repetições ficam fracionárias (ex.: 1.10, 1.21) e o
    aumento por compra aparece de verdade, inclusive nas casas decimais. */
export const costOf = (i: number, bought: number, eco: LineEconomy): Decimal =>
  Decimal.pow(10, eco.costSlope * i + eco.costCurve * i * i)
    .round()
    .mul(Decimal.pow(BUY_GROWTH, bought));

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

/** Executa nSteps passos fixos. Função pura e determinística. O genCap limita
    a cadeia: ao comprar o último gerador não se cria um novo além do teto. */
export function advanceLine(line: Line, nSteps: number, genCap: number, eco: LineEconomy): Line {
  const gens = line.gens.map((x) => ({ ...x }));
  let base = line.base;
  let totalProduced = line.totalProduced;
  let uptime = line.uptime;

  for (let s = 0; s < nSteps; s++) {
    if (gens[0].bought > 0) uptime += SIM_STEP_S;

    // Do topo da cadeia para a base: cada gerador cumpre seu ciclo e, ao
    // completar, entrega o lote inteiro ao nível de baixo de uma vez.
    for (let i = gens.length - 1; i >= 0; i--) {
      const gen = gens[i];
      if (gen.amount.lte(0)) continue;

      gen.cycleStep += 1;
      if (gen.cycleStep >= cycleStepsOf(i, eco)) {
        gen.cycleStep = 0;
        const out = gen.amount.mul(prodPerCycleOf(i, eco));
        if (i === 0) {
          base = base.add(out);
          totalProduced = totalProduced.add(out);
        } else {
          gens[i - 1].amount = gens[i - 1].amount.add(out);
        }
      }
    }

    // Modo automático (estrito): só desbloqueia o PRÓXIMO bloqueado ou empilha
    // o MAIS ALTO já desbloqueado — nunca níveis abaixo. Se não couber nenhum
    // dos dois no saldo, espera. Prioriza desbloquear o próximo (índice maior);
    // com a cadeia toda no teto, segue empilhando o último.
    if (line.mode === 'auto') {
      const last = gens.length - 1;
      const lastLocked = gens[last].bought === 0;
      const candidates = lastLocked ? [last, last - 1] : [last];
      for (const i of candidates) {
        if (i < 0) continue;
        const cost = costOf(i, gens[i].bought, eco);
        if (base.lt(cost)) continue;
        const wasLocked = gens[i].bought === 0;
        base = base.sub(cost);
        gens[i].bought += 1;
        gens[i].amount = gens[i].amount.add(1);
        if (wasLocked) {
          gens[i].unlockedAt = uptime;
          if (i === last && gens.length < genCap) gens.push(newGen());
        }
        break;
      }
    }
  }

  return { ...line, base, totalProduced, gens, uptime, steps: line.steps + nSteps };
}

/** Compra manual de 1 unidade do gerador i (respeitando o teto). Pura. */
export function buyGen(line: Line, i: number, genCap: number, eco: LineEconomy): Line {
  const cost = costOf(i, line.gens[i].bought, eco);
  if (line.base.lt(cost)) return line;

  const gens = line.gens.map((x) => ({ ...x }));
  gens[i].bought += 1;
  gens[i].amount = gens[i].amount.add(1);
  if (gens[i].bought === 1) gens[i].unlockedAt = line.uptime;
  // Primeira compra do último gerador desbloqueia o próximo, até o teto.
  if (i === gens.length - 1 && gens.length < genCap) gens.push(newGen());

  return { ...line, base: line.base.sub(cost), gens };
}
