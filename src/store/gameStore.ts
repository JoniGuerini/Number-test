/** Fonte única da verdade do estado do Reino (Zustand).

    O estado vivo (lines/upgrades/mandato) mora AQUI, em memória; o
    localStorage volta a ser só persistência (grava 1x/s + beforeunload +
    após cada compra) — nada de reler/desserializar o save por página nem
    de evento custom para sincronizar telas.

    ESCRITOR ÚNICO: toda mutação passa pelas ações desta store (tick do
    motor, compras, trocas, início). O motor continua puro e determinístico
    em engine.ts — a store só orquestra snapshots e persistência. */

import { create } from 'zustand';
import { loadSave, saveKeyFor, writeSave } from '../lib/storage';
import {
  MAX_STEPS_PER_FRAME,
  SIM_STEP_S,
  advanceKingdom,
  buyGen as engineBuyGen,
  loadLine,
  serializeLine,
  type Line,
  type LineSave,
  type Mode,
} from '../components/Reino/engine';
import { ENABLED_LINES, lineDefOf, type LineId } from '../components/Reino/lines';
import {
  emptyMandate,
  loadMandate,
  serializeMandate,
  type MandateState,
} from '../components/Reino/mandate';
import {
  emptyMandateExchange,
  loadMandateExchange,
  serializeMandateExchange,
  tryExchangeMandate,
  type MandateExchangeSave,
  type MandateExchangeState,
} from '../components/Reino/mandateExchange';
import {
  loadUpgrades,
  serializeUpgrades,
  tryBuyUpgrade,
  type GenRef,
  type UpgradeKind,
  type UpgradeState,
  type UpgradeStateSave,
} from '../components/Reino/upgrades';

export type Lines = Partial<Record<LineId, Line>>;

/** Passos pendentes acima disso ligam a tela de carregamento do catch-up
    offline. Abaixo (≈2 frames de simulação) resolve sem alarde; acima, a UI
    normal viraria um frenesi de re-renders no meio do avanço em lote. */
const CATCHUP_MIN_STEPS = MAX_STEPS_PER_FRAME * 2;

