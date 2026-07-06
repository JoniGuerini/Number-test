// Tuning das linhas de produção do Reino (20 geradores, teto finito).
// Espelha exatamente src/components/Reino/engine.ts — batelada por ciclo,
// passo fixo de 0.25s e o modo automático ESTRITO do jogo (desbloqueia o
// próximo gerador ou empilha o mais alto desbloqueado) — e o balanceamento
// por linha de src/components/Reino/lines.ts.
//
// Uso:
//   node scripts/simulate-reino.mjs             → custos + ritmo em 72h
//                                                 (Decimal, espelho do engine)
//   node scripts/simulate-reino.mjs deep [anos] → simulação profunda passo a
//     passo (padrão 15 anos; floats com paridade verificada contra o Decimal
//     em 72h — nada de extrapolação) e regeneração de
//     src/data/simulatedUnlocks.ts (aba Simulada da Atividade).
//
// O modo deep é incremental e roda as 5 linhas EM PARALELO (worker threads):
//   - linha completa (20/20) no checkpoint  → reaproveitada em qualquer
//     horizonte, nunca re-simula;
//   - horizonte pedido ≤ já simulado        → recorte instantâneo;
//   - horizonte pedido > já simulado        → RETOMA do estado salvo e paga
//     só o trecho novo (determinístico: idêntico a simular do zero);
//   - durante a rodada, cada linha salva um snapshot do estado a cada ~60s
//     em scripts/.sim-checkpoint.json — interrupção perde no máximo isso.
// Mudou o balanceamento? O fingerprint invalida o checkpoint sozinho.
// SIM_OUT=<path> desvia a emissão do .ts (útil para testes).
import Decimal from 'break_eternity.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const SIM_STEP_S = 0.25;
const CAP = 20;
const FAST_HORIZON_S = 72 * 3600;
const YEAR_S = 365 * 86400;
/** Horizonte da simulação profunda, em anos (arg opcional do modo deep). */
const DEEP_YEARS = Math.max(1, Number(process.argv[3]) || 15);
/** Custo aproximado de execução por linha-ano simulada (para estimativas). */
const WALL_S_PER_LINE_YEAR = 4.5;

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKPOINT_PATH = join(HERE, '.sim-checkpoint.json');
const OUT_PATH = process.env.SIM_OUT ?? join(HERE, '../src/data/simulatedUnlocks.ts');

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

// ===== Simulação exata (Decimal) — espelho bit a bit do engine =====
function simulateDec(eco, horizonS) {
  const cycleStepsOf = (i) => cycleSecondsOf(i, eco) / SIM_STEP_S;

  let base = new Decimal(1);
  const gens = [{ amount: new Decimal(0), bought: 0, cycleStep: 0 }];
  const unlocks = [];
  let uptime = 0;
  const steps = Math.floor(horizonS / SIM_STEP_S);

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

    // Modo automático (estrito), idêntico ao advanceLine do engine: só
    // desbloqueia o PRÓXIMO bloqueado ou empilha o MAIS ALTO já desbloqueado.
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
        unlocks.push(uptime);
        if (i === last && gens.length < CAP)
          gens.push({ amount: new Decimal(0), bought: 0, cycleStep: 0 });
      }
      break;
    }
  }
  return unlocks;
}

