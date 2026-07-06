/** UI de UMA linha de produção do Reino. Componente controlado: recebe o
    estado da linha e callbacks do Reino (que é dono do loop e do save). A
    linguagem visual vem dos esqueletos compartilhados em src/styles
    (productionList/cycleBars) — o que muda é a coluna de nomes (geradores
    nomeados) e o recurso base. */

import { useEffect, useRef, useSyncExternalStore } from 'react';
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

  // Bordas recalculadas a cada render (o Reino re-renderiza todo frame).
  const listEl = listRef.current;
  const edges = {
    above: !!listEl && listEl.scrollTop > 4,
    below:
      !!listEl && listEl.scrollTop + listEl.clientHeight < listEl.scrollHeight - 4,
  };

  const isAuto = line.mode === 'auto';

  // Fração de segundo desde o último passo — anima as barras entre passos.
  const partial =
    line.started && line.startedAt !== undefined
      ? Math.min(
          Math.max((Date.now() - line.startedAt) / 1000 - line.steps * SIM_STEP_S, 0),
          SIM_STEP_S
        )
      : 0;

  const cycleStepsNeed = (i: number): number =>
    cycleStepsWithUpgrades(cycleStepsOf(i, eco), upgrades, lineId, i);

  const cycleSecondsNeed = (i: number): number =>
    cycleSecondsWithUpgrades(cycleSecondsOf(i, eco), upgrades, lineId, i);

  const prodPerCycleDisplay = (gen: Gen, i: number) =>
    gen.amount.mul(prodPerCycleOf(i, eco)).mul(productionFactor(upgrades, lineId, i));

  const cycleProgress = (gen: Gen, i: number): number => {
    if (gen.amount.lte(0)) return 0;
    return Math.min((gen.cycleStep + partial / SIM_STEP_S) / cycleStepsNeed(i), 1);
  };

  const dispUptime = line.uptime + (line.gens[0].bought > 0 ? partial : 0);

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

        <div className={styles.list} ref={listRef}>
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
              cycleSecondsNeed(i) -
                (gen.cycleStep * SIM_STEP_S + partial),
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
                    <div
                      className={cyc.cycleFill}
                      style={{ width: `${cycleProgress(gen, i) * 100}%` }}
                    />
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
