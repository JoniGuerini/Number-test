/** Modo Reino: várias linhas de produção medievais, navegáveis por sub-abas.
    Um único loop de frame avança TODAS as linhas ativas. O save é uma chave
    por slot com o estado de cada linha.

    O início é GLOBAL: iniciar o save inicia as cinco frentes de uma vez, com
    a MESMA âncora startedAt — e o modo manual/automático vale para todas
    (o automático é ferramenta de desenvolvimento; não existirá no lançamento).

    As cinco frentes do reino estão ativas (Comida, Mineração, Exploração,
    Militar, Remédios), cada uma com seu próprio balanceamento (ver lines.ts). */

import { useEffect, useReducer, useRef, useState } from 'react';
import { getGameSpeed } from '../../lib/devSpeed';
import { useI18n, type TKey } from '../../lib/locale';
import { loadSave, saveKeyFor, writeSave } from '../../lib/storage';
import ProductionLine from './ProductionLine';
import styles from './Reino.module.css';
import pl from '../../styles/productionList.module.css';
import {
  MAX_STEPS_PER_FRAME,
  SIM_STEP_S,
  advanceLine,
  buyGen,
  loadLine,
  serializeLine,
  type Line,
  type LineSave,
  type Mode,
} from './engine';
import { ENABLED_LINES, LINES, lineDefOf, type LineId } from './lines';

type Lines = Partial<Record<LineId, Line>>;

interface ReinoSave {
  lines: Partial<Record<LineId, LineSave>>;
}

function loadReino(saveKey: string): Lines {
  const s = loadSave<ReinoSave>(saveKey);
  const lines: Lines = {};
  for (const def of ENABLED_LINES) {
    lines[def.id] = loadLine(s?.lines?.[def.id]);
  }
  return lines;
}

function serializeReino(lines: Lines): ReinoSave {
  const out: Partial<Record<LineId, LineSave>> = {};
  for (const def of ENABLED_LINES) {
    const l = lines[def.id];
    if (l) out[def.id] = serializeLine(l);
  }
  return { lines: out };
}

export default function Reino() {
  const { t } = useI18n();
  const [saveKey] = useState(() => saveKeyFor('reino'));
  const [lines, setLines] = useState<Lines>(() => loadReino(saveKey));
  // Re-render por frame para as barras de ciclo andarem suaves.
  const [, bumpFrame] = useReducer((x: number) => x + 1, 0);
  const [activeLine, setActiveLine] = useState<LineId>('comida');

  const setLine = (id: LineId, updater: (l: Line) => Line) =>
    setLines((ls) => (ls[id] ? { ...ls, [id]: updater(ls[id]!) } : ls));

  /** Aplica o mesmo updater a TODAS as linhas habilitadas (início e modo são
      decisões do save inteiro, não de uma frente). */
  const setAllLines = (updater: (l: Line) => Line) =>
    setLines((ls) => {
      const next: Lines = { ...ls };
      for (const d of ENABLED_LINES) {
        const l = next[d.id];
        if (l) next[d.id] = updater(l);
      }
      return next;
    });

  // Save automático: 1x por segundo e ao fechar/recarregar a página.
  const saveRef = useRef(lines);
  saveRef.current = lines;
  useEffect(() => {
    const persist = () => writeSave(saveKey, serializeReino(saveRef.current));
    const id = setInterval(persist, 1000);
    window.addEventListener('beforeunload', persist);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', persist);
    };
  }, [saveKey]);

  // Loop único: avança todas as linhas ativas a partir do relógio de parede.
  useEffect(() => {
    let rafId: number;
    let lastTick = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = now - lastTick;
      lastTick = now;
      // Acelerador de dev (1× ⇄ 10×): em 10×, arrasta a âncora startedAt para
      // trás (9·dt por frame). A contagem de passos continua derivada só da
      // âncora — determinismo e catch-up offline intactos — e os ciclos mantêm
      // a duração em TEMPO DE JOGO (nada é encurtado; o relógio é que corre).
      const speed = getGameSpeed();
      setLines((ls) => {
        let changed = false;
        const next: Lines = { ...ls };
        for (const def of ENABLED_LINES) {
          const g = next[def.id];
          if (!g || !g.started || g.startedAt === undefined) continue;
          const startedAt =
            speed > 1 && dt > 0 ? g.startedAt - (speed - 1) * dt : g.startedAt;
          const target = Math.floor((now - startedAt) / (SIM_STEP_S * 1000));
          const todo = Math.min(target - g.steps, MAX_STEPS_PER_FRAME);
          if (todo > 0) {
            next[def.id] = advanceLine({ ...g, startedAt }, todo, def.genCount, def.eco);
            changed = true;
          } else if (startedAt !== g.startedAt) {
            next[def.id] = { ...g, startedAt };
            changed = true;
          }
        }
        return changed ? next : ls;
      });
      bumpFrame();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const def = lineDefOf(activeLine);
  const line = lines[activeLine];

  // O save só está "em jogo" quando TODAS as frentes foram iniciadas juntas.
  const started = ENABLED_LINES.every((d) => lines[d.id]?.started);
  const gateMode: Mode = lines[ENABLED_LINES[0]?.id]?.mode ?? 'manual';
  const gateAuto = gateMode === 'auto';

  // Tela única de escolha de modo do save: Iniciar dispara as cinco linhas
  // com a MESMA âncora de tempo e o modo escolhido vale para todas.
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

      {def.enabled && line ? (
        <ProductionLine
          line={line}
          lineId={def.id}
          eco={def.eco}
          onBuy={(i) => setLine(def.id, (g) => buyGen(g, i, def.genCount, def.eco))}
          onToggleAuto={() =>
            setAllLines((g) => ({
              ...g,
              mode: g.mode === 'auto' ? 'manual' : 'auto',
            }))
          }
        />
      ) : (
        <div className={styles.placeholder}>
          <span>{t('reino.soon')}</span>
        </div>
      )}
    </div>
  );
}