// ===== Simulação rápida (floats nativos) — para horizontes profundos =====
// Mesma lógica passo a passo; troca break_eternity por double (os valores do
// jogo cabem folgados em 1.8e308). Paridade contra o Decimal é verificada em
// 72h antes de confiar no resultado profundo.
//
// `resume` (opcional) continua uma simulação anterior a partir do estado
// salvo — como a continuação é função pura do estado, o resultado é idêntico
// ao de simular tudo do zero. `onEvent` emite desbloqueios e um heartbeat
// periódico com snapshot do estado (para checkpoint em rodadas longas).
function simulateFast(eco, horizonS, onEvent, resume) {
  const baseCost = [];
  const cycleSteps = [];
  const prodPer = [];
  for (let i = 0; i < CAP; i++) {
    baseCost.push(Math.round(Math.pow(10, eco.costSlope * i + eco.costCurve * i * i)));
    cycleSteps.push(cycleSecondsOf(i, eco) / SIM_STEP_S);
    prodPer.push(eco.prodBase + eco.prodStep * i);
  }

  let base, uptime, amount, bought, cycleStep, unlocks, startStep;
  if (resume) {
    ({ base, uptime } = resume.state);
    amount = [...resume.state.amount];
    bought = [...resume.state.bought];
    cycleStep = [...resume.state.cycleStep];
    unlocks = [...resume.unlocks];
    startStep = Math.round(resume.simulatedS / SIM_STEP_S);
  } else {
    base = 1;
    uptime = 0;
    amount = [0];
    bought = [0];
    cycleStep = [0];
    unlocks = [];
    startStep = 0;
  }
  // Derivado de `bought` com a MESMA expressão da compra — determinístico.
  const nextCost = bought.map((b, i) => baseCost[i] * Math.pow(BUY_GROWTH, b));

  const totalSteps = Math.floor(horizonS / SIM_STEP_S);
  const snapshot = () => ({
    base,
    uptime,
    amount: [...amount],
    bought: [...bought],
    cycleStep: [...cycleStep],
  });

  // Heartbeat: checa o relógio 1x por dia simulado, emite a cada >=60s reais.
  const BEAT_CHECK_STEPS = 86400 / SIM_STEP_S;
  let beatCountdown = BEAT_CHECK_STEPS;
  let lastBeat = Date.now();

  let s = startStep;
  for (; s < totalSteps && unlocks.length < CAP; s++) {
    if (bought[0] > 0) uptime += SIM_STEP_S;

    if (onEvent && --beatCountdown === 0) {
      beatCountdown = BEAT_CHECK_STEPS;
      const now = Date.now();
      if (now - lastBeat >= 60_000) {
        lastBeat = now;
        onEvent({
          type: 'beat',
          simulatedS: s * SIM_STEP_S,
          horizonS,
          unlocks: [...unlocks],
          state: snapshot(),
        });
      }
    }

    for (let i = amount.length - 1; i >= 0; i--) {
      if (amount[i] <= 0) continue;
      cycleStep[i] += 1;
      if (cycleStep[i] >= cycleSteps[i]) {
        cycleStep[i] = 0;
        const out = amount[i] * prodPer[i];
        if (i === 0) base += out;
        else amount[i - 1] += out;
      }
    }

    // Candidatos: [last] ou [last, last-1] — sem alocar array no hot loop.
    const last = amount.length - 1;
    const lastLocked = bought[last] === 0;
    for (let c = 0; c < (lastLocked ? 2 : 1); c++) {
      const i = c === 0 ? last : last - 1;
      if (i < 0) continue;
      if (base < nextCost[i]) continue;
      const wasLocked = bought[i] === 0;
      base -= nextCost[i];
      bought[i] += 1;
      amount[i] += 1;
      nextCost[i] = baseCost[i] * Math.pow(BUY_GROWTH, bought[i]);
      if (wasLocked) {
        unlocks.push(uptime);
        onEvent?.({ type: 'unlock', gen: unlocks.length, uptime });
        if (i === last && amount.length < CAP) {
          amount.push(0);
          bought.push(0);
          cycleStep.push(0);
          nextCost.push(baseCost[amount.length - 1]);
        }
      }
      break;
    }
  }

  const complete = unlocks.length >= CAP;
  return {
    unlocks,
    simulatedS: s * SIM_STEP_S,
    // Linha completa dispensa estado (nunca mais precisa continuar).
    state: complete ? null : snapshot(),
  };
}

// ===== Worker: simula UMA linha (do zero ou retomando) =====
if (!isMainThread) {
  const { eco, horizonS, resume } = workerData;
  const result = simulateFast(eco, horizonS, (ev) => parentPort.postMessage(ev), resume);
  parentPort.postMessage({ type: 'done', ...result });
}

// ===== Formatadores =====
const fmt = (s) =>
  s == null
    ? '—'
    : s >= YEAR_S
      ? `${(s / YEAR_S).toFixed(1)}y`
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

