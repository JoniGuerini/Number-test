// Tuning das linhas de produção do Reino (20 geradores, teto finito).
// Espelha exatamente src/components/Reino/engine.ts — batelada por ciclo,
// passo fixo de 0.25s e o modo automático ESTRITO do jogo (desbloqueia o
// próximo gerador ou empilha o mais alto desbloqueado) — e o balanceamento
// por linha de src/components/Reino/lines.ts. É a prova de que a simulação
// continua reproduzível e a ferramenta para tunar a economia. Ao mexer no
// engine, atualize este script junto. Uso:
//   node scripts/simulate-reino.mjs
import Decimal from 'break_eternity.js';

const SIM_STEP_S = 0.25;
const CAP = 20;
const HORIZON_S = 72 * 3600; // 72h de jogo simulado

// Economia por linha (ciclo, produção e curva de preços-base). Filosofia:
// ciclo-base e custo de entrada dobram por linha; crescimento do ciclo +1;
// produção-base +0.1; escada de preços mais íngreme quanto mais funda.
const LINES = [
  { id: 'comida', mandateCost: 1, cycleBaseS: 2, cycleGrowth: 3, prodBase: 0.3, prodStep: 0.1, costSlope: 1.55, costCurve: 0.05 },
  { id: 'mineracao', mandateCost: 2, cycleBaseS: 4, cycleGrowth: 4, prodBase: 0.4, prodStep: 0.1, costSlope: 1.85, costCurve: 0.055 },
  { id: 'exploracao', mandateCost: 3, cycleBaseS: 8, cycleGrowth: 5, prodBase: 0.5, prodStep: 0.1, costSlope: 2.15, costCurve: 0.06 },
  { id: 'militar', mandateCost: 4, cycleBaseS: 16, cycleGrowth: 6, prodBase: 0.6, prodStep: 0.1, costSlope: 2.45, costCurve: 0.065 },
  { id: 'remedios', mandateCost: 5, cycleBaseS: 32, cycleGrowth: 7, prodBase: 0.7, prodStep: 0.1, costSlope: 2.75, costCurve: 0.07 },
];

// Encarecimento por compra repetida: +10% fixo e universal (BUY_GROWTH).
const BUY_GROWTH = 1.1;
function costOf(i, bought, eco) {
  return Decimal.pow(10, eco.costSlope * i + eco.costCurve * i * i)
    .round()
    .mul(Decimal.pow(BUY_GROWTH, bought));
}

const cycleSecondsOf = (i, eco) => eco.cycleBaseS * Math.pow(eco.cycleGrowth, i);
const prodPerCycleOf = (i, eco) =>
  new Decimal(eco.prodBase).add(new Decimal(eco.prodStep).mul(i));

// Melhorias — espelho de src/components/Reino/upgrades.ts
const emptyUpgrades = () => ({
  global: { cycle: 0, production: 0, bonus: 0, bonusAmount: 0, cost: 0 },
  gen: {},
});

const upgradeLevel = (upgrades, lineId, genIndex, kind) => {
  const g = upgrades.global[kind] ?? 0;
  const gn = upgrades.gen[`${lineId}:${genIndex}:${kind}`] ?? 0;
  return { g, gn };
};

const MIN_CYCLE_S = 0.1;
const CYCLE_DECAY = 0.9;

const cycleSpeedFactor = (upgrades, lineId, genIndex, baseSeconds) => {
  const { g, gn } = upgradeLevel(upgrades, lineId, genIndex, 'cycle');
  return Math.min(Math.pow(1 / CYCLE_DECAY, g + gn), baseSeconds / MIN_CYCLE_S);
};

const productionFactor = (upgrades, lineId, genIndex) => {
  const { g, gn } = upgradeLevel(upgrades, lineId, genIndex, 'production');
  return new Decimal(1 + g * 0.1).mul(1 + gn * 0.1);
};

const bonusChance = (upgrades, lineId, genIndex) => {
  const { g, gn } = upgradeLevel(upgrades, lineId, genIndex, 'bonus');
  return Math.min(1, (g + gn) * 0.01);
};

const bonusAmountFraction = (upgrades, lineId, genIndex) => {
  const { g, gn } = upgradeLevel(upgrades, lineId, genIndex, 'bonusAmount');
  return (10 + (g + gn) * 1) / 100;
};

const costDiscountFactor = (upgrades, lineId, genIndex) => {
  const { g, gn } = upgradeLevel(upgrades, lineId, genIndex, 'cost');
  return (1 + g * 0.1) * (1 + gn * 0.1);
};

const genPurchaseCost = (i, bought, eco, lineId, upgrades) =>
  costOf(i, bought, eco).div(costDiscountFactor(upgrades, lineId, i));

const bonusRoll = (steps, lineId, genIndex) => {
  let h = (steps ^ genIndex) >>> 0;
  for (let i = 0; i < lineId.length; i++) {
    h = (Math.imul(h, 31) + lineId.charCodeAt(i)) >>> 0;
  }
  return h % 1_000_000;
};

const bonusTriggers = (chance, roll) => roll < chance * 1_000_000;

