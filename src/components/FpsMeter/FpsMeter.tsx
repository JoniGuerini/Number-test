import { useEffect, useState } from 'react';
import styles from './FpsMeter.module.css';

interface FrameStats {
  fps: number;
  avgMs: number;
  maxMs: number;
}

/** Battery Status API (Chrome/Edge; Safari e Firefox não expõem). */
interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
}

function useBattery() {
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(
    null
  );

  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManager>;
    };
    if (!nav.getBattery) return;

    let disposed = false;
    let manager: BatteryManager | null = null;
    const update = () => {
      if (manager && !disposed) {
        setBattery({ level: manager.level, charging: manager.charging });
      }
    };

    void nav.getBattery().then((m) => {
      if (disposed) return;
      manager = m;
      update();
      m.addEventListener('levelchange', update);
      m.addEventListener('chargingchange', update);
    });

    return () => {
      disposed = true;
      manager?.removeEventListener('levelchange', update);
      manager?.removeEventListener('chargingchange', update);
    };
  }, []);

  return battery;
}

/** Mede FPS e frame time via requestAnimationFrame, atualizando o display 2x por segundo. */
export default function FpsMeter() {
  const [stats, setStats] = useState<FrameStats>({ fps: 0, avgMs: 0, maxMs: 0 });
  const battery = useBattery();

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
        <span className={import.meta.env.DEV ? styles.envDev : styles.envProd}>
          {import.meta.env.DEV ? 'localhost' : 'produção'}
        </span>
      </div>
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
      {battery && (
        <div className={styles.pill}>
          <span
            className={`${styles.value} ${
              battery.level <= 0.2 && !battery.charging ? styles.batteryLow : ''
            }`}
          >
            {battery.charging ? '⚡' : ''}
            {Math.round(battery.level * 100)}%
          </span>
          <span className={styles.label}>bat</span>
        </div>
      )}
    </div>
  );
}
