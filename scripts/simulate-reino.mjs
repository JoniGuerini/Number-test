// Tuning das linhas de produção do Reino (20 geradores, teto finito).
// Espelha exatamente src/components/Reino/engine.ts — batelada por ciclo,
// passo fixo de 0.25s e o modo automático ESTRITO do jogo (desbloqueia o
// próximo gerador ou empilha o mais alto desbloqueado) — e o balanceamento
// por linha de src/components/Reino/lines.ts.
//
// Uso:
//   node scripts/simulate-reino.mjs                → custos + ritmo em 72h
//                                                    (Decimal, espelho do engine)
//   node scripts/simulate-reino.mjs deep [anos]    → simulação profunda
//     INTERATIVA (padrão 15 anos): mostra o status de cada linha, pergunta
//     antes de simular cada uma (S/n/q), roda com barra de progresso + ETA
//     e salva o checkpoint ao fim de cada linha. Reaproveita tudo que já
//     foi simulado (linhas completas, recortes e retomadas de estado) e
//     regenera src/data/simulatedUnlocks.ts ao final.
//   … deep [anos] --yes                            → sem perguntas (CI/lote)
//
// A paridade float×Decimal (prova de que a simulação rápida espelha o motor)
// roda só quando o balanceamento muda — o resultado fica cacheado no
// checkpoint por fingerprint. SIM_OUT=<path> desvia a emissão do .ts.
import Decimal from 'break_eternity.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import readline from 'node:readline/promises';
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
const AUTO_YES = process.argv.includes('--yes') || process.argv.includes('-y');

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
// jogo cabem folgados em 1.8e308). Paridade contra o Decimal é verificada
// sempre que o balanceamento muda, antes de confiar no resultado profundo.
//
// `resume` (opcional) continua uma simulação anterior a partir do estado
// salvo — como a continuação é função pura do estado, o resultado é idêntico
// ao de simular tudo do zero. `onEvent` emite desbloqueios e um heartbeat
// frequente com snapshot do estado (progresso ao vivo + checkpoint).
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

  // Heartbeat: checa o relógio 1x por dia simulado; emite a cada >=250ms
  // reais (alimenta a barra de progresso e o checkpoint).
  const BEAT_CHECK_STEPS = 86400 / SIM_STEP_S;
  let beatCountdown = BEAT_CHECK_STEPS;
  let lastBeat = Date.now();

  let s = startStep;
  for (; s < totalSteps && unlocks.length < CAP; s++) {
    if (bought[0] > 0) uptime += SIM_STEP_S;

    if (onEvent && --beatCountdown === 0) {
      beatCountdown = BEAT_CHECK_STEPS;
      const now = Date.now();
      if (now - lastBeat >= 250) {
        lastBeat = now;
        onEvent({ type: 'beat', simulatedS: s * SIM_STEP_S, horizonS, unlocks: [...unlocks], state: snapshot() });
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

// ===== Formatadores e cosmética de terminal =====
const TTY = Boolean(process.stdout.isTTY);
const paint = (code, s) => (TTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => paint(1, s);
const dim = (s) => paint(2, s);
const green = (s) => paint(32, s);
const yellow = (s) => paint(33, s);
const brass = (s) => paint(36, s);

/** Tempo DE JOGO (simulado): 45s · 2.8m · 1.3h · 5.4d · 12.8y */
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

/** Tempo DE PAREDE (execução): 12s · 3m 05s · 1h 12m */
function fmtWall(sec) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${(s % 60).toString().padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${(m % 60).toString().padStart(2, '0')}m`;
}

// Formatador de número curto (K, M, B…) só para a tabela de custos.
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
function n(dec) {
  if (dec.lt(1000)) return Math.round(dec.toNumber()).toString();
  const exp = Math.floor(dec.log10().toNumber());
  const tier = Math.floor(exp / 3);
  const scaled = dec.div(Decimal.pow(10, tier * 3)).toNumber();
  return (scaled < 100 ? scaled.toFixed(1) : Math.floor(scaled)) + (SUF[tier] ?? 'e' + tier * 3);
}

// ===== Nomes dos geradores/linhas (extraídos de src/lib/locale/pt.ts) =====
// Parse leve por regex: mantém o script sempre em dia com os nomes do jogo
// sem duplicá-los aqui. Se algo falhar, cai no "g7" genérico.
function loadNames() {
  const names = { gens: {}, lines: {} };
  try {
    const src = readFileSync(join(HERE, '../src/lib/locale/pt.ts'), 'utf8');
    for (const m of src.matchAll(/'reino\.gen\.(\w+)\.(\d+)':\s*'([^']+)'/g)) {
      (names.gens[m[1]] ??= {})[Number(m[2])] = m[3];
    }
    for (const m of src.matchAll(/'reino\.line\.(\w+)':\s*'([^']+)'/g)) {
      names.lines[m[1]] = m[2];
    }
  } catch {
    // segue sem nomes
  }
  return names;
}
const NAMES = loadNames();
const lineName = (id) => NAMES.lines[id] ?? id;
const genName = (id, g) => NAMES.gens[id]?.[g] ?? `g${g}`;

// ===== Checkpoint (retomada incremental de rodadas) =====
// Formato por linha: { unlocks, simulatedS, state|null }. `parityFingerprint`
// registra que a paridade já foi verificada para este balanceamento.
// Invalida sozinho quando o balanceamento muda.
const FINGERPRINT = JSON.stringify({ SIM_STEP_S, CAP, BUY_GROWTH, LINES });

function loadCheckpoint() {
  if (!existsSync(CHECKPOINT_PATH)) return { fingerprint: FINGERPRINT, lines: {} };
  try {
    const raw = JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf8'));
    if (raw.fingerprint !== FINGERPRINT) {
      console.log(dim('  checkpoint descartado: o balanceamento mudou desde a última rodada'));
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

/** Lê os arrays do simulatedUnlocks.ts ATUAL do app (fallback para linhas
    puladas/encerradas sem nada no checkpoint — nunca regredir dado bom). */
function loadExistingData() {
  const data = {};
  try {
    const src = readFileSync(join(HERE, '../src/data/simulatedUnlocks.ts'), 'utf8');
    for (const m of src.matchAll(/^\s*(\w+): \[([^\]]*)\],$/gm)) {
      data[m[1]] = m[2].trim() === '' ? [] : m[2].split(',').map(Number);
    }
  } catch {
    // sem arquivo anterior — segue sem fallback
  }
  return data;
}

/** "1 ano" / "15 anos" */
const anos = (n) => `${n} ano${n === 1 ? '' : 's'}`;

// ===== Emissão dos dados da aba Simulada =====
function emit(resultByLine, years) {
  const out = [];
  out.push('/** GERADO por `node scripts/simulate-reino.mjs deep` — não editar à mão.');
  out.push('');
  out.push('    Tempos de desbloqueio (uptime, em segundos) do modo automático');
  out.push(`    estrito, por linha, simulados passo a passo num horizonte de`);
  out.push(`    ${anos(years)} — alimenta a aba Simulada da Atividade. Geradores`);
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
    out.push(`  ${eco.id}: [${(resultByLine[eco.id] ?? []).join(', ')}],`);
  }
  out.push('};');
  out.push('');
  writeFileSync(OUT_PATH, out.join('\n'));
}

// ===== Barra de progresso de UMA linha (modo interativo, sequencial) =====
function makeProgress(label, id, startS, horizonS, lastUnlockAt) {
  const t0 = Date.now();
  let lastDraw = 0;
  let prevUnlock = lastUnlockAt;
  const BAR_W = 26;

  const draw = (simulatedS, final = false) => {
    const now = Date.now();
    if (!final && now - lastDraw < (TTY ? 120 : 60_000)) return;
    lastDraw = now;
    const frac = Math.min(simulatedS / horizonS, 1);
    const newFrac = Math.min((simulatedS - startS) / Math.max(horizonS - startS, 1), 1);
    const elapsed = (now - t0) / 1000;
    const eta = newFrac > 0.02 ? elapsed / newFrac - elapsed : null;
    const fill = Math.round(BAR_W * frac);
    const bar = brass('█'.repeat(fill)) + dim('░'.repeat(BAR_W - fill));
    const line = `  ${bar}  ${String(Math.floor(frac * 100)).padStart(3)}%  ${fmt(simulatedS)} ${dim('de')} ${fmt(horizonS)}${eta !== null ? `  ${dim('· resta ~' + fmtWall(eta))}` : ''}`;
    if (TTY) process.stdout.write(`\r\x1b[K${line}`);
    else console.log(line);
  };

  return {
    beat: (ev) => draw(ev.simulatedS),
    unlock: (ev) => {
      const delta = ev.uptime - prevUnlock;
      prevUnlock = ev.uptime;
      if (TTY) process.stdout.write('\r\x1b[K');
      console.log(
        `  ${green('✦')} g${String(ev.gen).padStart(2)} ${bold(genName(id, ev.gen).padEnd(22))} ${fmt(ev.uptime).padStart(7)} de jogo  ${dim(ev.gen === 1 ? 'início' : `+${fmt(delta)} desde o anterior`)}`
      );
    },
    finish: (reached, lastAt) => {
      if (TTY) process.stdout.write('\r\x1b[K');
      const took = fmtWall((Date.now() - t0) / 1000);
      const status = reached >= CAP ? green(`✓ completa (20/20)`) : yellow(`↻ parou em g${reached}`);
      console.log(`  ${status} ${dim(`· último desbloqueio ${fmt(lastAt)} · ${took} de execução`)}\n`);
    },
  };
}

// ===== Modo deep interativo =====
async function deep() {
  const horizonS = DEEP_YEARS * YEAR_S;
  const checkpoint = loadCheckpoint();
  const persist = () => writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint));

  console.log(bold(`\nSimulação profunda do Reino — automático estrito, horizonte de ${anos(DEEP_YEARS)}`));

  // Paridade float × Decimal: prova de que a sim rápida espelha o motor.
  // Roda uma vez por balanceamento (cacheada por fingerprint no checkpoint).
  if (checkpoint.parityFingerprint !== FINGERPRINT) {
    process.stdout.write(dim('verificando paridade float × Decimal (só quando o balanceamento muda)… '));
    for (const eco of LINES) {
      const dec = simulateDec(eco, FAST_HORIZON_S);
      const fast = simulateFast(eco, FAST_HORIZON_S).unlocks;
      const ok =
        dec.length === fast.length &&
        dec.every((t, i) => Math.abs(t - fast[i]) < SIM_STEP_S);
      if (!ok) {
        console.log(`\n  ${lineName(eco.id)}: DIVERGIU (g${dec.length} vs g${fast.length}) — NÃO emitindo dados. Investigue antes.`);
        process.exit(1);
      }
    }
    checkpoint.parityFingerprint = FINGERPRINT;
    persist();
    console.log(green('ok'));
  } else {
    console.log(dim('paridade float × Decimal: ok (cacheada para este balanceamento)'));
  }

  // Status de cada linha frente ao horizonte pedido.
  console.log('');
  const plans = [];
  for (const eco of LINES) {
    const saved = checkpoint.lines[eco.id];
    const label = lineName(eco.id).padEnd(11);
    if (saved && saved.unlocks.length === CAP) {
      console.log(`  ${green('✓')} ${bold(label)} ${dim(`completa (20/20 em ${fmt(saved.unlocks[CAP - 1])}) — nada a fazer`)}`);
      plans.push({ eco, kind: 'done', unlocks: saved.unlocks });
    } else if (saved && saved.simulatedS >= horizonS) {
      console.log(`  ${green('✓')} ${bold(label)} ${dim(`já simulada até ${fmt(saved.simulatedS)} (g${saved.unlocks.length}) — recorte instantâneo`)}`);
      plans.push({ eco, kind: 'cut', unlocks: saved.unlocks.filter((t) => t < horizonS) });
    } else if (saved && saved.state) {
      const missing = horizonS - saved.simulatedS;
      console.log(
        `  ${yellow('↻')} ${bold(label)} ${dim(`parcial: g${saved.unlocks.length} até ${fmt(saved.simulatedS)} — falta ${fmt(missing)} (~${fmtWall((missing / YEAR_S) * WALL_S_PER_LINE_YEAR)})`)}`
      );
      plans.push({ eco, kind: 'resume', saved });
    } else {
      console.log(
        `  ${dim('•')} ${bold(label)} ${dim(`sem dados — simular ${anos(DEEP_YEARS)} do zero (~${fmtWall(DEEP_YEARS * WALL_S_PER_LINE_YEAR)})`)}`
      );
      plans.push({ eco, kind: 'fresh' });
    }
  }
  console.log('');

  const rl = AUTO_YES ? null : readline.createInterface({ input: process.stdin, output: process.stdout });
  let rlClosed = false;
  rl?.on('close', () => {
    rlClosed = true;
  });
  /** Pergunta com tolerância a EOF/fechamento (pipe esgotado, Ctrl+D):
      devolve null quando não há mais como perguntar. */
  const ask = async (q) => {
    if (!rl || rlClosed) return null;
    try {
      return await rl.question(q);
    } catch {
      return null;
    }
  };
  const results = {};
  let aborted = false;

  for (const plan of plans) {
    const { eco } = plan;
    if (plan.kind === 'done' || plan.kind === 'cut') {
      results[eco.id] = plan.unlocks;
      continue;
    }
    if (aborted) continue;

    // Pergunta antes de cada linha (Enter/s = sim, n = pula, q = encerra).
    if (rl) {
      const verb = plan.kind === 'resume' ? 'Continuar' : 'Simular';
      const raw = await ask(bold(`▶ ${verb} a linha ${lineName(eco.id)}?`) + dim(' [S/n/q] '));
      if (raw === null) {
        aborted = true;
        console.log(dim('\n  entrada encerrada — parando por aqui (o que já foi simulado está salvo)\n'));
        continue;
      }
      const ans = raw.trim().toLowerCase();
      if (ans === 'q') {
        aborted = true;
        console.log(dim('  encerrando — o que já foi simulado está salvo no checkpoint\n'));
        continue;
      }
      if (ans === 'n' || ans === 'nao' || ans === 'não') {
        console.log(dim(`  ${lineName(eco.id)} pulada\n`));
        continue;
      }
    }

    const resume =
      plan.kind === 'resume'
        ? { state: plan.saved.state, unlocks: plan.saved.unlocks, simulatedS: plan.saved.simulatedS }
        : null;

    console.log(bold(`\n${lineName(eco.id)}`) + dim(` — ${resume ? `retomando de ${fmt(resume.simulatedS)}` : 'do zero'} até ${anos(DEEP_YEARS)}`));
    // Desbloqueios já conhecidos (contexto ao retomar)
    if (resume) {
      for (let g = 1; g <= resume.unlocks.length; g++) {
        console.log(dim(`  · g${String(g).padStart(2)} ${genName(eco.id, g).padEnd(22)} ${fmt(resume.unlocks[g - 1]).padStart(7)} de jogo`));
      }
    }

    const progress = makeProgress(
      lineName(eco.id),
      eco.id,
      resume?.simulatedS ?? 0,
      horizonS,
      resume?.unlocks[resume.unlocks.length - 1] ?? 0
    );

    let lastPersist = Date.now();
    await new Promise((resolve, reject) => {
      const worker = new Worker(fileURLToPath(import.meta.url), {
        workerData: { eco, horizonS, resume },
      });
      worker.on('message', (ev) => {
        if (ev.type === 'unlock') {
          progress.unlock(ev);
        } else if (ev.type === 'beat') {
          progress.beat(ev);
          // Snapshot periódico: uma interrupção perde no máximo ~5s.
          const now = Date.now();
          if (now - lastPersist >= 5000) {
            lastPersist = now;
            checkpoint.lines[eco.id] = { unlocks: ev.unlocks, simulatedS: ev.simulatedS, state: ev.state };
            persist();
          }
        } else if (ev.type === 'done') {
          results[eco.id] = ev.unlocks;
          checkpoint.lines[eco.id] = { unlocks: ev.unlocks, simulatedS: ev.simulatedS, state: ev.state };
          persist();
          progress.finish(ev.unlocks.length, ev.unlocks[ev.unlocks.length - 1]);
          resolve();
        }
      });
      worker.on('error', reject);
    });
  }
  rl?.close();

  // Linhas puladas/encerradas: emite com o que houver — checkpoint ou, na
  // falta dele, os dados que o app já tem hoje (nunca regredir dado bom).
  const existing = loadExistingData();
  for (const eco of LINES) {
    if (results[eco.id]) continue;
    const saved = checkpoint.lines[eco.id];
    if (saved) {
      results[eco.id] = saved.unlocks.filter((t) => t < horizonS);
    } else if (existing[eco.id]?.length) {
      results[eco.id] = existing[eco.id];
      console.log(dim(`  ${lineName(eco.id)}: mantendo os dados atuais do app (nada novo simulado)`));
    } else {
      results[eco.id] = [];
      console.log(dim(`  aviso: ${lineName(eco.id)} sem nenhum dado — vai vazia para a aba Simulada`));
    }
  }

  // Resumo final compacto.
  console.log(bold('\nResumo'));
  for (const eco of LINES) {
    const u = results[eco.id];
    const label = lineName(eco.id).padEnd(11);
    if (u.length === 0) {
      console.log(`  ${dim('•')} ${bold(label)} ${dim('sem dados')}`);
      continue;
    }
    const status = u.length >= CAP ? green('✓') : yellow('↻');
    console.log(
      `  ${status} ${bold(label)} g${u.length}${u.length >= CAP ? '' : `/${CAP}`} ${dim(`· último em ${fmt(u[u.length - 1])} · ${u.map((t, i) => `g${i + 1}:${fmt(t)}`).slice(-3).join('  ')}`)}`
    );
  }

  emit(results, DEEP_YEARS);
  console.log(dim(`\nDados emitidos em ${OUT_PATH}\n`));
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