const MANDATE_PER_S = 1;
const MANDATE_STEPS_PER_UNIT = Math.round(1 / (MANDATE_PER_S * SIM_STEP_S));

const mandateBalanceFromSteps = (steps, spent) =>
  Math.floor(steps / MANDATE_STEPS_PER_UNIT) - spent;

// ===== Simulação exata (Decimal) — espelho bit a bit do engine =====
function simulate(eco, horizonS, lineId = eco.id, upgrades = emptyUpgrades()) {
  const cycleStepsOf = (i) => cycleSecondsOf(i, eco) / SIM_STEP_S;

  let base = new Decimal(1);
  let mandateSpent = 0;
  const mCost = eco.mandateCost;
  const gens = [{ amount: new Decimal(0), bought: 0, cycleStep: 0 }];
  const unlocks = [];
  let uptime = 0;
  const steps = Math.floor(horizonS / SIM_STEP_S);

  for (let s = 0; s < steps && unlocks.length < CAP; s++) {
    const earnedAt = s + 1;
    if (gens[0].bought > 0) uptime += SIM_STEP_S;

    // Ciclo acumula a VELOCIDADE por passo contra a duração-base, com resto
    // carregado entre ciclos — espelho do stepProduction do engine.
    for (let i = gens.length - 1; i >= 0; i--) {
      const gen = gens[i];
      if (gen.amount.lte(0)) continue;
      gen.cycleStep += cycleSpeedFactor(upgrades, lineId, i, cycleSecondsOf(i, eco));
      const need = cycleStepsOf(i);
      if (gen.cycleStep >= need) {
        const cycles = Math.floor(gen.cycleStep / need);
        gen.cycleStep -= cycles * need;
        let out = gen.amount
          .mul(prodPerCycleOf(i, eco))
          .mul(productionFactor(upgrades, lineId, i))
          .mul(cycles);
        const chance = bonusChance(upgrades, lineId, i);
        if (chance > 0 && bonusTriggers(chance, bonusRoll(s, lineId, i))) {
          const frac = bonusAmountFraction(upgrades, lineId, i);
          out = out.add(out.mul(frac));
        }
        if (i === 0) base = base.add(out);
        else gens[i - 1].amount = gens[i - 1].amount.add(out);
      }
    }

    // Modo automático (estrito), idêntico ao stepAutoBuy do engine: só
    // desbloqueia o PRÓXIMO bloqueado ou empilha o MAIS ALTO já desbloqueado.
    // Mandato ganho até ESTE passo (earnedAt), como no advanceKingdom
    // step-major do jogo — aqui simulando uma linha isolada.
    const last = gens.length - 1;
    const lastLocked = gens[last].bought === 0;
    const candidates = lastLocked ? [last, last - 1] : [last];
    for (const i of candidates) {
      if (i < 0) continue;
      const cost = genPurchaseCost(i, gens[i].bought, eco, lineId, upgrades);
      if (base.lt(cost) || mandateBalanceFromSteps(earnedAt, mandateSpent) < mCost) continue;
      const wasLocked = gens[i].bought === 0;
      base = base.sub(cost);
      mandateSpent += mCost;
      gens[i].bought += 1;
      gens[i].amount = gens[i].amount.add(1);
      if (wasLocked) {
        unlocks.push(uptime);
        if (i === last && gens.length < CAP)
          gens.push({ amount: new Decimal(0), bought: 0, cycleStep: 0 });
      }
      break;
    }
  }
  return unlocks;
}

// ===== Formatadores =====
const fmt = (s) =>
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
function n(dec) {
  if (dec.lt(1000)) return Math.round(dec.toNumber()).toString();
  const exp = Math.floor(dec.log10().toNumber());
  const tier = Math.floor(exp / 3);
  const scaled = dec.div(Decimal.pow(10, tier * 3)).toNumber();
  return (scaled < 100 ? scaled.toFixed(1) : Math.floor(scaled)) + (SUF[tier] ?? 'e' + tier * 3);
}

// ===== Custos + ritmo de desbloqueio em 72h, por linha =====
const rep = (k) => Decimal.pow(BUY_GROWTH, k - 1).toNumber().toFixed(1);
console.log('\n=== Compra repetida (+10% fixo, todas as linhas) ===');
console.log(`  10ª unidade = ×${rep(10)} do custo-base  ·  25ª = ×${rep(25)}  ·  50ª = ×${rep(50)}`);

for (const eco of LINES) {
  console.log(
    `\n### Linha: ${eco.id}  (ciclo ${eco.cycleBaseS}s ×${eco.cycleGrowth}, prod ${eco.prodBase} +${eco.prodStep}, custo ${eco.costSlope}/${eco.costCurve})`
  );
  const costs = [];
  for (let i = 0; i < CAP; i++) costs.push(`g${i + 1}=${n(costOf(i, 0, eco))}`);
  console.log(`  Custo da 1ª compra: ${costs.join('  ')}`);

  const u = simulate(eco, HORIZON_S);
  console.log(`  Ritmo no automático (estrito, igual ao jogo): chegou a g${u.length} em ${fmt(u[u.length - 1])}`);
  console.log(`    ${u.map((t, i) => `g${i + 1}:${fmt(t)}`).join('  ')}`);
}
