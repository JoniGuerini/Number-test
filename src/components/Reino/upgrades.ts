/** Melhorias / pesquisas do Reino. Ciclo/produção: +10% por nível (sem teto).
    Bônus: chance +1%/nível; volume base 10% +1%/nível (global + gen acumulam).
    Bônus usa rolagem determinística (hash de passos) — sem Math.random(). */

import Decimal from 'break_eternity.js';
import { ENABLED_LINES, type LineId } from './lines';
import type { Line } from './engine';

export type UpgradeKind =
  | 'cycle'
  | 'production'
  | 'bonus'
  | 'bonusAmount'
  | 'cost';

export type GenRef = { lineId: LineId; index: number };

export const UPGRADE_KINDS: UpgradeKind[] = [
  'cycle',
  'production',
  'bonus',
  'bonusAmount',
  'cost',
];

export const EFFECT_PCT = 10;
export const BONUS_CHANCE_PCT = 1;
export const BONUS_AMOUNT_BASE_PCT = 10;
export const BONUS_AMOUNT_PCT = 1;
export const COST_GROWTH = 1.12;

export const BASE_HOURLY: Record<LineId, number> = {
  comida: 120,
  mineracao: 80,
  exploracao: 55,
  militar: 38,
  remedios: 26,
};

/** Global afeta todas as linhas — tarifa total × escopo, repartida igual por recurso. */
export const GLOBAL_SCOPE_MULTIPLIER = 4;
const LINE_COUNT = (Object.keys(BASE_HOURLY) as LineId[]).length;
export const GLOBAL_HOURLY_BASE = Math.round(
  (Object.values(BASE_HOURLY) as number[]).reduce((s, v) => s + v, 0) *
    GLOBAL_SCOPE_MULTIPLIER
);
/** Mesma quantia debitada de cada recurso base (Comida, Mineração, …). */
export const globalCostPerResource = (level: number): number =>
  Math.round((GLOBAL_HOURLY_BASE / LINE_COUNT) * COST_GROWTH ** level);

/** Sincroniza Reino ↔ Melhorias após gravar o save. */
export const REINO_SAVE_EVENT = 'number-test:reino-updated';

export interface UpgradeState {
  global: Record<UpgradeKind, number>;
  /** `${lineId}:${index}:${kind}` → nível */
  gen: Record<string, number>;
}

export interface UpgradeStateSave {
  global?: Partial<Record<UpgradeKind, number>>;
  gen?: Record<string, number>;
}

export const emptyUpgrades = (): UpgradeState => ({
  global: { cycle: 0, production: 0, bonus: 0, bonusAmount: 0, cost: 0 },
  gen: {},
});

export const loadUpgrades = (raw: UpgradeStateSave | undefined): UpgradeState => {
  const base = emptyUpgrades();
  if (!raw) return base;
  for (const k of UPGRADE_KINDS) {
    if (raw.global?.[k] !== undefined) base.global[k] = raw.global[k]!;
  }
  if (raw.gen) base.gen = { ...raw.gen };
  return base;
};

export const serializeUpgrades = (u: UpgradeState): UpgradeStateSave => ({
  global: { ...u.global },
  gen: { ...u.gen },
});

export const upgradeKey = (
  target: 'global' | GenRef,
  kind: UpgradeKind
): string => {
  if (target === 'global') return `global:${kind}`;
  return `${target.lineId}:${target.index}:${kind}`;
};

export const genKey = (lineId: LineId, index: number, kind: UpgradeKind): string =>
  `${lineId}:${index}:${kind}`;

export const costLineOf = (target: 'global' | GenRef): LineId =>
  target === 'global' ? 'comida' : target.lineId;

export const hourlyCost = (
  target: 'global' | GenRef,
  level: number
): number => {
  if (target === 'global') return globalCostPerResource(level);
  const depth = 1 + target.index * 0.12;
  return Math.round(BASE_HOURLY[target.lineId] * depth * COST_GROWTH ** level);
};

export const purchaseCost = (target: 'global' | GenRef, level: number): Decimal =>
  new Decimal(hourlyCost(target, level));

export const getLevel = (
  upgrades: UpgradeState,
  target: 'global' | GenRef,
  kind: UpgradeKind
): number => {
  if (target === 'global') return upgrades.global[kind] ?? 0;
  return upgrades.gen[genKey(target.lineId, target.index, kind)] ?? 0;
};

export const totalEffectPct = (level: number): number => level * EFFECT_PCT;

/** Ciclo mais rápido: divide duração por (1 + 10%·nível) — global e gen acumulam. */
export const cycleSpeedFactor = (
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number
): number => {
  const g = getLevel(upgrades, 'global', 'cycle');
  const gn = getLevel(upgrades, { lineId, index: genIndex }, 'cycle');
  return (1 + g * 0.1) * (1 + gn * 0.1);
};

