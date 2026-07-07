/** Modo Reino: várias linhas de produção medievais, navegáveis por sub-abas.
    Um único loop de frame avança TODAS as linhas ativas. O save é uma chave
    por slot com o estado de cada linha.

    O início é GLOBAL: iniciar o save inicia as cinco frentes de uma vez, com
    a MESMA âncora startedAt — e o modo manual/automático vale para todas
    (o automático é ferramenta de desenvolvimento; não existirá no lançamento).

    As cinco frentes do reino estão ativas (Comida, Mineração, Exploração,
    Militar, Remédios), cada uma com seu próprio balanceamento (ver lines.ts). */

import { useEffect, useRef, useState } from 'react';
import Decimal from 'break_eternity.js';
import { fmt, fmtRate, fmtTime } from '../../lib/format';
import { useI18n, type TKey } from '../../lib/locale';
import { loadSave, saveKeyFor, writeSave } from '../../lib/storage';
import ProductionLine from './ProductionLine';
import SubResourcePanel from './SubResourcePanel';
import styles from './Reino.module.css';
import pl from '../../styles/productionList.module.css';
import {
  MAX_STEPS_PER_FRAME,
  SIM_STEP_S,
  advanceKingdom,
  buyGen,
  cycleSecondsOf,
  loadLine,
  prodPerCycleOf,
  serializeLine,
  type Line,
  type LineEconomy,
  type LineSave,
  type Mode,
} from './engine';
import { ENABLED_LINES, LINES, lineDefOf, type LineId } from './lines';
import {
  emptyMandate,
  loadMandate,
  mandateBalance,
  serializeMandate,
  type MandateState,
} from './mandate';
import {
  emptyMandateExchange,
  loadMandateExchange,
  serializeMandateExchange,
  totalMandatePerS,
  type MandateExchangeSave,
  type MandateExchangeState,
} from './mandateExchange';
import {
  REINO_SAVE_EVENT,
  cycleSecondsWithUpgrades,
  loadUpgrades,
  productionFactor,
  serializeUpgrades,
  type UpgradeState,
  type UpgradeStateSave,
} from './upgrades';

type Lines = Partial<Record<LineId, Line>>;

/** Passos pendentes acima disso ligam a tela de carregamento do catch-up
    offline. Abaixo (≈2 frames de simulação) resolve sem alarde; acima, a UI
    normal viraria um frenesi de re-renders no meio do avanço em lote. */
const CATCHUP_MIN_STEPS = MAX_STEPS_PER_FRAME * 2;

interface CatchUp {
  total: number;
  done: number;
}

/** Catch-up pendente já na montagem (volta de um período offline) — deixa a
    tela de carregamento aparecer no primeiro paint, sem flash da UI normal. */
function initialCatchUp(saveKey: string): CatchUp | null {
  const l = loadReino(saveKey).lines.comida;
  if (!l?.started || l.startedAt === undefined) return null;
  const target = Math.floor((Date.now() - l.startedAt) / (SIM_STEP_S * 1000));
  const pending = target - l.steps;
  return pending > CATCHUP_MIN_STEPS ? { total: pending, done: 0 } : null;
}

interface ReinoSave {
  lines: Partial<Record<LineId, LineSave>>;
  upgrades?: UpgradeStateSave;
  mandateSpent?: number;
  /** @deprecated migrado para mandateSpent */
  mandate?: number;
  mandateFrac?: number;
  mandateExchange?: MandateExchangeSave;
}

function loadReino(saveKey: string): {
  lines: Lines;
  upgrades: UpgradeState;
  mandate: MandateState;
  mandateExchange: MandateExchangeState;
} {
  const s = loadSave<ReinoSave>(saveKey);
  const lines: Lines = {};
  for (const def of ENABLED_LINES) {
    lines[def.id] = loadLine(s?.lines?.[def.id]);
  }
  return {
    lines,
    upgrades: loadUpgrades(s?.upgrades),
    mandate: loadMandate(s ?? undefined, lines),
    mandateExchange: loadMandateExchange(s?.mandateExchange),
  };
}

