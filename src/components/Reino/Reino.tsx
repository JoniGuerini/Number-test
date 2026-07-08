/** Modo Reino: várias linhas de produção medievais, navegáveis por sub-abas.
    O estado vivo e o loop da simulação moram na gameStore (Zustand) — este
    componente só apresenta e despacha ações.

    O início é GLOBAL: iniciar o save inicia as cinco frentes de uma vez, com
    a MESMA âncora startedAt — e o modo manual/automático vale para todas
    (o automático é ferramenta de desenvolvimento; não existirá no lançamento).

    As cinco frentes do reino estão ativas (Comida, Mineração, Exploração,
    Militar, Remédios), cada uma com seu próprio balanceamento (ver lines.ts). */

import { useEffect, useRef, useState } from 'react';
import Decimal from 'break_eternity.js';
import { fmt, fmtLive, fmtRate, fmtTime } from '../../lib/format';
import { useI18n, type TKey } from '../../lib/locale';
import { useGameStore } from '../../store/gameStore';
import ProductionLine from './ProductionLine';
import SubResourcePanel from './SubResourcePanel';
import styles from './Reino.module.css';
import pl from '../../styles/productionList.module.css';
import {
  SIM_STEP_S,
  cycleSecondsOf,
  cycleStepsOf,
  prodPerCycleOf,
  type Line,
  type LineEconomy,
  type Mode,
} from './engine';
import { ENABLED_LINES, LINES, lineDefOf, type LineId } from './lines';
import { mandateBalance } from './mandate';
import { totalMandatePerS } from './mandateExchange';
import {
  applyBonusOutput,
  bonusAmountFraction,
  bonusChance,
  bonusRoll,
  bonusTriggers,
  cycleSecondsWithUpgrades,
  cycleSpeedFactor,
  productionFactor,
  type UpgradeState,
} from './upgrades';

/** Odômetro do recurso base a 60fps: entre commits do React (4x/s), REPRODUZ
    as entregas do gerador 1 com as mesmas contas do motor (velocidade
    acumulada, resto carregado, bônus determinístico) e escreve o valor direto
    no nó de texto — o número gira a cada entrega real, sem re-render e sem
    inventar valor. Aproximação única: o amount do g1 fica no committed (a
    alimentação do g2 dentro da janela é ignorada — corrige no commit). */
