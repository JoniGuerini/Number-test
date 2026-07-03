import { useEffect, useRef, useState } from 'react';
import Decimal from 'break_eternity.js';
import { fmt, fmtRate, fmtTime } from '../../lib/format';
import { getDateLocale, useI18n } from '../../lib/i18n';
import { loadSave, saveKeyFor, writeSave } from '../../lib/storage';
import { startTicker } from '../../lib/ticker';
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
  /** Date.now() do primeiro Iniciar — identifica quando o save nasceu. */
  startedAt?: number;
  /** Date.now() do momento do save — para recuperar o tempo do refresh. */
  savedAt?: number;
}

function loadCounter(saveKey: string) {
  const s = loadSave<CounterSave>(saveKey);
  if (!s) {
    return {
      value: new Decimal(0),
      rate: BASE_RATE,
      uptime: 0,
      running: false,
      startedAt: undefined as number | undefined,
    };
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
  return { value, rate, uptime, running, startedAt: s.startedAt };
}

export default function Counter() {
  const { t } = useI18n();
  // Amarra a instância ao slot ativo do momento da montagem
  // (trocar de slot remonta o componente)
  const [saveKey] = useState(() => saveKeyFor('contador'));
  const [initial] = useState(() => loadCounter(saveKey));
  const [value, setValue] = useState<Decimal>(initial.value);
  const [rate, setRate] = useState<Decimal>(initial.rate);
  const [uptime, setUptime] = useState(initial.uptime);
  const [running, setRunning] = useState(initial.running);
  const [startedAt, setStartedAt] = useState<number | undefined>(initial.startedAt);

  // Save automático: 1x por segundo e ao fechar/recarregar a página.
  const saveRef = useRef({ value, rate, uptime, running, startedAt });
  saveRef.current = { value, rate, uptime, running, startedAt };
  useEffect(() => {
    const persist = () => {
      const s = saveRef.current;
      writeSave(saveKey, {
        value: s.value.toString(),
        rate: s.rate.toString(),
        uptime: s.uptime,
        running: s.running,
        startedAt: s.startedAt,
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

  const toggleRunning = () => {
    // O primeiro Iniciar carimba o nascimento do save
    if (!running && startedAt === undefined) setStartedAt(Date.now());
    setRunning((r) => !r);
  };

  /** Baixa um .csv com o estado atual do contador. */
  const exportCsv = () => {
    const lines = [
      'chave,valor',
      `inicio_do_save,${startedAt !== undefined ? new Date(startedAt).toISOString() : ''}`,
      `tempo_de_jogo_s,${uptime.toFixed(1)}`,
      `tempo_de_jogo_fmt,${fmtTime(uptime)}`,
      `rodando,${running}`,
      `valor,${value.toString()}`,
      `valor_fmt,${fmt(value)}`,
      `producao_por_s,${rate.toString()}`,
      `producao_fmt,${fmtRate(rate)}`,
    ];

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contador-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!running) return;

    lastTickRef.current = performance.now();

    // startTicker segue o pref de FPS ilimitado ao vivo
    return startTicker((now) => {
      const dtSeconds = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setValue((v) => v.add(rate.mul(dtSeconds)));
      setUptime((u) => u + dtSeconds);
    });
  }, [running, rate]);

  return (
    <div className={styles.counter}>
      <div className={hub.corner}>
        <div className={hub.timePill}>
          <span className={hub.timeValue}>
            {startedAt !== undefined
              ? new Date(startedAt).toLocaleString(getDateLocale(), {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '—'}
          </span>
          <span className={hub.timeLabel}>{t('common.startLabel')}</span>
        </div>
        <div className={hub.timePill}>
          <span className={hub.timeValue}>{fmtTime(uptime)}</span>
          <span className={hub.timeLabel}>{t('common.time')}</span>
        </div>
        <button className={hub.exportBtn} onClick={exportCsv}>
          {t('common.exportCsv')}
        </button>
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
          {t('counter.double')}
        </button>
        <button className="btn-primary" onClick={toggleRunning}>
          {running ? t('counter.pause') : t('common.start')}
        </button>
      </div>
    </div>
  );
}
