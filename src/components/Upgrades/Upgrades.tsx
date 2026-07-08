/** Melhorias / pesquisas do Reino — UI conectada à gameStore e ao motor. */

import { useMemo, useState } from 'react';
import Decimal from 'break_eternity.js';
import { fmt, fmtCost, fmtSecondsShort, fmtWhole } from '../../lib/format';
import { useI18n, type TKey } from '../../lib/locale';
import { useGameStore } from '../../store/gameStore';
import {
  costOf,
  cycleSecondsOf,
  prodPerCycleOf,
} from '../../game/engine';
import { ENABLED_LINES, lineDefOf, type LineId } from '../../game/lines';
import {
  exchangeCost,
  exchangeLevel,
  unlockThreshold,
} from '../../game/mandateExchange';
import {
  UPGRADE_KINDS,
  BONUS_AMOUNT_BASE_PCT,
  CYCLE_DECAY,
  cycleFactorFor,
  isCycleMaxed,
  canAffordUpgrade,
  getLevel,
  purchaseCost,
  unlockedGenIndices,
  type GenRef,
  type UpgradeKind,
} from '../../game/upgrades';
import HoldActionButton from '../HoldActionButton';
import { LiveBaseValue } from '../Reino/LiveValues';
import styles from './Upgrades.module.css';
import pl from '../../styles/productionList.module.css';

type View = 'global' | 'mandate' | LineId;

interface UpgradesProps {
  onNavigate: (page: 'reino') => void;
}

export default function Upgrades({ onNavigate }: UpgradesProps) {
  const { t } = useI18n();
  const [view, setView] = useState<View>('global');
  const lines = useGameStore((s) => s.lines);
  const upgrades = useGameStore((s) => s.upgrades);
  const mandateExchange = useGameStore((s) => s.mandateExchange);
  const started = lines.comida?.started ?? false;

  const viewLabel = (v: View): string => {
    if (v === 'global') return t('upg.scope.global');
    if (v === 'mandate') return t('upg.scope.mandate');
    return t(`reino.line.${v}` as TKey);
  };

  /** Efeito em VALORES REAIS: o de agora → o do próximo nível. Cards de
      gerador mostram ciclo/entrega/preço concretos; os globais mostram o
      fator próprio (o valor final depende de cada gerador). */
  const effectLabel = (target: 'global' | GenRef, kind: UpgradeKind): string => {
    const g = getLevel(upgrades, 'global', kind);
    if (target === 'global') {
      if (kind === 'cycle')
        return t('upg.valG.cycle', {
          from: Math.pow(1 / CYCLE_DECAY, g).toFixed(2),
          to: Math.pow(1 / CYCLE_DECAY, g + 1).toFixed(2),
        });
      if (kind === 'production')
        return t('upg.valG.production', {
          from: (1 + g * 0.1).toFixed(1),
          to: (1 + (g + 1) * 0.1).toFixed(1),
        });
      if (kind === 'cost')
        return t('upg.valG.cost', {
          from: (1 + g * 0.1).toFixed(1),
          to: (1 + (g + 1) * 0.1).toFixed(1),
        });
      if (kind === 'bonus')
        return t('upg.val.bonus', { from: g, to: g + 1 });
      return t('upg.val.bonusAmount', {
        from: BONUS_AMOUNT_BASE_PCT + g,
        to: BONUS_AMOUNT_BASE_PCT + g + 1,
      });
    }

    const { lineId, index } = target;
    const gn = getLevel(upgrades, target, kind);
    const eco = lineDefOf(lineId).eco;
    const gen = lines[lineId]?.gens[index];

    if (kind === 'cycle') {
      const baseS = cycleSecondsOf(index, eco);
      const from = baseS / cycleFactorFor(g + gn, baseS);
      if (isCycleMaxed(upgrades, lineId, index, baseS)) {
        return t('upg.val.cycleMax', { from: fmtSecondsShort(from) });
      }
      return t('upg.val.cycle', {
        from: fmtSecondsShort(from),
        to: fmtSecondsShort(baseS / cycleFactorFor(g + gn + 1, baseS)),
      });
    }
    if (kind === 'production') {
      const per = (gen?.amount ?? new Decimal(0)).mul(prodPerCycleOf(index, eco));
      const factor = (lvl: number) => (1 + g * 0.1) * (1 + lvl * 0.1);
      return t('upg.val.production', {
        from: fmt(per.mul(factor(gn))),
        to: fmt(per.mul(factor(gn + 1))),
      });
    }
    if (kind === 'cost') {
      const base = costOf(index, gen?.bought ?? 0, eco);
      const factor = (lvl: number) => (1 + g * 0.1) * (1 + lvl * 0.1);
      return t('upg.val.cost', {
        from: fmtCost(base.div(factor(gn))),
        to: fmtCost(base.div(factor(gn + 1))),
      });
    }
    if (kind === 'bonus')
      return t('upg.val.bonus', {
        from: Math.min(100, g + gn),
        to: Math.min(100, g + gn + 1),
      });
    return t('upg.val.bonusAmount', {
      from: BONUS_AMOUNT_BASE_PCT + g + gn,
      to: BONUS_AMOUNT_BASE_PCT + g + gn + 1,
    });
  };

  const buy = (target: 'global' | GenRef, kind: UpgradeKind): boolean =>
    useGameStore.getState().buyUpgrade(target, kind);

  const exchange = (lineId: LineId): boolean =>
    useGameStore.getState().exchangeMandate(lineId);

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
        const maxed =
          kind === 'cycle' &&
          isCycleMaxed(
            upgrades,
            view,
            index,
            cycleSecondsOf(index, lineDefOf(view).eco)
          );
        const canAfford = !maxed && canAffordUpgrade(lines, gen, level);
        return { kind, level, line: view, cost, canAfford, maxed };
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
    canAfford: boolean,
    maxed = false
  ) => (
    <article key={kind} className={styles.card}>
      <h3 className={styles.cardTitle}>{t(`upg.${kind}.name` as TKey)}</h3>
      <p className={styles.cardHint}>{t(`upg.${kind}.hint` as TKey)}</p>
      <div className={styles.cardMeta}>
        <span className={styles.metaLevel}>{t('upg.level', { n: level })}</span>
        <span className={styles.metaEffect}>{effectLabel(target, kind)}</span>
      </div>
      <HoldActionButton
        type="button"
        className={`btn-primary ${styles.buy}`}
        disabled={!canAfford}
        onAction={() => buy(target, kind)}
      >
        {maxed
          ? t('upg.maxed')
          : target === 'global'
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
                {/* Odômetro ao vivo (60fps), como o card do Reino. */}
                <LiveBaseValue
                  className={styles.stockAmount}
                  line={lines[def.id]}
                  lineId={def.id}
                  eco={def.eco}
                  upgrades={upgrades}
                  anchorStartedAt={lines.comida?.startedAt}
                  anchorSteps={lines.comida?.steps ?? 0}
                />
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
                  {cards.map(({ kind, level, line, cost, canAfford, maxed }) =>
                    renderCard(gen, kind, level, line, cost, canAfford, maxed)
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
