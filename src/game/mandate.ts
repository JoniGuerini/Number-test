/** Mandato — recurso universal do Reino (sempre inteiro). Ciclo fixo de 1 s:
    ao completar o ciclo entrega o lote inteiro (+taxa/s de uma vez), como
    geradores — nunca frações espalhadas dentro do segundo.

    Saldo = mandatosGanhos(passos) − gasto; ganho derivado dos passos globais
    (âncora comida), determinístico. */

import { SIM_STEP_S } from './sim';
import { lineDefOf, type LineId } from './lines';
import type { Line } from './engine';

export const MANDATE_PER_S = 1;
/** Bônus flat por troca de mandato (melhorias). */
export const MANDATE_BONUS_PER_LEVEL = 1;

/** Passos de simulação por ciclo de mandato (1 s com passo de 0,25s → 4). */
export const MANDATE_STEPS_PER_UNIT = Math.round(1 / (MANDATE_PER_S * SIM_STEP_S));

/** Apenas o gasto acumulado é persistido; o ganho vem dos passos globais. */
export interface MandateState {
  spent: number;
}

export const emptyMandate = (): MandateState => ({ spent: 0 });

export const mandateEarned = (steps: number): number =>
  mandateEarnedAtSteps(steps, []);

/** Registro mínimo para integral de taxa (passo global da âncora). */
export interface MandatePurchaseLog {
  step: number;
}

/** Mandatos ganhos até `steps` — lote a cada ciclo completo (1 s). */
export const mandateEarnedAtSteps = (
  steps: number,
  purchases: readonly MandatePurchaseLog[],
  bonusPerPurchase = MANDATE_BONUS_PER_LEVEL
): number => {
  if (steps <= 0) return 0;
  let total = 0;
  let rate = MANDATE_PER_S;
  let segStart = 0;
  const sorted = [...purchases].sort((a, b) => a.step - b.step);
  for (const p of sorted) {
    if (p.step > steps) break;
    const segSteps = p.step - segStart;
    total += Math.floor(segSteps / MANDATE_STEPS_PER_UNIT) * rate;
    rate += bonusPerPurchase;
    segStart = p.step;
  }
  const tail = steps - segStart;
  total += Math.floor(tail / MANDATE_STEPS_PER_UNIT) * rate;
  return total;
};

export const mandateBalance = (
  steps: number,
  spent: number,
  purchases: readonly MandatePurchaseLog[] = []
): number => mandateEarnedAtSteps(steps, purchases) - spent;

export const mandateCostOf = (lineId: LineId): number =>
  lineDefOf(lineId).mandateCost;

export const loadMandate = (
  save:
    | { mandateSpent?: number; mandate?: number | string; mandateFrac?: number }
    | undefined,
  lines: Partial<Record<LineId, Line>>
): MandateState => {
  if (save?.mandateSpent !== undefined) {
    return { spent: Math.max(0, Math.floor(save.mandateSpent)) };
  }
  const anchor = lines.comida;
  if (!anchor?.started) return emptyMandate();
  if (save?.mandate !== undefined) {
    const earned = mandateEarned(anchor.steps);
    const balance = Math.floor(Number(save.mandate));
    return { spent: Math.max(0, earned - balance) };
  }
  return emptyMandate();
};

/** earnedAtSteps: passos já creditados (ex.: batch inteiro antes de simular). */
export const spendMandate = (
  state: MandateState,
  cost: number,
  earnedAtSteps: number,
  purchases: readonly MandatePurchaseLog[] = []
): MandateState | null => {
  if (mandateBalance(earnedAtSteps, state.spent, purchases) < cost) return null;
  return { spent: state.spent + cost };
};

export const serializeMandate = (s: MandateState): { mandateSpent: number } => ({
  mandateSpent: s.spent,
});
