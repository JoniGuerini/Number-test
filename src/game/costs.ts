import Decimal from 'break_eternity.js';

/**
 * Expoente decimal do custo-base do gerador (índice zero-based):
 * G1–G4: 10^0, 10^1, 10^2, 10^3;
 * do G5 em diante: avança um grupo de milhar por tier
 * (10^6, 10^9, 10^12, 10^15...).
 */
export const generatorCostExponent = (index: number): number =>
  index <= 3 ? index : 3 * (index - 2);

/** Escada universal de custo-base, igual nas cinco linhas de produção. */
export const generatorBaseCost = (index: number): Decimal =>
  Decimal.pow(10, generatorCostExponent(index));
