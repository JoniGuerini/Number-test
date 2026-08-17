/** Melhorias / pesquisas do Reino. Ciclo: −10% do tempo ATUAL por nível
    (composto ×0.9, sem piso). Produção: +10% por nível (sem teto).
    Bônus: chance +1%/nível até 100% (global + gen); volume base 10% +1%/nível.
    Bônus usa rolagem determinística (hash de passos) — sem Math.random().

    Preços: escada única por gerador, IGUAL nas 5 linhas (cada uma paga no seu
    recurso base), seguindo o custo-base universal do gerador ×200. Cada nível
    DOBRA o preço. */

import Decimal from 'break_eternity.js';
import { generatorBaseCost } from './costs';
import { decimalPowInt } from './decimalPow';
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
/** Cada nível DOBRA o preço da melhoria. */
export const LEVEL_GROWTH = 2;
/** Teto da pesquisa automática por tipo e alvo (global ou gerador).
    Sem isso o automático, na espera de mandato, empilha Ciclos rápidos
    até a economia ir a Infinity. Compra manual continua sem teto
    (exceto chance bônus em 100%). */
export const AUTO_UPGRADE_LEVEL_CAP = 40;
/** Chance bônus: +1% por nível, teto 100% (níveis além disso não fazem nada). */
export const BONUS_CHANCE_CAP = 100;

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

/** Cada nível de Ciclos rápidos corta 10% do tempo ATUAL: 2s → 1,8s → 1,62s…
    (tempo × 0.9 por nível, composto). Sem piso — igual ao Rendimento. */
export const CYCLE_DECAY = 0.9;
/** 1 / 0.9 em Decimal (10/9) — `1 / 0.9` em number já arredonda. */
const CYCLE_SPEED_BASE = new Decimal(10).div(9);

/** Fator de velocidade para `levels` níveis somados (global + gen):
    (10/9)^níveis. Decimal: `Math.pow(1/0.9, n)` vira Infinity ~nível 6730. */
export const cycleFactorFor = (levels: number): Decimal =>
  decimalPowInt(CYCLE_SPEED_BASE, levels);

export const cycleSpeedFactor = (
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number
): Decimal => {
  const g = getLevel(upgrades, 'global', 'cycle');
  const gn = getLevel(upgrades, { lineId, index: genIndex }, 'cycle');
  return cycleFactorFor(g + gn);
};

/** Duração de ciclo exibida — espelha o motor (que acumula cycleSpeedFactor
    por passo contra a duração-base, carregando o resto entre ciclos). */
export const cycleSecondsWithUpgrades = (
  baseSeconds: number,
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number
): Decimal =>
  new Decimal(baseSeconds).div(cycleSpeedFactor(upgrades, lineId, genIndex));

/** 1 + 10%·nível, em Decimal — `1 + level * 0.1` em number vira Infinity. */
export const linearFactor = (level: number): Decimal =>
  new Decimal(1).add(new Decimal(level).mul(0.1));

/** Produção: multiplica entrega por (1 + 10%·nível). */
export const productionFactor = (
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number
): Decimal => {
  const g = getLevel(upgrades, 'global', 'production');
  const gn = getLevel(upgrades, { lineId, index: genIndex }, 'production');
  return linearFactor(g).mul(linearFactor(gn));
};

/** Compra de gerador: divide custo por (1 + 10%·nível) — global e gen acumulam. */
export const costDiscountFactor = (
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number
): Decimal => {
  const g = getLevel(upgrades, 'global', 'cost');
  const gn = getLevel(upgrades, { lineId, index: genIndex }, 'cost');
  return linearFactor(g).mul(linearFactor(gn));
};

export const discountedGenCost = (
  baseCost: Decimal,
  upgrades: UpgradeState,
  lineId: LineId,
  genIndex: number
): Decimal => baseCost.div(costDiscountFactor(upgrades, lineId, genIndex));

/** Níveis ainda compráveis desta pesquisa. `null` = sem teto. Chance bônus
    para em 100% somando global + gerador. */
export const remainingUpgradeLevels = (
  upgrades: UpgradeState,
  target: 'global' | GenRef,
  kind: UpgradeKind
): number | null => {
  if (kind !== 'bonus') return null;
  const cap =
    target === 'global'
      ? BONUS_CHANCE_CAP
      : Math.max(0, BONUS_CHANCE_CAP - getLevel(upgrades, 'global', 'bonus'));
  return Math.max(0, cap - getLevel(upgrades, target, kind));
};

export const isUpgradeMaxed = (
  upgrades: UpgradeState,
  target: 'global' | GenRef,
  kind: UpgradeKind
): boolean => remainingUpgradeLevels(upgrades, target, kind) === 0;

/** Pesquisa mais barata ainda disponível (menor nível; empate na ordem de
    UPGRADE_KINDS). Usado pelo modo automático. */
