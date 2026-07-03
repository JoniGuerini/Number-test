import { useEffect, useRef, useState } from 'react';
import { fmtTime } from '../../lib/format';
import { CYCLES_SAVE_KEY, loadSave } from '../../lib/storage';
// Reusa o esqueleto visual das listas de geradores (scroll, fades)
import gstyles from '../Generators/Generators.module.css';
import styles from './Activity.module.css';

/** Campos do save dos Ciclos que interessam ao log de atividade. */
interface CycSaveLite {
  gens: { bought: number; unlockedAt?: number }[];
  uptime: number;
}

interface Entry {
  gen: number;
  unlockedAt: number;
  /** Intervalo desde o desbloqueio anterior. */
  delta?: number;
  /** Diferença entre este intervalo e o anterior (ritmo). */
  accel?: number;
}

function readEntries(): Entry[] {
  const save = loadSave<CycSaveLite>(CYCLES_SAVE_KEY);
  if (!save) return [];

  const unlocked = save.gens
    .map((g, i) => ({ gen: i + 1, unlockedAt: g.unlockedAt }))
    .filter((e): e is { gen: number; unlockedAt: number } => e.unlockedAt !== undefined);

  return unlocked.map((e, idx) => {
    const prev = idx === 0 ? 0 : unlocked[idx - 1].unlockedAt;
    const prevPrev = idx <= 1 ? 0 : unlocked[idx - 2].unlockedAt;
    const delta = e.unlockedAt - prev;
    const prevDelta = idx === 0 ? undefined : prev - prevPrev;
    return {
      ...e,
      delta,
      accel: prevDelta !== undefined ? delta - prevDelta : undefined,
    };
  });
}

/** Log de desbloqueios do modo Ciclos, com cada tempo explicado. */
export default function Activity() {
  const [entries, setEntries] = useState<Entry[]>(readEntries);
  const listRef = useRef<HTMLDivElement>(null);

  // O save dos Ciclos é gravado 1x/s; reler no mesmo ritmo mantém o log vivo.
  useEffect(() => {
    const id = setInterval(() => setEntries(readEntries()), 1000);
    return () => clearInterval(id);
  }, []);

  // Mesma animação de scroll das listas de geradores (alvo recalculado por frame)
  const scrollAnimRef = useRef(0);
  const animateScroll = (getTarget: (el: HTMLDivElement) => number) => {
    const el = listRef.current;
    if (!el) return;
    const token = ++scrollAnimRef.current;
    const from = el.scrollTop;
    const start = performance.now();
    const DURATION_MS = 400;

    const step = (now: number) => {
      const list = listRef.current;
      if (!list || scrollAnimRef.current !== token) return;
      const t = Math.min((now - start) / DURATION_MS, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      list.scrollTop = from + (getTarget(list) - from) * ease;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const scrollToStart = () => animateScroll(() => 0);
  const scrollToEnd = () =>
    animateScroll((el) => el.scrollHeight - el.clientHeight);

  // Entrada nova no log → rola até ela (o mais recente fica no fim da lista)
  const entryCount = entries.length;
  useEffect(() => {
    scrollToEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryCount]);

  // Setinhas esmaecidas: aparecem quando há conteúdo além das bordas
  const [edges, setEdges] = useState({ above: false, below: false });
  const updateEdges = () => {
    const el = listRef.current;
    if (!el) return;
    const above = el.scrollTop > 4;
    const below = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setEdges((e) => (e.above === above && e.below === below ? e : { above, below }));
  };
  useEffect(() => {
    updateEdges();
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryCount]);

  if (entries.length === 0) {
    return (
      <div className={styles.empty}>
        Nenhum desbloqueio registrado ainda — compre o primeiro gerador nos Ciclos.
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>Histórico de desbloqueios do modo Ciclos.</p>

      <div className={gstyles.listWrap}>
        {edges.above && (
          <button
            className={`${gstyles.fade} ${gstyles.fadeTop}`}
            onClick={scrollToStart}
            aria-label="Ir para o começo"
          >
            ↑
          </button>
        )}

        <div className={gstyles.list} ref={listRef} onScroll={updateEdges}>
          {entries.map((entry) => (
            <div key={entry.gen} className={styles.entry}>
              <span className={styles.entryTitle}>Gerador {entry.gen}</span>

              <div className={styles.fields}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>desbloqueado com</span>
                  <span className={styles.fieldValue}>
                    {fmtTime(entry.unlockedAt)} de jogo
                  </span>
                </div>

                <div className={styles.field}>
                  <span className={styles.fieldLabel}>tempo desde o anterior</span>
                  <span className={styles.fieldValue}>
                    {entry.gen === 1
                      ? 'início do jogo'
                      : `+${fmtTime(entry.delta ?? 0)}`}
                  </span>
                </div>

                <div className={styles.field}>
                  <span className={styles.fieldLabel}>
                    ritmo vs. desbloqueio anterior
                  </span>
                  {entry.accel === undefined ? (
                    <span className={styles.fieldValue}>—</span>
                  ) : entry.accel === 0 ? (
                    <span className={styles.fieldValue}>mesmo ritmo</span>
                  ) : (
                    <span
                      className={`${styles.fieldValue} ${
                        entry.accel > 0 ? styles.slower : styles.faster
                      }`}
                    >
                      {entry.accel > 0 ? '+' : '−'}
                      {fmtTime(Math.abs(entry.accel))}{' '}
                      {entry.accel > 0 ? 'mais lento' : 'mais rápido'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {edges.below && (
          <button
            className={`${gstyles.fade} ${gstyles.fadeBottom}`}
            onClick={scrollToEnd}
            aria-label="Ir para o fim"
          >
            ↓
          </button>
        )}
      </div>
    </div>
  );
}
