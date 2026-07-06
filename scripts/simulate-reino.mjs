// Tuning das linhas de produção do Reino (20 geradores, teto finito).
// Espelha exatamente src/components/Reino/engine.ts (batelada por ciclo,
// passo fixo de 0.25s, auto-compra do próximo gerador) e o balanceamento
// por linha de src/components/Reino/lines.ts. Uso:
//   node scripts/simulate-reino.mjs
import Decimal from 'break_eternity.js';

const SIM_STEP_S = 0.25;
const CAP = 20;
const MAX_TIME = 72 * 3600; // 72h de jogo simulado (headroom p/ curvas duras)

// Economia por linha (ciclo, produção e curva de preços-base). Filosofia:
// ciclo-base e custo de entrada dobram por linha; crescimento do ciclo +1;
// produção-base +0.1; escada de preços mais íngreme quanto mais funda.
const LINES = [
  { id: 'comida', cycleBaseS: 2, cycleGrowth: 3, prodBase: 0.3, prodStep: 0.1, costSlope: 1.36, costCurve: 0.04 },
  { id: 'mineracao', cycleBaseS: 4, cycleGrowth: 4, prodBase: 0.4, prodStep: 0.1, costSlope: 1.66, costCurve: 0.045 },
  { id: 'exploracao', cycleBaseS: 8, cycleGrowth: 5, prodBase: 0.5, prodStep: 0.1, costSlope: 1.95, costCurve: 0.05 },
  { id: 'militar', cycleBaseS: 16, cycleGrowth: 6, prodBase: 0.6, prodStep: 0.1, costSlope: 2.25, costCurve: 0.055 },
  { id: 'remedios', cycleBaseS: 32, cycleGrowth: 7, prodBase: 0.7, prodStep: 0.1, costSlope: 2.54, costCurve: 0.06 },
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

function simulate(eco) {
  const cycleStepsOf = (i) => cycleSecondsOf(i, eco) / SIM_STEP_S;

  let base = new Decimal(1);
  const gens = [{ amount: new Decimal(0), bought: 0, cycleStep: 0 }];
  const unlocks = [];
  let uptime = 0;
  const steps = Math.floor(MAX_TIME / SIM_STEP_S);

  for (let s = 0; s < steps && unlocks.length < CAP; s++) {
    if (gens[0].bought > 0) uptime += SIM_STEP_S;

    for (let i = gens.length - 1; i >= 0; i--) {
      const gen = gens[i];
      if (gen.amount.lte(0)) continue;
      gen.cycleStep += 1;
      if (gen.cycleStep >= cycleStepsOf(i)) {
        gen.cycleStep = 0;
        const out = gen.amount.mul(prodPerCycleOf(i, eco));
        if (i === 0) base = base.add(out);
        else gens[i - 1].amount = gens[i - 1].amount.add(out);
      }
    }

    const last = gens.length - 1;
    const cost = costOf(last, 0, eco);
    if (gens[last].bought === 0 && base.gte(cost)) {
      base = base.sub(cost);
      gens[last].bought = 1;
      gens[last].amount = gens[last].amount.add(1);
      unlocks.push(uptime);
      if (gens.length < CAP) gens.push({ amount: new Decimal(0), bought: 0, cycleStep: 0 });
    }
  }
  return unlocks;
}

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

// Encarecimento por compra: igual em tudo, mostrado uma vez.
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

  const u = simulate(eco);
  console.log(`  Ritmo no automático (compra 1 de cada): chegou a g${u.length} em ${fmt(u[u.length - 1])}`);
  console.log(`    ${u.map((t, i) => `g${i + 1}:${fmt(t)}`).join('  ')}`);
}
