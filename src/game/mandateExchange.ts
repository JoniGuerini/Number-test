/** Trocas de mandato — recurso da linha por +1 mandato/s por nível (flat).
    Desbloqueio por marco de estoque; níveis ilimitados; histórico de passos
    para ganho determinístico quando a taxa muda no meio do save. */

import Decimal from 'break_eternity.js';
import { decimalPowInt } from './decimalPow';
import { ENABLED_LINES, type LineId } from './lines';
import type { Line } from './engine';
import {
  MANDATE_BONUS_PER_LEVEL,
  MANDATE_PER_S,
} from './mandate';

/** 1ª troca: 500 do recurso; cada nível seguinte ×100 (500 → 50K → 5M …). Igual em todas as linhas. */
export const EXCHANGE_BASE = 500;
export const EXCHANGE_GROWTH = 100;

const exchangeAmountAt = (level: number): Decimal =>
  new Decimal(EXCHANGE_BASE).mul(
    decimalPowInt(new Decimal(EXCHANGE_GROWTH), level)
  );

export interface MandatePurchase {
  step: number;
  lineId: LineId;
}

export interface MandateExchangeState {
  levels: Record<LineId, number>;
  purchases: MandatePurchase[];
}

export interface MandateExchangeSave {
  levels?: Partial<Record<LineId, number>>;
  purchases?: MandatePurchase[];
}

export const emptyMandateExchange = (): MandateExchangeState => ({
  levels: {
    comida: 0,
    mineracao: 0,
    exploracao: 0,
    militar: 0,
    remedios: 0,
  },
  purchases: [],
});

export const loadMandateExchange = (
  raw: MandateExchangeSave | undefined
): MandateExchangeState => {
  const base = emptyMandateExchange();
  if (!raw) return base;
  if (raw.levels) {
    for (const def of ENABLED_LINES) {
      if (raw.levels[def.id] !== undefined) {
        base.levels[def.id] = Math.max(0, Math.floor(raw.levels[def.id]!));
      }
    }
  }
  if (raw.purchases?.length) {
    base.purchases = raw.purchases.map((p) => ({
      step: Math.max(0, Math.floor(p.step)),
      lineId: p.lineId,
    }));
  }
  return base;
};

export const serializeMandateExchange = (
  s: MandateExchangeState
): MandateExchangeSave => ({
  levels: { ...s.levels },
  purchases: [...s.purchases],
});

export const exchangeLevel = (
  state: MandateExchangeState,
  lineId: LineId
): number => state.levels[lineId] ?? 0;

/** Estoque mínimo e custo da troca do nível `level` (mesmo valor). */
export const unlockThreshold = (_lineId: LineId, level: number): Decimal =>
  exchangeAmountAt(level);

/** Recurso debitado na troca do nível `level`. */
export const exchangeCost = (_lineId: LineId, level: number): Decimal =>
  exchangeAmountAt(level);

export const bonusRateFromExchange = (
  state: MandateExchangeState
): number => {
  let n = 0;
  for (const def of ENABLED_LINES) {
    n += exchangeLevel(state, def.id);
  }
  return n * MANDATE_BONUS_PER_LEVEL;
};

export const totalMandatePerS = (state: MandateExchangeState): number =>
  MANDATE_PER_S + bonusRateFromExchange(state);

export type LinesMap = Partial<Record<LineId, Line>>;

export interface MaxExchangeQuote {
  count: number;
  totalCost: Decimal;
}

/** Maior número de trocas cujo gasto total cabe no saldo. O custo ×100 por
    nível, então o lote é curto — soma direta, sem busca. */
export function maxExchangeQuote(
  balance: Decimal,
  firstCost: Decimal
): MaxExchangeQuote {
  if (firstCost.lte(0) || balance.lt(firstCost)) {
    return { count: 0, totalCost: new Decimal(0) };
  }
  let count = 0;
  let total = new Decimal(0);
  let next = firstCost;
  const LIMIT = 64;
  while (count < LIMIT && total.add(next).lte(balance)) {
    total = total.add(next);
    count++;
    next = next.mul(EXCHANGE_GROWTH);
  }
  return { count, totalCost: total };
}

export const canExchangeMandate = (
  lines: LinesMap,
  state: MandateExchangeState,
  lineId: LineId
): boolean => {
  const line = lines[lineId];
  if (!line?.started) return false;
  const level = exchangeLevel(state, lineId);
  const cost = exchangeCost(lineId, level);
  const unlock = unlockThreshold(lineId, level);
  return line.base.gte(cost) && line.base.gte(unlock);
};

export function tryExchangeMandate(
  lines: LinesMap,
  state: MandateExchangeState,
  lineId: LineId,
  globalSteps: number
): { lines: LinesMap; exchange: MandateExchangeState } | null {
  if (!canExchangeMandate(lines, state, lineId)) return null;
  const level = exchangeLevel(state, lineId);
  const cost = exchangeCost(lineId, level);
  const line = lines[lineId]!;
  const nextLines: LinesMap = {
    ...lines,
    [lineId]: { ...line, base: line.base.sub(cost) },
  };
  const nextLevels = { ...state.levels, [lineId]: level + 1 };
  const nextPurchases = [
    ...state.purchases,
    { step: globalSteps, lineId },
  ];
  return {
    lines: nextLines,
    exchange: { levels: nextLevels, purchases: nextPurchases },
  };
}

export function tryExchangeMaxMandate(
  lines: LinesMap,
  state: MandateExchangeState,
  lineId: LineId,
  globalSteps: number
): { lines: LinesMap; exchange: MandateExchangeState; quote: MaxExchangeQuote } | null {
  const line = lines[lineId];
  if (!line?.started) return null;
  const level = exchangeLevel(state, lineId);
  const quote = maxExchangeQuote(line.base, exchangeCost(lineId, level));
  if (quote.count === 0) return null;

  const nextLines: LinesMap = {
    ...lines,
    [lineId]: { ...line, base: line.base.sub(quote.totalCost) },
  };
  const nextLevels = { ...state.levels, [lineId]: level + quote.count };
  const nextPurchases = [
    ...state.purchases,
    ...Array.from({ length: quote.count }, () => ({
      step: globalSteps,
      lineId,
    })),
  ];
  return {
    lines: nextLines,
    exchange: { levels: nextLevels, purchases: nextPurchases },
    quote,
  };
}
