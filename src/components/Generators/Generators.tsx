import { useEffect, useRef, useState } from 'react';
import Decimal from 'break_eternity.js';
import { fmt, fmtRate, fmtTime } from '../../lib/format';
import { GENERATORS_SAVE_KEY, loadSave, writeSave } from '../../lib/storage';
import styles from './Generators.module.css';

interface Gen {
  /** Total possuído (comprados + produzidos pelo gerador seguinte). */
  amount: Decimal;
  /** Unidades compradas manualmente — só elas encarecem o custo. */
  bought: number;
  /** Tempo de jogo (em segundos) em que a primeira unidade foi comprada. */
  unlockedAt?: number;
}

type Mode = 'manual' | 'auto';

interface Game {
  base: Decimal;
  gens: Gen[];
  mode: Mode;
  /** false = ainda na tela de escolha de modo. */
  started: boolean;
  /** Tempo de jogo em segundos (conta a partir da 1ª compra do Gerador 1). */
  uptime: number;
}

interface GenSave {
  base: string;
  gens: { amount: string; bought: number; unlockedAt?: number }[];
  uptime: number;
  mode?: Mode;
  started?: boolean;
}

const START_BASE = new Decimal(1);

/** Cada unidade de um gerador produz 0.1 do nível anterior por segundo. */
const PROD_PER_UNIT = new Decimal(0.1);

const newGen = (): Gen => ({ amount: new Decimal(0), bought: 0 });

function loadGame(): Game {
  const s = loadSave<GenSave>(GENERATORS_SAVE_KEY);
  if (!s || s.gens.length === 0) {
    return {
      base: START_BASE,
      gens: [newGen()],
      mode: 'manual',
      started: false,
      uptime: 0,
    };
  }
  return {
    base: new Decimal(s.base),
    gens: s.gens.map((g) => ({
      amount: new Decimal(g.amount),
      bought: g.bought,
      unlockedAt: g.unlockedAt,
    })),
    mode: s.mode ?? 'manual',
    // Saves antigos (sem o campo) já estavam em jogo.
    started: s.started ?? true,
    uptime: s.uptime,
  };
}

/** Agressividade da curva de custos: cada tier custa 10^(2c) a mais que o
    degrau anterior, fazendo o intervalo entre desbloqueios crescer ~2-3% por
    gerador (dobra a cada ~30). Tunado via scripts/simulate-balance.mjs. */
const COST_CURVE = 0.004;

/** Custo do gerador N (índice i): 10^(i + c·i²), dobrando a cada compra.
    O termo quadrático faz cada desbloqueio demorar mais que o anterior.
    O round() corrige o erro de ponto flutuante do pow do break_eternity
    (2^3 sai como 7.999...), já que custos são sempre inteiros. */
function costOf(i: number, bought: number): Decimal {
  return Decimal.pow(10, i + COST_CURVE * i * i)
    .mul(Decimal.pow(2, bought))
    .round();
}

/** Resolução máxima de cada passo de simulação. Frames normais (~16ms) rodam
    em passo único; um dt gigante (aba que ficou oculta) é dividido em subpassos
    para o crescimento composto e as compras automáticas saírem corretos. */
const MAX_STEP_S = 0.25;
/** Teto de subpassos por frame (~83min de ausência em resolução plena; além
    disso o passo cresce para não travar a UI no retorno). */
const MAX_STEPS_PER_TICK = 20_000;

/** Avança a simulação em dt segundos. Função pura: não muta o estado anterior. */
function advance(g: Game, dt: number): Game {
  const gens = g.gens.map((x) => ({ ...x }));
  let base = g.base;
  let uptime = g.uptime;

  const steps = Math.min(Math.max(1, Math.ceil(dt / MAX_STEP_S)), MAX_STEPS_PER_TICK);
  const stepDt = dt / steps;

  for (let s = 0; s < steps; s++) {
    if (gens[0].bought > 0) uptime += stepDt;

    // Cada unidade do gerador N produz 0.1 do gerador N-1 por segundo.
    for (let i = gens.length - 1; i >= 1; i--) {
      gens[i - 1].amount = gens[i - 1].amount.add(
        gens[i].amount.mul(PROD_PER_UNIT).mul(stepDt)
      );
    }
    base = base.add(gens[0].amount.mul(PROD_PER_UNIT).mul(stepDt));

    // Modo automático: compra 1x o próximo gerador assim que alcançar o custo.
    if (g.mode === 'auto') {
      const last = gens.length - 1;
      const cost = costOf(last, 0);
      if (gens[last].bought === 0 && base.gte(cost)) {
        base = base.sub(cost);
        gens[last].bought = 1;
        gens[last].amount = gens[last].amount.add(1);
        gens[last].unlockedAt = uptime;
        gens.push(newGen());
      }
    }
  }

  return { ...g, base, gens, uptime };
}