export const pickCheapestUpgrade = (
  upgrades: UpgradeState,
  target: 'global' | GenRef,
  maxLevel = Infinity,
  skip: readonly UpgradeKind[] = []
): UpgradeKind | null => {
  let best: UpgradeKind | null = null;
  let bestLevel = Infinity;
  for (const kind of UPGRADE_KINDS) {
    if (skip.includes(kind)) continue;
    if (isUpgradeMaxed(upgrades, target, kind)) continue;
    const level = getLevel(upgrades, target, kind);
    if (level >= maxLevel) continue;
    if (level < bestLevel) {
      bestLevel = level;
      best = kind;
    }
  }
  return best;
};

export const applyUpgradeLevel = (
  upgrades: UpgradeState,
  target: 'global' | GenRef,
  kind: UpgradeKind,
  level: number
): void => {
  if (target === 'global') upgrades.global[kind] = level;
  else upgrades.gen[genKey(target.lineId, target.index, kind)] = level;
};

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

export interface MaxUpgradeQuote {
  count: number;
  totalCost: Decimal;
}

/** Potência inteira por multiplicação — `Decimal.pow(2, n)` usa ln/exp e
    deixa resíduo (7.999… em vez de 8). */
const decimalPowInt = (base: Decimal, exp: number): Decimal => {
  let result = new Decimal(1);
  let b = new Decimal(base);
  let e = Math.max(0, Math.floor(exp));
  while (e > 0) {
    if (e % 2 === 1) result = result.mul(b);
    b = b.mul(b);
    e = Math.floor(e / 2);
  }
  return result;
};

/** Soma geométrica das próximas `count` pesquisas (preço ×2 por nível). */
const repeatedUpgradeTotal = (firstCost: Decimal, count: number): Decimal => {
  if (count <= 0) return new Decimal(0);
  const growth = new Decimal(LEVEL_GROWTH);
  return firstCost
    .mul(decimalPowInt(growth, count).sub(1))
    .div(growth.sub(1));
};

/** Saldo que limita a compra: o menor recurso das cinco linhas (global)
    ou o recurso da linha do gerador. */
export function upgradeBudget(
  lines: LinesMap,
  target: 'global' | GenRef
): Decimal {
  if (target === 'global') {
    let min: Decimal | null = null;
    for (const def of ENABLED_LINES) {
      const line = lines[def.id];
      if (!line?.started) return new Decimal(0);
      min = min === null || line.base.lt(min) ? line.base : min;
    }
    return min ?? new Decimal(0);
  }
  const line = lines[target.lineId];
  if (!line?.started || !isGenUnlocked(line, target.index)) {
    return new Decimal(0);
  }
  return line.base;
}

/** Maior número de níveis cujo gasto total cabe no saldo. Busca binária
    — o preço dobra a cada nível, então o lote explode rápido. */
export function maxUpgradeQuote(
  balance: Decimal,
  firstCost: Decimal,
  maxCount = 1_000_000
): MaxUpgradeQuote {
  const LIMIT = Math.max(0, Math.floor(maxCount));
  if (LIMIT <= 0 || firstCost.lte(0) || balance.lt(firstCost)) {
    return { count: 0, totalCost: new Decimal(0) };
  }

  let low = 1;
  let high = 1;
  while (high < LIMIT && repeatedUpgradeTotal(firstCost, high).lte(balance)) {
    low = high;
    high = Math.min(high * 2, LIMIT);
  }
  if (repeatedUpgradeTotal(firstCost, high).lte(balance)) {
    return { count: high, totalCost: repeatedUpgradeTotal(firstCost, high) };
  }
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (repeatedUpgradeTotal(firstCost, mid).lte(balance)) low = mid;
    else high = mid;
  }
  return { count: low, totalCost: repeatedUpgradeTotal(firstCost, low) };
}

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
  if (isUpgradeMaxed(upgrades, target, kind)) return null;
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

export function tryBuyMaxUpgrade(
  lines: LinesMap,
  upgrades: UpgradeState,
  target: 'global' | GenRef,
  kind: UpgradeKind
): { lines: LinesMap; upgrades: UpgradeState; quote: MaxUpgradeQuote } | null {
  if (isUpgradeMaxed(upgrades, target, kind)) return null;
  const level = getLevel(upgrades, target, kind);
  const firstCost = purchaseCost(target, level);
  const remaining = remainingUpgradeLevels(upgrades, target, kind);
  const quote = maxUpgradeQuote(
    upgradeBudget(lines, target),
    firstCost,
    remaining ?? 1_000_000
  );
  if (quote.count === 0) return null;

  const nextUpgrades: UpgradeState = {
    global: { ...upgrades.global },
    gen: { ...upgrades.gen },
  };

  if (target === 'global') {
    const nextLines: LinesMap = { ...lines };
    for (const def of ENABLED_LINES) {
      const line = lines[def.id]!;
      nextLines[def.id] = { ...line, base: line.base.sub(quote.totalCost) };
    }
    nextUpgrades.global[kind] = level + quote.count;
    return { lines: nextLines, upgrades: nextUpgrades, quote };
  }

  const line = lines[target.lineId]!;
  const nextLines: LinesMap = {
    ...lines,
    [target.lineId]: { ...line, base: line.base.sub(quote.totalCost) },
  };
  nextUpgrades.gen[genKey(target.lineId, target.index, kind)] =
    level + quote.count;
  return { lines: nextLines, upgrades: nextUpgrades, quote };
}