function serializeReino(
  lines: Lines,
  upgrades: UpgradeState,
  mandate: MandateState,
  mandateExchange: MandateExchangeState
): ReinoSave {
  const out: Partial<Record<LineId, LineSave>> = {};
  for (const def of ENABLED_LINES) {
    const l = lines[def.id];
    if (l) out[def.id] = serializeLine(l);
  }
  return {
    lines: out,
    upgrades: serializeUpgrades(upgrades),
    ...serializeMandate(mandate),
    mandateExchange: serializeMandateExchange(mandateExchange),
  };
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
  const [saveKey] = useState(() => saveKeyFor('reino'));
  const [lines, setLines] = useState<Lines>(() => loadReino(saveKey).lines);
  const [upgrades, setUpgrades] = useState<UpgradeState>(
    () => loadReino(saveKey).upgrades
  );
  const [mandate, setMandate] = useState<MandateState>(
    () => loadReino(saveKey).mandate
  );
  const [mandateExchange, setMandateExchange] = useState<MandateExchangeState>(
    () => loadReino(saveKey).mandateExchange
  );
  const [activeLine, setActiveLine] = useState<LineId>('comida');
  const [catchUp, setCatchUp] = useState<CatchUp | null>(() =>
    initialCatchUp(saveKey)
  );
  const catchUpRef = useRef<{ total: number } | null>(
    catchUp ? { total: catchUp.total } : null
  );

  const setLine = (id: LineId, updater: (l: Line) => Line) =>
    setLines((ls) => (ls[id] ? { ...ls, [id]: updater(ls[id]!) } : ls));

  const setAllLines = (updater: (l: Line) => Line) =>
    setLines((ls) => {
      const next: Lines = { ...ls };
      for (const d of ENABLED_LINES) {
        const l = next[d.id];
        if (l) next[d.id] = updater(l);
      }
      return next;
    });

  const saveRef = useRef({ lines, upgrades, mandate, mandateExchange });
  saveRef.current = { lines, upgrades, mandate, mandateExchange };
  useEffect(() => {
    const persist = () =>
      writeSave(
        saveKey,
        serializeReino(
          saveRef.current.lines,
          saveRef.current.upgrades,
          saveRef.current.mandate,
          saveRef.current.mandateExchange
        )
      );
    const id = setInterval(persist, 1000);
    window.addEventListener('beforeunload', persist);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', persist);
    };
  }, [saveKey]);

  useEffect(() => {
    const sync = () => {
      const loaded = loadReino(saveKey);
      setLines(loaded.lines);
      setUpgrades(loaded.upgrades);
      setMandate(loaded.mandate);
      setMandateExchange(loaded.mandateExchange);
    };
    window.addEventListener(REINO_SAVE_EVENT, sync);
    return () => window.removeEventListener(REINO_SAVE_EVENT, sync);
  }, [saveKey]);

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const now = Date.now();
      // Só toca no React quando há passo novo a executar (4x/s) — os números
      // só mudam por passo; renderizar a 60fps era puro desperdício. A
      // animação das barras entre passos é imperativa (ProductionLine).
      const anchor = saveRef.current.lines.comida;
      if (anchor?.started && anchor.startedAt !== undefined) {
        const target = Math.floor((now - anchor.startedAt) / (SIM_STEP_S * 1000));
        const pending = target - anchor.steps;
        // Muito atraso acumulado (volta de offline): liga a tela de
        // carregamento e segura os re-renders da UI até o lote terminar.
        if (!catchUpRef.current && pending > CATCHUP_MIN_STEPS) {
          catchUpRef.current = { total: pending };
          setCatchUp({ total: pending, done: 0 });
        }
        const todo = Math.min(pending, MAX_STEPS_PER_FRAME);
        if (todo > 0) {
          // Avança FORA do setState (updater precisa ser puro — o StrictMode
          // o invoca duas vezes e um setMandate lá dentro vazava estado entre
          // as invocações). O saveRef é a fonte fresca, como no onBuy; ele é
          // atualizado na hora para o próximo tick não reprocessar o lote.
          const prev = saveRef.current;
          const result = advanceKingdom(
            prev.lines,
            ENABLED_LINES,
            todo,
            prev.upgrades,
            prev.mandate,
            prev.mandateExchange.purchases
          );
          saveRef.current = {
            ...prev,
            lines: result.lines,
            mandate: result.mandate,
          };
          if (catchUpRef.current) {
            const remaining = pending - todo;
            if (remaining > 0) {
              // Só a barra de progresso re-renderiza durante o catch-up.
              const { total } = catchUpRef.current;
              setCatchUp({ total, done: total - remaining });
            } else {
              catchUpRef.current = null;
              setCatchUp(null);
              setLines(result.lines);
              setMandate(result.mandate);
            }
          } else {
            setLines(result.lines);
            if (result.mandate.spent !== prev.mandate.spent) {
              setMandate(result.mandate);
            }
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

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
                onClick={() => setAllLines((g) => ({ ...g, mode: 'manual' }))}
              >
                {t('mode.manual')}
              </button>
              <button
                className={`${pl.modeBtn} ${gateAuto ? pl.modeActive : ''}`}
                onClick={() => setAllLines((g) => ({ ...g, mode: 'auto' }))}
              >
                {t('mode.auto')}
              </button>
            </div>
            <p className={pl.modeHint}>
              {gateAuto ? t('mode.hintAuto') : t('mode.hintManual')}
            </p>
            <button
              className="btn-primary"
              onClick={() => {
                const now = Date.now();
                setMandate(emptyMandate());
                setMandateExchange(emptyMandateExchange());
                setAllLines((g) => ({ ...g, started: true, startedAt: now, steps: 0 }));
              }}
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
            <span className={styles.resourceValue}>{fmt(line?.base ?? 0)}</span>
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
          onBuy={(i) => {
            const cur = saveRef.current.lines[def.id];
            if (!cur) return false;
            const before = cur.gens[i].bought;
            const result = buyGen(
              cur,
              i,
              def.genCount,
              def.eco,
              def.id,
              saveRef.current.upgrades,
              saveRef.current.mandate,
              saveRef.current.mandateExchange.purchases
            );
            const success = result.line.gens[i].bought > before;
            if (success) {
              saveRef.current = {
                ...saveRef.current,
                lines: { ...saveRef.current.lines, [def.id]: result.line },
                mandate: result.mandate,
              };
              setLine(def.id, () => result.line);
              setMandate(result.mandate);
            }
            return success;
          }}
          onToggleAuto={() =>
            setAllLines((g) => ({
              ...g,
              mode: g.mode === 'auto' ? 'manual' : 'auto',
            }))
          }
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