export default function Generators() {
  const [game, setGame] = useState<Game>(loadGame);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToStart = () =>
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToEnd = () =>
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    });

  // Um gerador novo apareceu → rola a lista até ele para não perder a referência.
  const genCount = game.gens.length;
  useEffect(() => {
    scrollToEnd();
  }, [genCount]);

  // Indica se há conteúdo além das bordas visíveis da lista (acima/abaixo).
  const [edges, setEdges] = useState({ above: false, below: false });
  const updateEdges = () => {
    const el = listRef.current;
    if (!el) return;
    const above = el.scrollTop > 4;
    const below = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setEdges((e) => (e.above === above && e.below === below ? e : { above, below }));
  };
  useEffect(() => {
    updateEdges();
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genCount, game.started]);

  // Save automático: 1x por segundo e ao fechar/recarregar a página.
  const saveRef = useRef(game);
  saveRef.current = game;
  useEffect(() => {
    const persist = () => {
      const g = saveRef.current;
      writeSave(GENERATORS_SAVE_KEY, {
        base: g.base.toString(),
        gens: g.gens.map((x) => ({
          amount: x.amount.toString(),
          bought: x.bought,
          unlockedAt: x.unlockedAt,
        })),
        uptime: g.uptime,
        mode: g.mode,
        started: g.started,
      } satisfies GenSave);
    };
    const id = setInterval(persist, 1000);
    window.addEventListener('beforeunload', persist);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', persist);
    };
  }, []);

  useEffect(() => {
    let rafId: number;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      setGame((g) => (g.started ? advance(g, dt) : g));

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const buy = (i: number) => {
    setGame((g) => {
      const cost = costOf(i, g.gens[i].bought);
      if (g.base.lt(cost)) return g;

      const gens = g.gens.map((x) => ({ ...x }));
      gens[i].bought += 1;
      gens[i].amount = gens[i].amount.add(1);
      if (gens[i].bought === 1) gens[i].unlockedAt = g.uptime;
      // Primeira compra do último gerador desbloqueia o próximo.
      if (i === g.gens.length - 1) gens.push(newGen());

      return { ...g, base: g.base.sub(cost), gens };
    });
  };

  const isAuto = game.mode === 'auto';

  /** Baixa um .csv com a progressão atual: metadados + uma linha por gerador,
      com valores brutos (análise) e formatados (leitura). */
  const exportCsv = () => {
    const lines: string[] = [];

    lines.push('chave,valor');
    lines.push(`tempo_de_jogo_s,${game.uptime.toFixed(1)}`);
    lines.push(`tempo_de_jogo_fmt,${fmtTime(game.uptime)}`);
    lines.push(`modo,${game.mode}`);
    lines.push(`numero_base,${game.base.toString()}`);
    lines.push(`numero_base_fmt,${fmt(game.base)}`);
    lines.push(
      `producao_base_por_s,${game.gens[0].amount.mul(PROD_PER_UNIT).toString()}`
    );
    lines.push('');

    lines.push(
      'gerador,comprados,possui,possui_fmt,produz_por_s,produz_fmt,desbloqueio_s,desbloqueio_fmt,delta_desde_anterior_s,delta_fmt,aceleracao_s'
    );
    game.gens.forEach((gen, i) => {
      const prod = gen.amount.mul(PROD_PER_UNIT);
      const prev = i === 0 ? 0 : game.gens[i - 1].unlockedAt;
      const prevPrev = i <= 1 ? 0 : game.gens[i - 2].unlockedAt;
      const delta =
        gen.unlockedAt !== undefined && prev !== undefined
          ? gen.unlockedAt - prev
          : undefined;
      const prevDelta =
        prev !== undefined && prevPrev !== undefined ? prev - prevPrev : undefined;
      const accel =
        delta !== undefined && prevDelta !== undefined
          ? delta - prevDelta
          : undefined;

      lines.push(
        [
          i + 1,
          gen.bought,
          gen.amount.toString(),
          fmt(gen.amount),
          prod.toString(),
          fmtRate(prod),
          gen.unlockedAt !== undefined ? gen.unlockedAt.toFixed(1) : '',
          gen.unlockedAt !== undefined ? fmtTime(gen.unlockedAt) : '',
          delta !== undefined ? delta.toFixed(1) : '',
          delta !== undefined ? fmtTime(delta) : '',
          accel !== undefined ? accel.toFixed(1) : '',
        ].join(',')
      );
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geradores-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Tela de escolha de modo (aparece com save resetado, antes de iniciar)
  if (!game.started) {
    return (
      <div className={styles.modeScreen}>
        <div className={styles.modeCard}>
          <h2 className={styles.modeTitle}>Modo de jogo</h2>
          <div className={styles.modeOptions}>
            <button
              className={`${styles.modeBtn} ${!isAuto ? styles.modeActive : ''}`}
              onClick={() => setGame((g) => ({ ...g, mode: 'manual' }))}
            >
              Manual
            </button>
            <button
              className={`${styles.modeBtn} ${isAuto ? styles.modeActive : ''}`}
              onClick={() => setGame((g) => ({ ...g, mode: 'auto' }))}
            >
              Automático
            </button>
          </div>
          <p className={styles.modeHint}>
            {isAuto
              ? 'O jogo compra sozinho 1 unidade de cada gerador assim que alcançar o custo.'
              : 'Você faz todas as compras manualmente.'}
          </p>
          <button
            className="btn-primary"
            onClick={() => setGame((g) => ({ ...g, started: true }))}
          >
            Iniciar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.corner}>
        <div className={styles.timePill}>
          <span className={styles.timeValue}>{fmtTime(game.uptime)}</span>
          <span className={styles.timeLabel}>tempo</span>
        </div>
        <button className={styles.exportBtn} onClick={exportCsv}>
          Exportar CSV
        </button>
        <button
          className={`${styles.exportBtn} ${isAuto ? styles.toggleOn : ''}`}
          onClick={() =>
            setGame((g) => ({ ...g, mode: g.mode === 'auto' ? 'manual' : 'auto' }))
          }
        >
          Automático: {isAuto ? 'on' : 'off'}
        </button>
      </div>

      <div className={styles.baseBlock}>
        <span className={styles.baseLabel}>número base</span>
        <span className={styles.baseValue}>{fmt(game.base)}</span>
        <span className={styles.baseRate}>
          +{fmtRate(game.gens[0].amount.mul(PROD_PER_UNIT))} / s
        </span>
      </div>

      <div className={styles.listWrap}>
        {edges.above && (
          <button
            className={`${styles.fade} ${styles.fadeTop}`}
            onClick={scrollToStart}
            aria-label="Ir para o começo"
          >
            ↑
          </button>
        )}

        <div className={styles.list} ref={listRef} onScroll={updateEdges}>
          {game.gens.map((gen, i) => {
          const cost = costOf(i, gen.bought);
          const target = i === 0 ? 'base' : `${i}`;

          // Gerador recém-desbloqueado (nunca comprado): só o botão, centralizado,
          // com barra de progresso mostrando o quão perto o jogador está do custo.
          if (gen.bought === 0) {
            const progress = Math.min(game.base.div(cost).toNumber(), 1);
            return (
              <div key={i} className={`${styles.row} ${styles.rowLocked}`}>
                <button
                  className={`btn-primary ${styles.progressBtn}`}
                  disabled={isAuto || progress < 1}
                  onClick={() => buy(i)}
                >
                  <span
                    className={styles.progressFill}
                    style={{ width: `${progress * 100}%` }}
                    aria-hidden="true"
                  />
                  <span className={styles.progressLabel}>{fmt(cost)}</span>
                </button>
              </div>
            );
          }

          const prevUnlockedAt = i === 0 ? 0 : game.gens[i - 1].unlockedAt;
          const prevPrevUnlockedAt = i <= 1 ? 0 : game.gens[i - 2].unlockedAt;
          const delta =
            gen.unlockedAt !== undefined && prevUnlockedAt !== undefined
              ? gen.unlockedAt - prevUnlockedAt
              : undefined;
          // Diferença entre o intervalo deste desbloqueio e o do anterior
          const prevDelta =
            prevUnlockedAt !== undefined && prevPrevUnlockedAt !== undefined
              ? prevUnlockedAt - prevPrevUnlockedAt
              : undefined;
          const accel =
            delta !== undefined && prevDelta !== undefined
              ? delta - prevDelta
              : undefined;

          let unlockText = '—';
          if (gen.unlockedAt !== undefined) {
            const parts = [fmtTime(gen.unlockedAt)];
            if (delta !== undefined) parts.push(`+${fmtTime(delta)}`);
            if (accel !== undefined)
              parts.push(`${accel < 0 ? '−' : '+'}${fmtTime(Math.abs(accel))}`);
            unlockText = parts.join(' · ');
          }

          return (
            <div key={i} className={styles.row}>
              <span className={styles.genName}>{i + 1}</span>

              <div className={styles.stat}>
                <span className={styles.statLabel}>possui</span>
                <span className={styles.statValue}>{fmt(gen.amount)}</span>
              </div>

              <div className={styles.stat}>
                <span className={styles.statLabel}>produz {target}</span>
                <span className={styles.statValue}>
                  +{fmtRate(gen.amount.mul(PROD_PER_UNIT))} / s
                </span>
              </div>

              <div className={styles.stat}>
                <span className={styles.statLabel}>desbloqueio</span>
                <span className={styles.statValue}>{unlockText}</span>
              </div>

              <button
                className="btn-primary"
                disabled={isAuto || game.base.lt(cost)}
                onClick={() => buy(i)}
              >
                {fmt(cost)}
              </button>
            </div>
          );
          })}
        </div>

        {edges.below && (
          <button
            className={`${styles.fade} ${styles.fadeBottom}`}
            onClick={scrollToEnd}
            aria-label="Ir para o fim"
          >
            ↓
          </button>
        )}
      </div>
    </div>
  );
}
