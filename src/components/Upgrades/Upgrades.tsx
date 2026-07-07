/** Melhorias / pesquisas do Reino — UI conectada ao save e ao motor. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Decimal from 'break_eternity.js';
import { fmt, fmtCost, fmtWhole } from '../../lib/format';
import { useI18n, type TKey } from '../../lib/locale';
import { loadSave, saveKeyFor, writeSave } from '../../lib/storage';
import { loadLine, serializeLine, type Line, type LineSave } from '../Reino/engine';
import { ENABLED_LINES, type LineId } from '../Reino/lines';
import {
  exchangeCost,
  exchangeLevel,
  loadMandateExchange,
  serializeMandateExchange,
  tryExchangeMandate,
  unlockThreshold,
  type MandateExchangeSave,
  type MandateExchangeState,
} from '../Reino/mandateExchange';
import {
  UPGRADE_KINDS,
  REINO_SAVE_EVENT,
  BONUS_AMOUNT_BASE_PCT,
  BONUS_AMOUNT_PCT,
  BONUS_CHANCE_PCT,
  EFFECT_PCT,
  canAffordUpgrade,
  getLevel,
  purchaseCost,
  loadUpgrades,
  notifyReinoSave,
  serializeUpgrades,
  tryBuyUpgrade,
  unlockedGenIndices,
  type GenRef,
  type UpgradeKind,
  type UpgradeState,
  type UpgradeStateSave,
} from '../Reino/upgrades';
import HoldActionButton from '../HoldActionButton';
import styles from './Upgrades.module.css';
import pl from '../../styles/productionList.module.css';

interface ReinoSave {
  lines?: Partial<Record<LineId, LineSave>>;
  upgrades?: UpgradeStateSave;
  mandateSpent?: number;
  mandate?: number;
  mandateFrac?: number;
  mandateExchange?: MandateExchangeSave;
}

type View = 'global' | 'mandate' | LineId;

type Lines = Partial<Record<LineId, Line>>;

function loadSnapshot(key: string): {
  lines: Lines;
  upgrades: UpgradeState;
  mandateExchange: MandateExchangeState;
  started: boolean;
} {
  const s = loadSave<ReinoSave>(key);
  const lines: Lines = {};
  for (const def of ENABLED_LINES) {
    lines[def.id] = loadLine(s?.lines?.[def.id]);
  }
  const started = lines.comida?.started ?? false;
  return {
    lines,
    upgrades: loadUpgrades(s?.upgrades),
    mandateExchange: loadMandateExchange(s?.mandateExchange),
    started,
  };
}

function writeSnapshot(
  key: string,
  lines: Lines,
  upgrades: UpgradeState,
  mandateExchange: MandateExchangeState
): void {
  const prev = loadSave<ReinoSave>(key);
  const out: Partial<Record<LineId, LineSave>> = {};
  for (const def of ENABLED_LINES) {
    const l = lines[def.id];
    if (l) out[def.id] = serializeLine(l);
  }
  writeSave(key, {
    lines: out,
    upgrades: serializeUpgrades(upgrades),
    mandateSpent: prev?.mandateSpent,
    mandateExchange: serializeMandateExchange(mandateExchange),
  });
}

interface UpgradesProps {
  onNavigate: (page: 'reino') => void;
}

export default function Upgrades({ onNavigate }: UpgradesProps) {
  const { t } = useI18n();
  const [saveKey] = useState(() => saveKeyFor('reino'));
  const [view, setView] = useState<View>('global');
  const [snapshot, setSnapshot] = useState(() => loadSnapshot(saveKey));

  const refresh = useCallback(() => {
    setSnapshot(loadSnapshot(saveKey));
  }, [saveKey]);

  useEffect(() => {
    const id = setInterval(refresh, 1000);
    window.addEventListener(REINO_SAVE_EVENT, refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener(REINO_SAVE_EVENT, refresh);
    };
  }, [refresh]);

  const { lines, upgrades, mandateExchange, started } = snapshot;

  const viewLabel = (v: View): string => {
    if (v === 'global') return t('upg.scope.global');
    if (v === 'mandate') return t('upg.scope.mandate');
    return t(`reino.line.${v}` as TKey);
  };

  const effectLabel = (kind: UpgradeKind, level: number): string => {
    if (kind === 'cycle')
      return t('upg.effectCycle', { n: level * EFFECT_PCT });
    if (kind === 'production')
      return t('upg.effectProduction', { n: level * EFFECT_PCT });
    if (kind === 'cost')
      return t('upg.effectCost', { n: level * EFFECT_PCT });
    if (kind === 'bonus')
      return t('upg.effectBonus', { n: level * BONUS_CHANCE_PCT });
    return t('upg.effectBonusAmount', {
      n: BONUS_AMOUNT_BASE_PCT + level * BONUS_AMOUNT_PCT,
    });
  };

  const buy = (target: 'global' | GenRef, kind: UpgradeKind): boolean => {
    const snap = loadSnapshot(saveKey);
    const result = tryBuyUpgrade(snap.lines, snap.upgrades, target, kind);
    if (!result) return false;
    writeSnapshot(saveKey, result.lines, result.upgrades, snap.mandateExchange);
    notifyReinoSave();
    setSnapshot({
      ...snap,
      lines: result.lines,
      upgrades: result.upgrades,
    });
    return true;
  };

  const exchange = (lineId: LineId): boolean => {
    const snap = loadSnapshot(saveKey);
    const steps = snap.lines.comida?.steps ?? 0;
    const result = tryExchangeMandate(
      snap.lines,
      snap.mandateExchange,
      lineId,
      steps
    );
    if (!result) return false;
    writeSnapshot(saveKey, result.lines, snap.upgrades, result.exchange);
    notifyReinoSave();
    setSnapshot({
      ...snap,
      lines: result.lines,
      mandateExchange: result.exchange,
    });
    return true;
  };

  const scopeHint =
    view === 'global'
      ? t('upg.globalHint')
      : view === 'mandate'
        ? t('upg.mandateHint')
        : t('upg.genListHint');

  const stockLines =
    view === 'global'
      ? ENABLED_LINES
      : view === 'mandate'
        ? ENABLED_LINES
        : ENABLED_LINES.filter((d) => d.id === view);
  const showStock = stockLines.every((d) => lines[d.id]);

  const globalCards = useMemo(
    () =>
      UPGRADE_KINDS.map((kind) => {
        const level = getLevel(upgrades, 'global', kind);
        const cost = purchaseCost('global', level);
        const canAfford = canAffordUpgrade(lines, 'global', level);
        return { kind, level, cost, canAfford };
      }),
    [upgrades, lines]
  );

  const genSections = useMemo(() => {
    if (view === 'global' || view === 'mandate') return [];
    const line = lines[view];
    return unlockedGenIndices(line).map((index) => ({
      gen: { lineId: view, index } satisfies GenRef,
      cards: UPGRADE_KINDS.map((kind) => {
        const gen = { lineId: view, index } satisfies GenRef;
        const level = getLevel(upgrades, gen, kind);
        const cost = purchaseCost(gen, level);
        const canAfford = canAffordUpgrade(lines, gen, level);
        return { kind, level, line: view, cost, canAfford };
      }),
    }));
  }, [view, lines, upgrades]);

  const mandateCards = useMemo(
    () =>
      ENABLED_LINES.map((def) => {
        const level = exchangeLevel(mandateExchange, def.id);
        const cost = exchangeCost(def.id, level);
        const unlock = unlockThreshold(def.id, level);
        const line = lines[def.id];
        const stock = line?.base;
        const need = cost.gte(unlock) ? cost : new Decimal(unlock);
        const progress =
          line?.started && stock
            ? Math.min(stock.div(need).toNumber(), 1)
            : 0;
        const canAfford = progress >= 1;
        return { lineId: def.id, level, cost, unlock, progress, canAfford };
      }),
    [mandateExchange, lines]
  );

  const renderCard = (
    target: 'global' | GenRef,
    kind: UpgradeKind,
    level: number,
    line: LineId | null,
    cost: Decimal,
    canAfford: boolean
  ) => (
    <article key={kind} className={styles.card}>
      <h3 className={styles.cardTitle}>{t(`upg.${kind}.name` as TKey)}</h3>
      <p className={styles.cardHint}>{t(`upg.${kind}.hint` as TKey)}</p>
      <div className={styles.cardMeta}>
        <span className={styles.metaLevel}>{t('upg.level', { n: level })}</span>
        <span className={styles.metaEffect}>{effectLabel(kind, level)}</span>
      </div>
      <HoldActionButton
        type="button"
        className={`btn-primary ${styles.buy}`}
        disabled={!canAfford}
        onAction={() => buy(target, kind)}
      >
        {target === 'global'
          ? t('upg.buyCostAll', { cost: fmt(cost) })
          : t('upg.buyCost', {
              cost: fmt(cost),
              resource: t(`reino.base.${line}` as TKey),
            })}
      </HoldActionButton>
    </article>
  );

  const renderMandateCard = (
    lineId: LineId,
    level: number,
    cost: Decimal,
    unlock: number,
    progress: number,
    canAfford: boolean
  ) => (
    <article key={lineId} className={styles.card}>
      <h3 className={styles.cardTitle}>
        {t(`reino.base.${lineId}` as TKey)}
      </h3>
      <p className={styles.cardHint}>{t('upg.mandate.cardHint')}</p>
      <div className={styles.cardMeta}>
        <span className={styles.metaLevel}>{t('upg.level', { n: level })}</span>
        <span className={styles.metaEffect}>
          {t('upg.mandate.effect', { n: level })}
        </span>
      </div>
      <p className={styles.cardUnlock}>
        {t('upg.mandate.unlock', { n: fmtWhole(unlock) })}
      </p>
      <HoldActionButton
        type="button"
        className={`btn-primary ${pl.progressBtn} ${styles.exchangeBtn}`}
        disabled={!canAfford}
        onAction={() => exchange(lineId)}
      >
        <span
          className={pl.progressFill}
          style={{ width: `${progress * 100}%` }}
          aria-hidden="true"
        />
        <span className={pl.progressLabel}>
          {t('upg.mandate.exchange', {
            cost: fmtWhole(cost),
            resource: t(`reino.base.${lineId}` as TKey),
          })}
        </span>
      </HoldActionButton>
    </article>
  );

  if (!started) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>
          <p className={styles.emptyText}>{t('upg.empty')}</p>
          <button className="btn-primary" onClick={() => onNavigate('reino')}>
            {t('upg.cta')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <nav className={styles.tabs}>
        <button
          className={`${styles.tab} ${view === 'global' ? styles.tabActive : ''}`}
          onClick={() => setView('global')}
        >
          {viewLabel('global')}
        </button>
        <button
          className={`${styles.tab} ${view === 'mandate' ? styles.tabActive : ''}`}
          onClick={() => setView('mandate')}
        >
          {viewLabel('mandate')}
        </button>
        {ENABLED_LINES.map((line) => (
          <button
            key={line.id}
            className={`${styles.tab} ${view === line.id ? styles.tabActive : ''}`}
            onClick={() => setView(line.id)}
          >
            {viewLabel(line.id)}
          </button>
        ))}
      </nav>

      <p className={styles.scopeHint}>{scopeHint}</p>

      {showStock && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('upg.section.resources')}</h2>
          <div className={styles.stockCards}>
            {stockLines.map((def) => (
              <div key={def.id} className={styles.stockCard}>
                <span className={styles.stockLabel}>
                  {t(`reino.base.${def.id}` as TKey)}
                </span>
                <span className={styles.stockAmount}>
                  {fmtCost(lines[def.id]!.base)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.upgradesSection}>
        <h2 className={styles.sectionTitle}>
          {view === 'mandate'
            ? t('upg.section.mandate')
            : t('upg.section.upgrades')}
        </h2>
        <div className={styles.list}>
          {view === 'global' ? (
            <div className={styles.cardRow}>
              {globalCards.map(({ kind, level, cost, canAfford }) =>
                renderCard('global', kind, level, null, cost, canAfford)
              )}
            </div>
          ) : view === 'mandate' ? (
            <div className={styles.cardRow}>
              {mandateCards.map(({ lineId, level, cost, unlock, progress, canAfford }) =>
                renderMandateCard(lineId, level, cost, unlock, progress, canAfford)
              )}
            </div>
          ) : genSections.length === 0 ? (
            <p className={styles.emptyLine}>{t('upg.noGens')}</p>
          ) : (
            genSections.map(({ gen, cards }) => (
              <section key={gen.index} className={styles.genGroup}>
                <h2 className={styles.genName}>
                  {t(`reino.gen.${gen.lineId}.${gen.index + 1}` as TKey)}
                </h2>
                <div className={styles.cardRow}>
                  {cards.map(({ kind, level, line, cost, canAfford }) =>
                    renderCard(gen, kind, level, line, cost, canAfford)
                  )}
                </div>
              </section>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
