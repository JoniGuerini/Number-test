import { useEffect, useRef, useState } from 'react';
import Decimal from 'break_eternity.js';
import { fmt, fmtRate, fmtTime } from '../../lib/format';
import { COUNTER_SAVE_KEY, loadSave, writeSave } from '../../lib/storage';
import styles from './Counter.module.css';
// Reusa o visual dos cardzinhos do topo (padrão das abas Geradores/Ciclos)
import hub from '../Generators/Generators.module.css';

const BASE_RATE = new Decimal(0.1);

/** Segurar o botão: dispara na hora, espera um pouco e repete rápido até soltar. */
const HOLD_INITIAL_DELAY_MS = 350;
const HOLD_REPEAT_MS = 80;

interface CounterSave {
  value: string;
  rate: string;
  uptime: number;
  running?: boolean;
  /** Date.now() do momento do save — para recuperar o tempo do refresh. */
  savedAt?: number;
}

function loadCounter() {
  const s = loadSave<CounterSave>(COUNTER_SAVE_KEY);
  if (!s) {
    return { value: new Decimal(0), rate: BASE_RATE, uptime: 0, running: false };
  }

  let value = new Decimal(s.value);
  let uptime = s.uptime;
  const rate = new Decimal(s.rate);
  const running = s.running ?? false;

  // Se estava rodando, recupera o tempo decorrido desde o último save
  // (refresh, aba fechada) — nada se perde.
  if (running && s.savedAt !== undefined) {
    const elapsed = (Date.now() - s.savedAt) / 1000;
    if (elapsed > 0) {
      value = value.add(rate.mul(elapsed));
      uptime += elapsed;
    }
  }
  return { value, rate, uptime, running };
}

export default function Counter() {
  const [initial] = useState(loadCounter);
  const [value, setValue] = useState<Decimal>(initial.value);
  const [rate, setRate] = useState<Decimal>(initial.rate);
  const [uptime, setUptime] = useState(initial.uptime);
  const [running, setRunning] = useState(initial.running);

  // Save automático: 1x por segundo e ao fechar/recarregar a página.
  const saveRef = useRef({ value, rate, uptime, running });
  saveRef.current = { value, rate, uptime, running };
  useEffect(() => {
    const persist = () => {
      const s = saveRef.current;
      writeSave(COUNTER_SAVE_KEY, {
        value: s.value.toString(),
        rate: s.rate.toString(),
        uptime: s.uptime,
        running: s.running,
        savedAt: Date.now(),
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
      <div className={hub.corner}>
        <div className={hub.timePill}>
          <span className={hub.timeValue}>{fmtTime(uptime)}</span>
          <span className={hub.timeLabel}>tempo</span>
        </div>
      </div>

      <span className={styles.number}>{fmt(value)}</span>
      <span className={styles.rate}>+{fmtRate(rate)} / s</span>

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