function LiveBaseValue({
  className,
  line,
  lineId,
  eco,
  upgrades,
  anchorStartedAt,
  anchorSteps,
}: {
  className: string;
  line: Line | undefined;
  lineId: LineId;
  eco: LineEconomy;
  upgrades: UpgradeState;
  anchorStartedAt: number | undefined;
  anchorSteps: number;
}) {
  const elRef = useRef<HTMLSpanElement>(null);
  const snap = useRef({ line, lineId, eco, upgrades, anchorStartedAt, anchorSteps });
  snap.current = { line, lineId, eco, upgrades, anchorStartedAt, anchorSteps };

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const el = elRef.current;
      const s = snap.current;
      if (el && s.line) {
        let value = s.line.base;
        const g0 = s.line.gens[0];
        if (
          s.line.started &&
          s.anchorStartedAt !== undefined &&
          g0 &&
          g0.amount.gt(0)
        ) {
          const n = cycleStepsOf(0, s.eco);
          const v = cycleSpeedFactor(
            s.upgrades,
            s.lineId,
            0,
            cycleSecondsOf(0, s.eco)
          );
          const t =
            (Date.now() - s.anchorStartedAt) / 1000 / SIM_STEP_S -
            s.anchorSteps;
          const replay = Math.min(Math.floor(t), 256);
          const per = g0.amount
            .mul(prodPerCycleOf(0, s.eco))
            .mul(productionFactor(s.upgrades, s.lineId, 0));
          const chance = bonusChance(s.upgrades, s.lineId, 0);
          const frac = bonusAmountFraction(s.upgrades, s.lineId, 0);
          let cc = g0.cycleStep;
          for (let j = 1; j <= replay; j++) {
            cc += v;
            if (cc >= n) {
              const cycles = Math.floor(cc / n);
              cc -= cycles * n;
              let out = per.mul(cycles);
              if (
                chance > 0 &&
                bonusTriggers(
                  chance,
                  bonusRoll(s.anchorSteps + j - 1, s.lineId, 0)
                )
              ) {
                out = applyBonusOutput(out, frac);
              }
              value = value.add(out);
            }
          }
        }
        el.textContent = fmtLive(value);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return <span className={className} ref={elRef} />;
}

function lineResourceRate(
  line: Line,
  eco: LineEconomy,
  lineId: LineId,
  upgrades: UpgradeState
): Decimal {
  const g0 = line.gens[0];
  if (!g0 || g0.amount.lte(0)) return new Decimal(0);
  const perCycle = g0
    .amount.mul(prodPerCycleOf(0, eco))
    .mul(productionFactor(upgrades, lineId, 0));
  const cycleS = cycleSecondsWithUpgrades(cycleSecondsOf(0, eco), upgrades, lineId, 0);
  return perCycle.div(cycleS);
}

export default function Reino() {
  const { t } = useI18n();
  const lines = useGameStore((s) => s.lines);
  const upgrades = useGameStore((s) => s.upgrades);
  const mandate = useGameStore((s) => s.mandate);
  const mandateExchange = useGameStore((s) => s.mandateExchange);
  const catchUp = useGameStore((s) => s.catchUp);
  const [activeLine, setActiveLine] = useState<LineId>('comida');

  const def = lineDefOf(activeLine);
  const line = lines[activeLine];
  const started = ENABLED_LINES.every((d) => lines[d.id]?.started);
  const gateMode: Mode = lines[ENABLED_LINES[0]?.id]?.mode ?? 'manual';
  const gateAuto = gateMode === 'auto';

  if (!started) {
    return (
      <div className={styles.reino}>
        <div className={pl.modeScreen}>
          <div className={pl.modeCard}>
            <h2 className={pl.modeTitle}>{t('mode.title')}</h2>
            <div className={pl.modeOptions}>
              <button
                className={`${pl.modeBtn} ${!gateAuto ? pl.modeActive : ''}`}
                onClick={() => useGameStore.getState().setModeAll('manual')}
              >
                {t('mode.manual')}
              </button>
              <button
                className={`${pl.modeBtn} ${gateAuto ? pl.modeActive : ''}`}
                onClick={() => useGameStore.getState().setModeAll('auto')}
              >
                {t('mode.auto')}
              </button>
            </div>
            <p className={pl.modeHint}>
              {gateAuto ? t('mode.hintAuto') : t('mode.hintManual')}
            </p>
            <button
              className="btn-primary"
              onClick={() => useGameStore.getState().startAll()}
            >
              {t('common.start')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (catchUp) {
    const pct = catchUp.total > 0 ? Math.min(catchUp.done / catchUp.total, 1) : 0;
    return (
      <div className={styles.reino}>
        <div className={pl.modeScreen}>
          <div className={pl.modeCard}>
            <h2 className={pl.modeTitle}>{t('reino.catchup.title')}</h2>
            <p className={pl.modeHint}>
              {t('reino.catchup.hint', {
                time: fmtTime(catchUp.total * SIM_STEP_S),
              })}
            </p>
            <div className={styles.catchupTrack} role="progressbar">
              <div
                className={styles.catchupFill}
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <span className={styles.catchupPct}>{Math.floor(pct * 100)}%</span>
          </div>
        </div>
      </div>
    );
  }

  const anchorSteps = lines.comida?.steps ?? 0;
  const mandateRate = totalMandatePerS(mandateExchange);
  const mandateBal = mandateBalance(
    anchorSteps,
    mandate.spent,
    mandateExchange.purchases
  );
  const resourceRate = line ? lineResourceRate(line, def.eco, def.id, upgrades) : new Decimal(0);

  return (
    <div className={styles.reino}>
      <nav className={styles.lineTabs}>
        {LINES.map((l) => (
          <button
            key={l.id}
            className={`${styles.lineTab} ${activeLine === l.id ? styles.lineTabActive : ''}`}
            onClick={() => setActiveLine(l.id)}
          >
            {t(`reino.line.${l.id}` as TKey)}
          </button>
        ))}
      </nav>

      <div className={styles.resourceCards}>
        <div className={styles.resourceCard}>
          <span className={styles.resourceLabel}>{t('reino.mandate')}</span>
          <div className={styles.resourceRow}>
            <span className={styles.resourceValue}>{fmt(mandateBal)}</span>
            <span className={styles.resourceRate}>
              {t('reino.mandateRate', { n: mandateRate })}
            </span>
          </div>
        </div>
        <div className={styles.resourceCard}>
          <span className={styles.resourceLabel}>
            {t(`reino.base.${def.id}` as TKey)}
          </span>
          <div className={styles.resourceRow}>
            <LiveBaseValue
              className={styles.resourceValue}
              line={line}
              lineId={def.id}
              eco={def.eco}
              upgrades={upgrades}
              anchorStartedAt={lines.comida?.startedAt}
              anchorSteps={anchorSteps}
            />
            <span className={styles.resourceRate}>+{fmtRate(resourceRate)} / s</span>
          </div>
        </div>
      </div>

      {def.enabled && line ? (
        <>
          <SubResourcePanel lineId={def.id} />
          <ProductionLine
          line={line}
          lineId={def.id}
          eco={def.eco}
          upgrades={upgrades}
          mandate={mandateBal}
          mandateCost={def.mandateCost}
          anchorStartedAt={lines.comida?.startedAt}
          anchorSteps={anchorSteps}
          onBuy={(i) => useGameStore.getState().buyGen(def.id, i)}
          onToggleAuto={() => {
            const s = useGameStore.getState();
            s.setModeAll(
              s.lines[def.id]?.mode === 'auto' ? 'manual' : 'auto'
            );
          }}
        />
        </>
      ) : (
        <div className={styles.placeholder}>
          <span>{t('reino.soon')}</span>
        </div>
      )}
    </div>
  );
}
