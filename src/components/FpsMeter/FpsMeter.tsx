import { useEffect, useState } from 'react';
import styles from './FpsMeter.module.css';

interface FrameStats {
  fps: number;
  avgMs: number;
  maxMs: number;
}

/** Mede FPS e frame time via requestAnimationFrame, atualizando o display 2x por segundo. */
export default function FpsMeter() {
  const [stats, setStats] = useState<FrameStats>({ fps: 0, avgMs: 0, maxMs: 0 });

  useEffect(() => {
    let rafId: number;
    let frames = 0;
    let maxDelta = 0;
    let windowStart = performance.now();
    let lastFrame = windowStart;

    const tick = (now: number) => {
      frames++;
      maxDelta = Math.max(maxDelta, now - lastFrame);
      lastFrame = now;

      const elapsed = now - windowStart;
      if (elapsed >= 500) {
        setStats({
          fps: Math.round((frames * 1000) / elapsed),
          avgMs: elapsed / frames,
          maxMs: maxDelta,
        });
        frames = 0;
        maxDelta = 0;
        windowStart = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className={styles.bar}>
      <div className={styles.pill}>
        <span className={styles.value}>{stats.fps}</span>
        <span className={styles.label}>fps</span>
      </div>
      <div className={styles.pill}>
        <span className={styles.value}>{stats.avgMs.toFixed(1)}</span>
        <span className={styles.label}>ms</span>
        <span className={styles.divider} />
        <span className={styles.label}>máx</span>
        <span className={styles.value}>{stats.maxMs.toFixed(1)}</span>
      </div>
    </div>
  );
}
