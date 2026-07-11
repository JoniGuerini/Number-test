/** Melhorias / pesquisas do Reino. Ciclo: −10% do tempo ATUAL por nível
    (composto ×0.9, piso 0,1s — no piso a melhoria do gerador trava no máximo).
    Produção: +10% por nível (sem teto).
    Bônus: chance +1%/nível; volume base 10% +1%/nível (global + gen acumulam).
    Bônus usa rolagem determinística (hash de passos) — sem Math.random().

    Preços: escada única por gerador, IGUAL nas 5 linhas (cada uma paga no seu
    recurso base), seguindo o custo-base universal do gerador ×200. Cada nível
    DOBRA o preço. */

import Decimal from 'break_eternity.js';
import { generatorBaseCost } from './costs';
import { ENABLED_LINES, lineDefOf, type LineId } from './lines';
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
/** Cada nível DOBRA o preço da melhoria. */
export const LEVEL_GROWTH = 2;

/** Preço-base da melhoria = custo-base universal do gerador × este fator. */
export const UPGRADE_COST_MULTIPLIER = 200;

const genBaseCost = (index: number): Decimal =>
  generatorBaseCost(index).mul(UPGRADE_COST_MULTIPLIER);

/** Global afeta todos os geradores de todas as linhas — preço premium (5× o
    tier do gerador 1), debitado por igual de CADA recurso base. */
export const GLOBAL_BASE_COST = 1_000;

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

/** Preço da melhoria no nível dado: base do gerador (escada única, igual nas
    5 linhas) × 2^nível. Global usa a base premium própria. */
export const purchaseCost = (target: 'global' | GenRef, level: number): Decimal => {
  const base =
    target === 'global' ? new Decimal(GLOBAL_BASE_COST) : genBaseCost(target.index);
  return base.mul(Decimal.pow(LEVEL_GROWTH, level));
};

export const getLevel = (
  upgrades: UpgradeState,
  target: 'global' | GenRef,
  kind: UpgradeKind
): number => {
  if (target === 'global') return upgrades.global[kind] ?? 0;
  return upgrades.gen[genKey(target.lineId, target.index, kind)] ?? 0;
};

export const totalEffectPct = (level: number): number => level * EFFECT_PCT;

/** Piso do ciclo efetivo: por mais melhorias que acumulem, nenhum ciclo fica
    mais rápido que isto. */
export const MIN_CYCLE_S = 0.1;

/** Cada nível de Ciclos rápidos corta 10% do tempo ATUAL: 2s → 1,8s → 1,62s…
    (tempo × 0.9 por nível, composto). */
export const CYCLE_DECAY = 0.9;

/** Fator de velocidade para `levels` níveis somados (global + gen):
    (1/0.9)^níveis, limitado para o ciclo efetivo nunca cair abaixo de
    MIN_CYCLE_S. */
export const cycleFactorFor = (levels: number, baseSeconds: number): number =>
  Math.min(Math.pow(1 / CYCLE_DECAY, levels), baseSeconds / MIN_CYCLE_S);

export const cycleSpeedFactor = (
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number,
  baseSeconds: number
): number => {
  const g = getLevel(upgrades, 'global', 'cycle');
  const gn = getLevel(upgrades, { lineId, index: genIndex }, 'cycle');
  return cycleFactorFor(g + gn, baseSeconds);
};

/** O ciclo do gerador já está no piso de 0,1s? Aí a melhoria de ciclo DESTE
    gerador atinge o nível máximo e não pode mais ser comprada. */
export const isCycleMaxed = (
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number,
  baseSeconds: number
): boolean => {
  const g = getLevel(upgrades, 'global', 'cycle');
  const gn = getLevel(upgrades, { lineId, index: genIndex }, 'cycle');
  return Math.pow(1 / CYCLE_DECAY, g + gn) >= baseSeconds / MIN_CYCLE_S;
};

/** Duração de ciclo exibida — espelha o motor (que acumula cycleSpeedFactor
    por passo contra a duração-base, carregando o resto entre ciclos). */
export const cycleSecondsWithUpgrades = (
  baseSeconds: number,
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number
): number =>
  baseSeconds / cycleSpeedFactor(upgrades, lineId, genIndex, baseSeconds);

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
  if (kind === 'cycle' && target !== 'global') {
    const baseS =
      lineDefOf(target.lineId).eco.cycleBaseS *
      Math.pow(lineDefOf(target.lineId).eco.cycleGrowth, target.index);
    if (isCycleMaxed(upgrades, target.lineId, target.index, baseS)) return null;
  }
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
