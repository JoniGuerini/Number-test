/** Melhorias / pesquisas do Reino — UI conectada à gameStore e ao motor. */

import { useMemo, useState, Fragment } from 'react';
import Decimal from 'break_eternity.js';
import { fmt, fmtCost, fmtCycleSeconds, fmtWhole } from '../../lib/format';
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
  maxExchangeQuote,
  unlockThreshold,
  type MaxExchangeQuote,
} from '../../game/mandateExchange';
import {
  UPGRADE_KINDS,
  BONUS_AMOUNT_BASE_PCT,
  cycleFactorFor,
  linearFactor,
  canAffordUpgrade,
  getLevel,
  isUpgradeMaxed,
  maxUpgradeQuote,
  MAX_BUY_LOT,
  purchaseCost,
  remainingUpgradeLevels,
  unlockedGenIndices,
  upgradeBudget,
  type GenRef,
  type MaxUpgradeQuote,
  type UpgradeKind,
} from '../../game/upgrades';
import HoldActionButton from '../HoldActionButton';
import Tooltip from '../Tooltip/Tooltip';
import { LiveBaseRate, LiveBaseValue } from '../Reino/LiveValues';
import { VirtualItem, VirtualList } from '../VirtualList/VirtualList';
import { COMIDA_PORTRAITS } from '../../assets/portraits/comida';
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
          from: fmt(cycleFactorFor(g)),
          to: fmt(cycleFactorFor(g + 1)),
        });
      if (kind === 'production')
        return t('upg.valG.production', {
          from: fmt(linearFactor(g)),
          to: fmt(linearFactor(g + 1)),
        });
      if (kind === 'cost')
        return t('upg.valG.cost', {
          from: fmt(linearFactor(g)),
          to: fmt(linearFactor(g + 1)),
        });
      if (kind === 'bonus') {
        if (isUpgradeMaxed(upgrades, target, 'bonus'))
          return t('upg.val.bonusMax');
        return t('upg.val.bonus', { from: g, to: g + 1 });
      }
      return t('upg.val.bonusAmount', {
        from: fmtWhole(BONUS_AMOUNT_BASE_PCT + g),
        to: fmtWhole(BONUS_AMOUNT_BASE_PCT + g + 1),
      });
    }

    const { lineId, index } = target;
    const gn = getLevel(upgrades, target, kind);
    const eco = lineDefOf(lineId).eco;
    const gen = lines[lineId]?.gens[index];

    if (kind === 'cycle') {
      const baseS = new Decimal(cycleSecondsOf(index, eco));
      return t('upg.val.cycle', {
        from: fmtCycleSeconds(baseS.div(cycleFactorFor(g + gn))),
        to: fmtCycleSeconds(baseS.div(cycleFactorFor(g + gn + 1))),
      });
    }
    if (kind === 'production') {
      const per = (gen?.amount ?? new Decimal(0)).mul(prodPerCycleOf(index, eco));
      const factor = (lvl: number) => linearFactor(g).mul(linearFactor(lvl));
      return t('upg.val.production', {
        from: fmt(per.mul(factor(gn))),
        to: fmt(per.mul(factor(gn + 1))),
      });
    }
    if (kind === 'cost') {
      const base = costOf(index, gen?.bought ?? 0, eco);
      const factor = (lvl: number) => linearFactor(g).mul(linearFactor(lvl));
      return t('upg.val.cost', {
        from: fmtCost(base.div(factor(gn))),
        to: fmtCost(base.div(factor(gn + 1))),
      });
    }
    if (kind === 'bonus') {
      if (isUpgradeMaxed(upgrades, target, 'bonus'))
        return t('upg.val.bonusMax');
      return t('upg.val.bonus', {
        from: Math.min(100, g + gn),
        to: Math.min(100, g + gn + 1),
      });
    }
    return t('upg.val.bonusAmount', {
      from: fmtWhole(BONUS_AMOUNT_BASE_PCT + g + gn),
      to: fmtWhole(BONUS_AMOUNT_BASE_PCT + g + gn + 1),
    });
  };

  const buy = (target: 'global' | GenRef, kind: UpgradeKind): boolean =>
    useGameStore.getState().buyUpgrade(target, kind);

  const buyMax = (target: 'global' | GenRef, kind: UpgradeKind): boolean =>
    useGameStore.getState().buyMaxUpgrade(target, kind);

  const exchange = (lineId: LineId): boolean =>
    useGameStore.getState().exchangeMandate(lineId);

  const exchangeMax = (lineId: LineId): boolean =>
    useGameStore.getState().exchangeMaxMandate(lineId);

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
        const remaining = remainingUpgradeLevels(upgrades, 'global', kind);
        const maxQuote = maxUpgradeQuote(
          upgradeBudget(lines, 'global'),
          cost,
          remaining ?? MAX_BUY_LOT
        );
        const maxed = isUpgradeMaxed(upgrades, 'global', kind);
        return { kind, level, cost, canAfford: !maxed && canAfford, maxQuote, maxed };
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
        const remaining = remainingUpgradeLevels(upgrades, gen, kind);
        const maxQuote = maxUpgradeQuote(
          upgradeBudget(lines, gen),
          cost,
          remaining ?? MAX_BUY_LOT
        );
        const maxed = isUpgradeMaxed(upgrades, gen, kind);
        return {
          kind,
          level,
          line: view,
          cost,
          canAfford: !maxed && canAfford,
          maxQuote,
          maxed,
        };
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
        const need = cost.gte(unlock) ? cost : unlock;
        const progress =
          line?.started && stock
            ? Math.min(stock.div(need).toNumber(), 1)
            : 0;
        const canAfford = progress >= 1;
        const maxQuote = maxExchangeQuote(stock ?? new Decimal(0), cost);
        return { lineId: def.id, level, cost, unlock, progress, canAfford, maxQuote };
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
    maxQuote: MaxUpgradeQuote,
    maxed: boolean
  ) => {
    const amount = fmt(maxQuote.count > 0 ? maxQuote.totalCost : cost);
    const maxLabel =
      target === 'global'
        ? amount
        : t('upg.buyCost', {
            cost: amount,
            resource: t(`reino.base.${line}` as TKey),
          });
    const maxTitle = t('upg.buyMaxTitle', { count: fmtWhole(maxQuote.count) });

    return (
    <article className={styles.card}>
      <h3 className={styles.cardTitle}>{t(`upg.${kind}.name` as TKey)}</h3>
      <p className={styles.cardHint}>{t(`upg.${kind}.hint` as TKey)}</p>
      <div className={styles.cardMeta}>
        <span className={styles.metaLevel}>
          {t('upg.level', { n: fmtWhole(level) })}
        </span>
        <span className={styles.metaEffect}>{effectLabel(target, kind)}</span>
      </div>
      <div className={`${styles.buyActions} ${maxed ? styles.buyActionsMaxed : ''}`}>
        {maxed ? (
          <button type="button" className={`btn-primary ${styles.buy}`} disabled>
            {t('upg.maxLevel')}
          </button>
        ) : (
          <>
            <HoldActionButton
              type="button"
              className={`btn-primary ${styles.buy}`}
              disabled={!canAfford}
              onAction={() => buy(target, kind)}
            >
              {target === 'global'
                ? fmt(cost)
                : t('upg.buyCost', {
                    cost: fmt(cost),
                    resource: t(`reino.base.${line}` as TKey),
                  })}
            </HoldActionButton>
            <Tooltip className={styles.buyMaxWrap} text={maxTitle}>
              <button
                type="button"
                className={`btn-primary ${styles.buy}`}
                disabled={maxQuote.count === 0}
                onClick={() => buyMax(target, kind)}
                aria-label={maxTitle}
              >
                {maxLabel}
              </button>
            </Tooltip>
          </>
        )}
      </div>
    </article>
    );
  };

  const renderMandateCard = (
    lineId: LineId,
    level: number,
    cost: Decimal,
    unlock: Decimal,
    progress: number,
    canAfford: boolean,
    maxQuote: MaxExchangeQuote
  ) => {
    const resource = t(`reino.base.${lineId}` as TKey);
    const maxTitle = t('upg.mandate.exchangeMaxTitle', {
      count: fmtWhole(maxQuote.count),
    });

    return (
    <article className={styles.card}>
      <h3 className={styles.cardTitle}>{resource}</h3>
      <p className={styles.cardHint}>{t('upg.mandate.cardHint')}</p>
      <div className={styles.cardMeta}>
        <span className={styles.metaLevel}>
          {t('upg.level', { n: fmtWhole(level) })}
        </span>
        <span className={styles.metaEffect}>
          {t('upg.mandate.effect', { n: fmtWhole(level) })}
        </span>
      </div>
      <p className={styles.cardUnlock}>
        {t('upg.mandate.unlock', { n: fmtWhole(unlock) })}
      </p>
      <div className={styles.buyActions}>
        <HoldActionButton
          type="button"
          className={`btn-primary ${pl.progressBtn} ${styles.buy}`}
          disabled={!canAfford}
          onAction={() => exchange(lineId)}
        >
          <span
            className={pl.progressFill}
            style={{ width: `${progress * 100}%` }}
            aria-hidden="true"
          />
          <span className={`${pl.progressLabel} ${styles.buyLabel}`}>
            {t('upg.mandate.exchange', {
              cost: fmtWhole(cost),
              resource,
            })}
          </span>
        </HoldActionButton>
        <Tooltip className={styles.buyMaxWrap} text={maxTitle}>
          <button
            type="button"
            className={`btn-primary ${styles.buy}`}
            disabled={maxQuote.count === 0}
            onClick={() => exchangeMax(lineId)}
            aria-label={maxTitle}
          >
            {t('upg.mandate.exchange', {
              cost: fmtWhole(
                maxQuote.count > 0 ? maxQuote.totalCost : cost
              ),
              resource,
            })}
          </button>
        </Tooltip>
      </div>
    </article>
    );
  };

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
                <div className={styles.stockRow}>
                  <LiveBaseValue
                    className={styles.stockAmount}
                    line={lines[def.id]}
                    lineId={def.id}
                    eco={def.eco}
                    upgrades={upgrades}
                    anchorStartedAt={lines.comida?.startedAt}
                    anchorSteps={lines.comida?.steps ?? 0}
                  />
                  <LiveBaseRate
                    className={styles.stockRate}
                    line={lines[def.id]}
                    lineId={def.id}
                    eco={def.eco}
                    upgrades={upgrades}
                    anchorStartedAt={lines.comida?.startedAt}
                    anchorSteps={lines.comida?.steps ?? 0}
                  />
                </div>
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
        <VirtualList className={styles.list}>
          {view === 'global' ? (
            <div className={styles.cardRow}>
              {globalCards.map(
                ({ kind, level, cost, canAfford, maxQuote, maxed }) => (
                  <Fragment key={kind}>
                    {renderCard(
                      'global',
                      kind,
                      level,
                      null,
                      cost,
                      canAfford,
                      maxQuote,
                      maxed
                    )}
                  </Fragment>
                )
              )}
            </div>
          ) : view === 'mandate' ? (
            <div className={styles.cardRow}>
              {mandateCards.map(
                ({
                  lineId,
                  level,
                  cost,
                  unlock,
                  progress,
                  canAfford,
                  maxQuote,
                }) => (
                  <Fragment key={lineId}>
                    {renderMandateCard(
                      lineId,
                      level,
                      cost,
                      unlock,
                      progress,
                      canAfford,
                      maxQuote
                    )}
                  </Fragment>
                )
              )}
            </div>
          ) : genSections.length === 0 ? (
            <p className={styles.emptyLine}>{t('upg.noGens')}</p>
          ) : (
            genSections.map(({ gen, cards }) => (
              <VirtualItem
                key={gen.index}
                estimateHeight={240}
                className={styles.genGroup}
              >
                {() => {
                  const genLabel = t(
                    `reino.gen.${gen.lineId}.${gen.index + 1}` as TKey
                  );
                  const portrait =
                    gen.lineId === 'comida'
                      ? COMIDA_PORTRAITS[gen.index]
                      : undefined;
                  return (
                    <>
                      <h2 className={styles.genName}>{genLabel}</h2>
                      <div className={portrait ? styles.artRow : undefined}>
                        {portrait && (
                          <div className={styles.art}>
                            <img src={portrait} alt={genLabel} />
                          </div>
                        )}
                        <div className={styles.cardRow}>
                          {cards.map(
                            ({
                              kind,
                              level,
                              line,
                              cost,
                              canAfford,
                              maxQuote,
                              maxed,
                            }) => (
                              <Fragment key={kind}>
                                {renderCard(
                                  gen,
                                  kind,
                                  level,
                                  line,
                                  cost,
                                  canAfford,
                                  maxQuote,
                                  maxed
                                )}
                              </Fragment>
                            )
                          )}
                        </div>
                      </div>
                    </>
                  );
                }}
              </VirtualItem>
            ))
          )}
        </VirtualList>
      </section>
    </div>
  );
}
