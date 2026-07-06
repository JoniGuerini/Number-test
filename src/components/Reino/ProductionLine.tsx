/** UI de UMA linha de produção do Reino. Componente controlado: recebe o
    estado da linha e callbacks do Reino (que é dono do loop e do save). A
    linguagem visual vem dos esqueletos compartilhados em src/styles
    (productionList/cycleBars) — o que muda é a coluna de nomes (geradores
    nomeados) e o recurso base. */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import HoldActionButton from '../HoldActionButton';
import Decimal from 'break_eternity.js';
import { fmt, fmtCost, fmtTime } from '../../lib/format';
import { getDateLocale, useI18n, type TKey } from '../../lib/locale';
import { getVideoPrefs, subscribeVideoPrefs } from '../../lib/prefs';
import styles from '../../styles/productionList.module.css';
import cyc from '../../styles/cycleBars.module.css';
import rn from './Reino.module.css';
import {
  SIM_STEP_S,
  cycleSecondsOf,
  cycleStepsOf,
  genPurchaseCost,
  prodPerCycleOf,
  type Gen,
  type Line,
  type LineEconomy,
} from './engine';
import type { LineId } from './lines';
import {
  cycleSecondsWithUpgrades,
  cycleStepsWithUpgrades,
  productionFactor,
  type UpgradeState,
} from './upgrades';

interface ProductionLineProps {
  line: Line;
  lineId: LineId;
  eco: LineEconomy;
  upgrades: UpgradeState;
  mandate: number;
  mandateCost: number;
  /** Âncora GLOBAL da simulação (linha comida): base de tempo das barras.
      A interpolação entre passos é imperativa (rAF local), fora do React. */
  anchorStartedAt: number | undefined;
  anchorSteps: number;
  onBuy: (i: number) => boolean;
  /** Alterna manual/automático do SAVE inteiro (o modo é global às linhas). */
  onToggleAuto: () => void;
}

/** Colunas do card do gerador nomeado: nome largo + 3 stats + botão.
    Inline porque precisa vencer o grid padrão de `.row` de forma confiável
    entre navegadores (o mobile cai para flex-column e ignora isto). */
const NAMED_ROW_COLS = '150px 110px 170px 150px 120px';