// ===== Checkpoint (retomada incremental de rodadas) =====
// Formato por linha: { unlocks, simulatedS, state|null }. Invalida sozinho
// quando o balanceamento muda (fingerprint cobre tudo que afeta a conta).
const FINGERPRINT = JSON.stringify({ SIM_STEP_S, CAP, BUY_GROWTH, LINES });

function loadCheckpoint() {
  if (!existsSync(CHECKPOINT_PATH)) return { fingerprint: FINGERPRINT, lines: {} };
  try {
    const raw = JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf8'));
    if (raw.fingerprint !== FINGERPRINT) {
      console.log('  (checkpoint descartado: o balanceamento mudou desde a última rodada)');
      return { fingerprint: FINGERPRINT, lines: {} };
    }
    // Migração do formato antigo ({years, unlocks} — sem estado): mantém o
    // resultado para reuso/recorte; sem estado, extensão recomeça do zero.
    for (const [id, e] of Object.entries(raw.lines)) {
      if (e.years !== undefined && e.simulatedS === undefined) {
        raw.lines[id] = { unlocks: e.unlocks, simulatedS: e.years * YEAR_S, state: null };
      }
    }
    return raw;
  } catch {
    return { fingerprint: FINGERPRINT, lines: {} };
  }
}

// ===== Emissão dos dados da aba Simulada =====
function emit(resultByLine, years) {
  const out = [];
  out.push('/** GERADO por `node scripts/simulate-reino.mjs deep` — não editar à mão.');
  out.push('');
  out.push('    Tempos de desbloqueio (uptime, em segundos) do modo automático');
  out.push(`    estrito, por linha, simulados passo a passo num horizonte de`);
  out.push(`    ${years} anos — alimenta a aba Simulada da Atividade. Geradores`);
  out.push('    que não saem nesse horizonte ficam de fora (sem extrapolação).');
  out.push('    O motor é determinístico, então isto vale para qualquer save no');
  out.push('    automático. Regenere sempre que o balanceamento mudar. */');
  out.push('');
  out.push("import type { LineId } from '../components/Reino/lines';");
  out.push('');
  out.push(`export const SIM_HORIZON_YEARS = ${years};`);
  out.push('');
  out.push('export const SIMULATED_UNLOCKS: Record<LineId, number[]> = {');
  for (const eco of LINES) {
    out.push(`  ${eco.id}: [${resultByLine[eco.id].join(', ')}],`);
  }
  out.push('};');
  out.push('');
  writeFileSync(OUT_PATH, out.join('\n'));
}

