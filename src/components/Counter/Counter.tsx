import { useEffect, useRef, useState } from 'react';
import Decimal from 'break_eternity.js';
import { fmt, fmtRate, fmtTime } from '../../lib/format';
import { COUNTER_SAVE_KEY, loadSave, writeSave } from '../../lib/storage';
import styles from './Counter.module.css';

const BASE_RATE = new Decimal(0.1);

/** Segurar o botão: dispara na hora, espera um pouco e repete rápido até soltar. */
const HOLD_INITIAL_DELAY_MS = 350;
const HOLD_REPEAT_MS = 80;

interface CounterSave {
  value: string;
  rate: string;
  uptime: number;
}

export default function Counter() {
  const [value, setValue] = useState<Decimal>(() => {
    const s = loadSave<CounterSave>(COUNTER_SAVE_KEY);
    return s ? new Decimal(s.value) : new Decimal(0);
  });
  const [rate, setRate] = useState<Decimal>(() => {
    const s = loadSave<CounterSave>(COUNTER_SAVE_KEY);
    return s ? new Decimal(s.rate) : BASE_RATE;
  });
  const [uptime, setUptime] = useState(
    () => loadSave<CounterSave>(COUNTER_SAVE_KEY)?.uptime ?? 0
  );
  const [running, setRunning] = useState(false);

  // Save automático: 1x por segundo e ao fechar/recarregar a página.
  const saveRef = useRef({ value, rate, uptime });
  saveRef.current = { value, rate, uptime };
  useEffect(() => {
    const persist = () => {
      const s = saveRef.current;
      writeSave(COUNTER_SAVE_KEY, {
        value: s.value.toString(),
        rate: s.rate.toString(),
        uptime: s.uptime,
      } satisfies CounterSave);
    };
    const id = setInterval(persist, 1000);
    window.addEventListener('beforeunload', persist);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', persist);
    };
  }, []);
  const rafRef = useRef<number>();
  const lastTickRef = useRef<number>(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const holdIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const doubleRate = () => setRate((r) => r.mul(2));

  const startHold = () => {
    doubleRate();
    holdTimerRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(doubleRate, HOLD_REPEAT_MS);
    }, HOLD_INITIAL_DELAY_MS);
  };

  const stopHold = () => {
    if (holdTimerRef.current !== undefined) clearTimeout(holdTimerRef.current);
    if (holdIntervalRef.current !== undefined) clearInterval(holdIntervalRef.current);
    holdTimerRef.current = undefined;
    holdIntervalRef.current = undefined;
  };

  useEffect(() => stopHold, []);

  useEffect(() => {
    if (!running) return;

    lastTickRef.current = performance.now();

    const tick = (now: number) => {
      const dtSeconds = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setValue((v) => v.add(rate.mul(dtSeconds)));
      setUptime((u) => u + dtSeconds);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [running, rate]);

  return (
    <div className={styles.counter}>
      <span className={styles.number}>{fmt(value)}</span>
      <span className={styles.rate}>+{fmtRate(rate)} / s</span>
      <span className={styles.uptime}>rodando há {fmtTime(uptime)}</span>

      <div className={styles.actions}>
        <button
          className="btn-secondary"
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onContextMenu={(e) => e.preventDefault()}
        >
          Dobrar produção
        </button>
        <button className="btn-primary" onClick={() => setRunning((r) => !r)}>
          {running ? 'Pausar' : 'Iniciar'}
        </button>
      </div>
    </div>
  );
}