export interface CatchUp {
  total: number;
  done: number;
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

interface LoadedGame {
  lines: Lines;
  upgrades: UpgradeState;
  mandate: MandateState;
  mandateExchange: MandateExchangeState;
}

function loadReino(saveKey: string): LoadedGame {
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

function serializeReino(g: LoadedGame): ReinoSave {
  const out: Partial<Record<LineId, LineSave>> = {};
  for (const def of ENABLED_LINES) {
    const l = g.lines[def.id];
    if (l) out[def.id] = serializeLine(l);
  }
  return {
    lines: out,
    upgrades: serializeUpgrades(g.upgrades),
    ...serializeMandate(g.mandate),
    mandateExchange: serializeMandateExchange(g.mandateExchange),
  };
}

/** Catch-up pendente já na carga (volta de um período offline) — deixa a
    tela de carregamento aparecer no primeiro paint, sem flash da UI normal. */
function initialCatchUp(lines: Lines): CatchUp | null {
  const l = lines.comida;
  if (!l?.started || l.startedAt === undefined) return null;
  const target = Math.floor((Date.now() - l.startedAt) / (SIM_STEP_S * 1000));
  const pending = target - l.steps;
  return pending > CATCHUP_MIN_STEPS ? { total: pending, done: 0 } : null;
}

const mapAllLines = (lines: Lines, fn: (l: Line) => Line): Lines => {
  const next: Lines = { ...lines };
  for (const d of ENABLED_LINES) {
    const l = next[d.id];
    if (l) next[d.id] = fn(l);
  }
  return next;
};

interface GameStore extends LoadedGame {
  saveKey: string;
  catchUp: CatchUp | null;

  /** (Re)carrega do slot ativo — usado no boot, ao trocar de slot e ao
      resetar o save. */
  hydrate: () => void;
  /** Grava o estado vivo no localStorage (chave do slot que o carregou). */
  persist: () => void;
  /** Um avanço da simulação (chamado pelo runtime a cada frame): executa os
      passos devidos desde a âncora e gerencia o catch-up. */
  tick: () => void;

  setModeAll: (mode: Mode) => void;
  startAll: () => void;
  buyGen: (lineId: LineId, index: number) => boolean;
  buyUpgrade: (target: 'global' | GenRef, kind: UpgradeKind) => boolean;
  exchangeMandate: (lineId: LineId) => boolean;
}

export const useGameStore = create<GameStore>()((set, get) => {
  const saveKey = saveKeyFor('reino');
  const loaded = loadReino(saveKey);

  return {
    ...loaded,
    saveKey,
    catchUp: initialCatchUp(loaded.lines),

    hydrate: () => {
      const key = saveKeyFor('reino');
      const g = loadReino(key);
      set({ ...g, saveKey: key, catchUp: initialCatchUp(g.lines) });
    },

    persist: () => {
      const s = get();
      writeSave(s.saveKey, serializeReino(s));
    },

    tick: () => {
      const s = get();
      const anchor = s.lines.comida;
      if (!anchor?.started || anchor.startedAt === undefined) return;

      const target = Math.floor(
        (Date.now() - anchor.startedAt) / (SIM_STEP_S * 1000)
      );
      const pending = target - anchor.steps;

      // Muito atraso acumulado (volta de offline): liga a tela de
      // carregamento; o estado continua sendo aplicado a cada lote.
      const catchUp =
        s.catchUp ?? (pending > CATCHUP_MIN_STEPS ? { total: pending, done: 0 } : null);

      const todo = Math.min(pending, MAX_STEPS_PER_FRAME);
      if (todo <= 0) {
        if (catchUp !== s.catchUp) set({ catchUp });
        return;
      }

      const result = advanceKingdom(
        s.lines,
        ENABLED_LINES,
        todo,
        s.upgrades,
        s.mandate,
        s.mandateExchange.purchases
      );
      const remaining = pending - todo;
      set({
        lines: result.lines,
        // Preserva a identidade quando o gasto não mudou (evita re-render à toa)
        mandate:
          result.mandate.spent !== s.mandate.spent ? result.mandate : s.mandate,
        catchUp:
          catchUp && remaining > 0
            ? { total: catchUp.total, done: catchUp.total - remaining }
            : null,
      });
    },

    setModeAll: (mode) =>
      set((state) => ({ lines: mapAllLines(state.lines, (l) => ({ ...l, mode })) })),

    startAll: () => {
      const now = Date.now();
      set((state) => ({
        mandate: emptyMandate(),
        mandateExchange: emptyMandateExchange(),
        lines: mapAllLines(state.lines, (l) => ({
          ...l,
          started: true,
          startedAt: now,
          steps: 0,
        })),
      }));
      get().persist();
    },

    buyGen: (lineId, index) => {
      const s = get();
      const def = lineDefOf(lineId);
      const cur = s.lines[lineId];
      if (!cur) return false;
      const before = cur.gens[index].bought;
      const result = engineBuyGen(
        cur,
        index,
        def.genCount,
        def.eco,
        lineId,
        s.upgrades,
        s.mandate,
        s.mandateExchange.purchases
      );
      const success = result.line.gens[index].bought > before;
      if (success) {
        set({
          lines: { ...s.lines, [lineId]: result.line },
          mandate: result.mandate,
        });
        get().persist();
      }
      return success;
    },

    buyUpgrade: (target, kind) => {
      const s = get();
      const result = tryBuyUpgrade(s.lines, s.upgrades, target, kind);
      if (!result) return false;
      set({ lines: result.lines as Lines, upgrades: result.upgrades });
      get().persist();
      return true;
    },

    exchangeMandate: (lineId) => {
      const s = get();
      const steps = s.lines.comida?.steps ?? 0;
      const result = tryExchangeMandate(s.lines, s.mandateExchange, lineId, steps);
      if (!result) return false;
      set({ lines: result.lines as Lines, mandateExchange: result.exchange });
      get().persist();
      return true;
    },
  };
});

/** Runtime do jogo: rAF chamando tick() (o motor decide se há passo novo,
    4x/s) + persistência periódica. Vive fora do React — a simulação roda
    independente de qual página está montada. Retorna cleanup (StrictMode
    monta/desmonta efeitos duas vezes em dev). */
export function startGameRuntime(): () => void {
  let rafId = 0;
  const frame = () => {
    useGameStore.getState().tick();
    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);

  const persist = () => useGameStore.getState().persist();
  const intervalId = setInterval(persist, 1000);
  window.addEventListener('beforeunload', persist);

  return () => {
    cancelAnimationFrame(rafId);
    clearInterval(intervalId);
    window.removeEventListener('beforeunload', persist);
  };
}