// ===== Modo deep: paridade → reuso/retomada → workers → emissão =====
async function deep() {
  console.log('\n=== Paridade float × Decimal (72h, desbloqueios) ===');
  let allOk = true;
  for (const eco of LINES) {
    const dec = simulateDec(eco, FAST_HORIZON_S);
    const fast = simulateFast(eco, FAST_HORIZON_S).unlocks;
    const sameLen = dec.length === fast.length;
    let maxDiff = 0;
    if (sameLen)
      for (let i = 0; i < dec.length; i++)
        maxDiff = Math.max(maxDiff, Math.abs(dec[i] - fast[i]));
    const ok = sameLen && maxDiff < SIM_STEP_S;
    allOk &&= ok;
    console.log(
      `  ${eco.id.padEnd(10)} ${ok ? 'OK' : 'DIVERGIU'} (g${dec.length} vs g${fast.length}${sameLen ? `, Δmáx ${maxDiff.toFixed(2)}s` : ''})`
    );
  }
  if (!allOk) {
    console.log('  → paridade quebrada; NÃO emitindo dados. Investigue antes.');
    process.exit(1);
  }

  const checkpoint = loadCheckpoint();
  const persist = () => writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint));
  const horizonS = DEEP_YEARS * YEAR_S;
  const results = {};
  const pending = [];

  console.log(`\n=== Simulação profunda (${DEEP_YEARS} anos, automático estrito, linhas em paralelo) ===`);
  for (const eco of LINES) {
    const saved = checkpoint.lines[eco.id];
    if (saved && saved.unlocks.length === CAP) {
      results[eco.id] = saved.unlocks;
      console.log(`  ${eco.id}: reaproveitado do checkpoint — linha completa (20/20)`);
    } else if (saved && saved.simulatedS >= horizonS) {
      // Já simulamos além do pedido: recorte instantâneo dos desbloqueios.
      results[eco.id] = saved.unlocks.filter((t) => t < horizonS);
      console.log(
        `  ${eco.id}: reaproveitado do checkpoint — já simulado até ${fmt(saved.simulatedS)} (recorte para ${DEEP_YEARS} anos)`
      );
    } else if (saved && saved.state) {
      const yearsToDo = (horizonS - saved.simulatedS) / YEAR_S;
      const estMin = (yearsToDo * WALL_S_PER_LINE_YEAR) / 60;
      console.log(
        `  ${eco.id}: retomando de ${fmt(saved.simulatedS)} → ${DEEP_YEARS} anos (falta ${fmt(horizonS - saved.simulatedS)}, ~${estMin.toFixed(0)} min)`
      );
      pending.push({ eco, resume: { state: saved.state, unlocks: saved.unlocks, simulatedS: saved.simulatedS } });
    } else {
      const estMin = (DEEP_YEARS * WALL_S_PER_LINE_YEAR) / 60;
      console.log(`  ${eco.id}: simulando do zero (~${estMin.toFixed(0)} min)`);
      pending.push({ eco, resume: null });
    }
  }

  const t0 = Date.now();
  await Promise.all(
    pending.map(
      ({ eco, resume }) =>
        new Promise((resolve, reject) => {
          const worker = new Worker(fileURLToPath(import.meta.url), {
            workerData: { eco, horizonS, resume },
          });
          worker.on('message', (ev) => {
            if (ev.type === 'unlock') {
              console.log(`  ${eco.id}: g${ev.gen} em ${fmt(ev.uptime)}`);
            } else if (ev.type === 'beat') {
              // Snapshot periódico: uma interrupção perde no máximo ~60s.
              checkpoint.lines[eco.id] = {
                unlocks: ev.unlocks,
                simulatedS: ev.simulatedS,
                state: ev.state,
              };
              persist();
              const pct = ((100 * ev.simulatedS) / ev.horizonS).toFixed(0);
              console.log(`  ${eco.id}: … ${pct}% do horizonte simulado (${fmt(ev.simulatedS)})`);
            } else if (ev.type === 'done') {
              results[eco.id] = ev.unlocks;
              checkpoint.lines[eco.id] = {
                unlocks: ev.unlocks,
                simulatedS: ev.simulatedS,
                state: ev.state,
              };
              persist();
              console.log(`  ${eco.id}: pronto — g${ev.unlocks.length} em ${fmt(ev.unlocks[ev.unlocks.length - 1])}`);
              resolve();
            }
          });
          worker.on('error', reject);
        })
    )
  );
  if (pending.length > 0)
    console.log(`  (${pending.length} linha(s) simulada(s) em ${((Date.now() - t0) / 60000).toFixed(1)} min)`);

  console.log('\n=== Resultado ===');
  for (const eco of LINES) {
    const u = results[eco.id];
    const note = u.length < CAP ? `  (g${u.length + 1} não sai em ${DEEP_YEARS} anos)` : '';
    console.log(`\n### ${eco.id} — chegou a g${u.length} em ${fmt(u[u.length - 1])}${note}`);
    console.log(`    ${u.map((t, i) => `g${i + 1}:${fmt(t)}`).join('  ')}`);
  }

  emit(results, DEEP_YEARS);
  console.log(`\nDados emitidos em ${OUT_PATH}`);
}

// ===== Modo padrão: custos + ritmo em 72h (Decimal exato) =====
function standard() {
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

    const u = simulateDec(eco, FAST_HORIZON_S);
    console.log(`  Ritmo no automático (estrito, igual ao jogo): chegou a g${u.length} em ${fmt(u[u.length - 1])}`);
    console.log(`    ${u.map((t, i) => `g${i + 1}:${fmt(t)}`).join('  ')}`);
  }
}

if (isMainThread) {
  if (process.argv[2] === 'deep') deep();
  else standard();
}