export default function ProductionLine({
  line,
  lineId,
  eco,
  upgrades,
  mandate,
  mandateCost,
  anchorStartedAt,
  anchorSteps,
  onBuy,
  onToggleAuto,
}: ProductionLineProps) {
  const { t } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const showCycleBars = useSyncExternalStore(
    subscribeVideoPrefs,
    () => getVideoPrefs().showCycleBars
  );

  const canBuyGen = (cost: Decimal): boolean =>
    line.base.gte(cost) && mandate >= mandateCost;

  const genName = (i: number): string => t(`reino.gen.${lineId}.${i + 1}` as TKey);
  const baseName = t(`reino.base.${lineId}` as TKey);

  const scrollAnimRef = useRef(0);
  const animateScroll = (getTarget: (el: HTMLDivElement) => number) => {
    const el = listRef.current;
    if (!el) return;
    const token = ++scrollAnimRef.current;
    const from = el.scrollTop;
    const start = performance.now();
    const DURATION_MS = 400;

    const step = (now: number) => {
      const list = listRef.current;
      if (!list || scrollAnimRef.current !== token) return;
      const p = Math.min((now - start) / DURATION_MS, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      list.scrollTop = from + (getTarget(list) - from) * ease;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const scrollToStart = () => animateScroll(() => 0);
  const scrollToEnd = () => animateScroll((el) => el.scrollHeight - el.clientHeight);

  const genCount = line.gens.length;
  useEffect(() => {
    scrollToEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genCount]);

  // Bordas do scroll por EVENTO (não por leitura de layout no render, que
  // forçava reflow síncrono). O scroll programático também dispara onScroll.
  const [edges, setEdges] = useState({ above: false, below: false });
  const updateEdges = () => {
    const el = listRef.current;
    if (!el) return;
    const above = el.scrollTop > 4;
    const below = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setEdges((prev) =>
      prev.above === above && prev.below === below ? prev : { above, below }
    );
  };
  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genCount]);

  const isAuto = line.mode === 'auto';

  const cycleStepsNeed = (i: number): number =>
    cycleStepsWithUpgrades(cycleStepsOf(i, eco), upgrades, lineId, i);

  const cycleSecondsNeed = (i: number): number =>
    cycleSecondsWithUpgrades(cycleSecondsOf(i, eco), upgrades, lineId, i);

  const prodPerCycleDisplay = (gen: Gen, i: number) =>
    gen.amount.mul(prodPerCycleOf(i, eco)).mul(productionFactor(upgrades, lineId, i));

  // ===== Animação das barras de ciclo (60fps, fora do React) =====
  // O React só renderiza quando a simulação avança (4x/s). Entre passos, um
  // rAF local escreve transform:scaleX direto nos elementos (compositor —
  // sem layout, sem paint em árvore, sem re-render). O estado mais recente
  // fica num ref para o loop ler sem depender de closure.
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animRef = useRef({
    gens: line.gens,
    needs: [] as number[],
    started: line.started,
    anchorStartedAt,
    anchorSteps,
  });
  animRef.current = {
    gens: line.gens,
    needs: line.gens.map((_, i) => cycleStepsNeed(i)),
    started: line.started,
    anchorStartedAt,
    anchorSteps,
  };

  useEffect(() => {
    if (!showCycleBars) return;
    let rafId: number;
    const tick = () => {
      const a = animRef.current;
      // Sem teto no partial: o commit do React chega 1–3 frames DEPOIS do
      // relógio cruzar a fronteira do passo; travar em SIM_STEP_S fazia a
      // barra congelar e pular 4x/s. Deixar correr é contínuo — quando o
      // estado chega, cycleStep sobe na mesma proporção em que partial cai.
      const partial =
        a.started && a.anchorStartedAt !== undefined
          ? Math.max(
              (Date.now() - a.anchorStartedAt) / 1000 -
                a.anchorSteps * SIM_STEP_S,
              0
            )
          : 0;
      for (let i = 0; i < a.gens.length; i++) {
        const el = barRefs.current[i];
        if (!el) continue;
        const gen = a.gens[i];
        const p = gen.amount.lte(0)
          ? 0
          : Math.min((gen.cycleStep + partial / SIM_STEP_S) / a.needs[i], 1);
        // Desliza o inner: -100% = vazio, 0 = cheio (recorte no wrapper).
        el.style.transform = `translateX(${(p - 1) * 100}%)`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [showCycleBars]);

  const dispUptime = line.uptime;

  // A tela de escolha de modo vive no Reino (o início é global ao save);
  // aqui a linha já chega iniciada.
  return (
    <div className={styles.wrap}>
      <div className={styles.corner}>
        <div className={styles.timePill}>
          <span className={styles.timeValue}>
            {line.startedAt !== undefined
              ? new Date(line.startedAt).toLocaleString(getDateLocale(), {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '—'}
          </span>
          <span className={styles.timeLabel}>{t('common.startLabel')}</span>
        </div>
        <div className={styles.timePill}>
          <span className={styles.timeValue}>{fmtTime(dispUptime)}</span>
          <span className={styles.timeLabel}>{t('common.time')}</span>
        </div>
        <div className={styles.timePill}>
          <span className={styles.timeValue}>{fmt(line.totalProduced)}</span>
          <span className={styles.timeLabel}>{t('common.produced')}</span>
        </div>
        <button
          className={`${styles.cornerBtn} ${isAuto ? styles.toggleOn : ''}`}
          onClick={onToggleAuto}
        >
          {t('gen.autoToggle', { state: isAuto ? 'on' : 'off' })}
        </button>
      </div>

      <div className={styles.listWrap}>
        {edges.above && (
          <button
            className={`${styles.fade} ${styles.fadeTop}`}
            onClick={scrollToStart}
            aria-label={t('common.toStart')}
          >
            ↑
          </button>
        )}

        <div className={styles.list} ref={listRef} onScroll={updateEdges}>
          {line.gens.map((gen, i) => {
            const cost = genPurchaseCost(i, gen.bought, eco, lineId, upgrades);
            const target = i === 0 ? baseName : genName(i - 1);

            if (gen.bought === 0) {
              const progress = Math.min(line.base.div(cost).toNumber(), 1);
              const canUnlock = progress >= 1 && canBuyGen(cost);
              return (
                <HoldActionButton
                  key={i}
                  className={`btn-primary ${styles.progressBtn} ${styles.unlockBtn}`}
                  disabled={!canUnlock}
                  onAction={() => onBuy(i)}
                >
                  <span
                    className={styles.progressFill}
                    style={{ width: `${progress * 100}%` }}
                    aria-hidden="true"
                  />
                  <span className={styles.progressLabel}>
                    {genName(i)} · {fmtCost(cost)}
                  </span>
                </HoldActionButton>
              );
            }

            const remaining = Math.max(
              cycleSecondsNeed(i) - gen.cycleStep * SIM_STEP_S,
              0
            );

            return (
              <div
                key={i}
                className={styles.row}
                style={{ gridTemplateColumns: NAMED_ROW_COLS }}
              >
                <span className={rn.genName}>{genName(i)}</span>

                <div className={styles.statsRow}>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>{t('gen.owns')}</span>
                    <span className={styles.statValue}>{fmt(gen.amount)}</span>
                  </div>

                  <div className={styles.stat}>
                    <span className={styles.statLabel}>
                      {t('gen.produces', { target })}
                    </span>
                    <span className={styles.statValue}>
                      +{fmt(prodPerCycleDisplay(gen, i))}{' '}
                      {t('cyc.perCycleSuffix')}
                    </span>
                  </div>

                  <div className={styles.stat}>
                    <span className={styles.statLabel}>
                      {t('cyc.cycleEvery', {
                        time: fmtTime(cycleSecondsNeed(i)),
                      })}
                    </span>
                    <span className={styles.statValue}>
                      {fmtTime(Math.ceil(remaining))}
                    </span>
                  </div>
                </div>

                <HoldActionButton
                  className="btn-primary"
                  disabled={!canBuyGen(cost)}
                  onAction={() => onBuy(i)}
                >
                  {fmtCost(cost)}
                </HoldActionButton>

                {showCycleBars && (
                  <div className={cyc.cycleTrack} aria-hidden="true">
                    <div className={cyc.cycleGroove} />
                    {/* transform do inner escrito pelo rAF local — sem style
                        no JSX para o React nunca disputar o atributo. */}
                    <div className={cyc.cycleFill}>
                      <div
                        className={cyc.cycleFillInner}
                        ref={(el) => {
                          barRefs.current[i] = el;
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {edges.below && (
          <button
            className={`${styles.fade} ${styles.fadeBottom}`}
            onClick={scrollToEnd}
            aria-label={t('common.toEnd')}
          >
            ↓
          </button>
        )}
      </div>
    </div>
  );
}