export const cycleStepsWithUpgrades = (
  baseSteps: number,
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number
): number => baseSteps / cycleSpeedFactor(upgrades, lineId, genIndex);

/** Duração de ciclo exibida — espelha o motor. */
export const cycleSecondsWithUpgrades = (
  baseSeconds: number,
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number
): number => baseSeconds / cycleSpeedFactor(upgrades, lineId, genIndex);

/** Produção: multiplica entrega por (1 + 10%·nível). */
export const productionFactor = (
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number
): Decimal => {
  const g = getLevel(upgrades, 'global', 'production');
  const gn = getLevel(upgrades, { lineId, index: genIndex }, 'production');
  return new Decimal(1 + g * 0.1).mul(1 + gn * 0.1);
};

/** Compra de gerador: divide custo por (1 + 10%·nível) — global e gen acumulam. */
export const costDiscountFactor = (
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number
): number => {
  const g = getLevel(upgrades, 'global', 'cost');
  const gn = getLevel(upgrades, { lineId, index: genIndex }, 'cost');
  return (1 + g * 0.1) * (1 + gn * 0.1);
};

export const discountedGenCost = (
  baseCost: Decimal,
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number
): Decimal => baseCost.div(costDiscountFactor(upgrades, lineId, genIndex));

/** Chance de bônus 0…1 (cap em 1). +1% por nível (global + gen). */
export const bonusChance = (
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number
): number => {
  const g = getLevel(upgrades, 'global', 'bonus');
  const gn = getLevel(upgrades, { lineId, index: genIndex }, 'bonus');
  return Math.min(1, (g + gn) * (BONUS_CHANCE_PCT / 100));
};

/** Extra de recurso bônus quando acerta: 10% base +1% por nível (global + gen). */
export const bonusAmountFraction = (
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number
): number =>
  (BONUS_AMOUNT_BASE_PCT +
    (getLevel(upgrades, 'global', 'bonusAmount') +
      getLevel(upgrades, { lineId, index: genIndex }, 'bonusAmount')) *
      BONUS_AMOUNT_PCT) /
  100;

export const applyBonusOutput = (out: Decimal, fraction: number): Decimal =>
  out.add(out.mul(fraction));

/** Hash determinístico 0…999999 — ancora no passo da linha. */
export const bonusRoll = (
  steps: number,
  lineId: LineId,
  genIndex: number
): number => {
  let h = (steps ^ genIndex) >>> 0;
  for (let i = 0; i < lineId.length; i++) {
    h = (Math.imul(h, 31) + lineId.charCodeAt(i)) >>> 0;
  }
  return h % 1_000_000;
};

export const bonusTriggers = (
  chance: number,
  roll: number
): boolean => roll < chance * 1_000_000;

export const isGenUnlocked = (line: Line | undefined, index: number): boolean =>
  !!line?.gens[index] && line.gens[index].bought > 0;

export const unlockedGenIndices = (line: Line | undefined): number[] => {
  if (!line) return [];
  return line.gens
    .map((g, i) => (g.bought > 0 ? i : -1))
    .filter((i) => i >= 0);
};

export type LinesMap = Partial<Record<LineId, Line>>;

export function canAffordUpgrade(
  lines: LinesMap,
  target: 'global' | GenRef,
  level: number
): boolean {
  const cost = purchaseCost(target, level);
  if (target === 'global') {
    return ENABLED_LINES.every((def) => {
      const line = lines[def.id];
      return !!line?.started && line.base.gte(cost);
    });
  }
  const line = lines[target.lineId];
  return !!line?.started && isGenUnlocked(line, target.index) && line.base.gte(cost);
}

export function tryBuyUpgrade(
  lines: LinesMap,
  upgrades: UpgradeState,
  target: 'global' | GenRef,
  kind: UpgradeKind
): { lines: LinesMap; upgrades: UpgradeState } | null {
  const level = getLevel(upgrades, target, kind);
  const cost = purchaseCost(target, level);
  if (!canAffordUpgrade(lines, target, level)) return null;

  const nextUpgrades: UpgradeState = {
    global: { ...upgrades.global },
    gen: { ...upgrades.gen },
  };

  if (target === 'global') {
    const nextLines: LinesMap = { ...lines };
    for (const def of ENABLED_LINES) {
      const line = lines[def.id]!;
      nextLines[def.id] = { ...line, base: line.base.sub(cost) };
    }
    nextUpgrades.global[kind] = level + 1;
    return { lines: nextLines, upgrades: nextUpgrades };
  }

  const line = lines[target.lineId]!;
  const nextLines: LinesMap = {
    ...lines,
    [target.lineId]: { ...line, base: line.base.sub(cost) },
  };
  nextUpgrades.gen[genKey(target.lineId, target.index, kind)] = level + 1;
  return { lines: nextLines, upgrades: nextUpgrades };
}

export function notifyReinoSave(): void {
  window.dispatchEvent(new Event(REINO_SAVE_EVENT));
}
