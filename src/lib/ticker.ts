/** Frame loop that follows the "vsync" preference live.

    On (default): requestAnimationFrame — one tick per monitor refresh,
    the browser's normal pacing.

    Off: a self-posting MessageChannel — each tick schedules the next via
    postMessage, which fires as fast as the event loop allows (no vsync, no
    setTimeout 4ms clamp). The deterministic simulation is unaffected either
    way: ticks only decide how often the wall clock is checked. */

import { getVideoPrefs } from './prefs';

export function startTicker(tick: (now: number) => void): () => void {
  let stopped = false;
  let rafId = 0;
  const channel = new MessageChannel();

  const schedule = () => {
    if (stopped) return;
    if (getVideoPrefs().vsync) rafId = requestAnimationFrame(run);
    else channel.port2.postMessage(null);
  };

  const run = () => {
    if (stopped) return;
    tick(performance.now());
    schedule();
  };

  channel.port1.onmessage = run;
  schedule();

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
    channel.port1.close();
    channel.port2.close();
  };
}
