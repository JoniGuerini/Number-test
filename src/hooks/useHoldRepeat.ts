import { useCallback, useEffect, useRef } from 'react';

const INITIAL_DELAY_MS = 450;
const REPEAT_MS = 80;

/** Press-and-hold: fires once on pointer down, then repeats until release.
    Callback may return `false` to stop early (ex.: sem saldo). */
export function useHoldRepeat(onAction: () => boolean | void, disabled = false) {
  const actionRef = useRef(onAction);
  // Espelha o callback mais recente no commit (não no render — regra dos refs)
  useEffect(() => {
    actionRef.current = onAction;
  });
  const timersRef = useRef<{ delay?: number; interval?: number }>({});

  const stop = useCallback(() => {
    const t = timersRef.current;
    if (t.delay !== undefined) window.clearTimeout(t.delay);
    if (t.interval !== undefined) window.clearInterval(t.interval);
    timersRef.current = {};
  }, []);

  useEffect(() => stop, [stop]);

  const run = useCallback(() => {
    if (actionRef.current() === false) stop();
  }, [stop]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      run();
      stop();
      timersRef.current.delay = window.setTimeout(() => {
        timersRef.current.interval = window.setInterval(run, REPEAT_MS);
      }, INITIAL_DELAY_MS);
    },
    [disabled, run, stop]
  );

  const onPointerUp = useCallback(() => stop(), [stop]);

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onLostPointerCapture: onPointerUp,
  };
}
