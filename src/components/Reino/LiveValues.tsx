/** Contadores ao vivo (60fps, fora do React) construídos sobre a réplica do
    motor (liveReplay). Cada componente renderiza um <span> vazio e escreve o
    texto via rAF — o React nunca disputa o nó. */

import { useEffect, useRef } from 'react';
import Decimal from 'break_eternity.js';
import { fmtLive, fmtRate } from '../../lib/format';
import {
  cycleSecondsOf,
  prodPerCycleOf,
  type Line,
  type LineEconomy,
} from '../../game/engine';
import type { LineId } from '../../game/lines';
import {
  cycleSecondsWithUpgrades,
  productionFactor,
  type UpgradeState,
} from '../../game/upgrades';
import { buildLiveSnap, liveWindow, replayValue, type LiveSnap } from './liveReplay';

interface LiveProps {
  className: string;
  line: Line | undefined;
  lineId: LineId;
  eco: LineEconomy;
  upgrades: UpgradeState;
  /** Âncora GLOBAL da simulação (linha comida). */
  anchorStartedAt: number | undefined;
  anchorSteps: number;
}

/** Loop de rAF que escreve `compute()` no span quando o texto muda. */
function useLiveText(compute: () => string | null) {
  const elRef = useRef<HTMLSpanElement>(null);
  const computeRef = useRef(compute);
  computeRef.current = compute;

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const el = elRef.current;
      const text = computeRef.current();
      if (el && text !== null && el.textContent !== text) {
        el.textContent = text;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return elRef;
}

/** Odômetro do recurso base: committed + entregas do gerador 1 desde o
    commit, com casas extras para o número girar a cada entrega real. */
export function LiveBaseValue({
  className,
  line,
  lineId,
  eco,
  upgrades,
  anchorStartedAt,
  anchorSteps,
}: LiveProps) {
  const snapRef = useRef<{ snap: LiveSnap; base: Decimal } | null>(null);
  snapRef.current = line
    ? {
        snap: buildLiveSnap(line, lineId, eco, upgrades, anchorStartedAt, anchorSteps),
        base: line.base,
      }
    : null;

  const elRef = useLiveText(() => {
    const s = snapRef.current;
    if (!s) return null;
    const { t, replaySteps } = liveWindow(s.snap);
    return fmtLive(replayValue(s.snap, 0, replaySteps, t, s.base));
  });

  return <span className={className} ref={elRef} />;
}

/** Taxa "+X /s" do recurso base: quantidade AO VIVO do gerador 1 (committed
    + entregas do gerador 2) × entrega por unidade ÷ ciclo efetivo. */
export function LiveBaseRate({
  className,
  line,
  lineId,
  eco,
  upgrades,
  anchorStartedAt,
  anchorSteps,
}: LiveProps) {
  const snapRef = useRef<{
    snap: LiveSnap;
    g0Amount: Decimal;
    unitRate: Decimal;
  } | null>(null);
  snapRef.current = line
    ? {
        snap: buildLiveSnap(line, lineId, eco, upgrades, anchorStartedAt, anchorSteps),
        g0Amount: line.gens[0]?.amount ?? new Decimal(0),
        unitRate: prodPerCycleOf(0, eco)
          .mul(productionFactor(upgrades, lineId, 0))
          .div(
            cycleSecondsWithUpgrades(cycleSecondsOf(0, eco), upgrades, lineId, 0)
          ),
      }
    : null;

  const elRef = useLiveText(() => {
    const s = snapRef.current;
    if (!s) return null;
    const { t, replaySteps } = liveWindow(s.snap);
    const amount = replayValue(s.snap, 1, replaySteps, t, s.g0Amount);
    return `+${fmtRate(amount.mul(s.unitRate))} / s`;
  });

  return <span className={className} ref={elRef} />;
}
