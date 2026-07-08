import { useEffect, useRef, useState } from 'react';
import { fmtTime } from '../../lib/format';
import { useI18n, type TKey } from '../../lib/locale';
import { useGameStore } from '../../store/gameStore';
import { ENABLED_LINES, type LineId } from '../Reino/lines';
import type { Line } from '../Reino/engine';
// Reusa o esqueleto visual das listas de produção (scroll, fades)
import gstyles from '../../styles/productionList.module.css';
import styles from './Activity.module.css';

interface Entry {
  gen: number;
  unlockedAt: number;
  /** Intervalo desde o desbloqueio anterior. */
  delta?: number;
  /** Diferença entre este intervalo e o anterior (ritmo). */
  accel?: number;
}

/** Converte a sequência de tempos de desbloqueio (g1, g2, …) em entradas do
    log com intervalo e ritmo (os desbloqueios são sempre sequenciais). */
function entriesFromTimes(times: number[]): Entry[] {
  return times.map((unlockedAt, idx) => {
    const prev = idx === 0 ? 0 : times[idx - 1];
    const prevPrev = idx <= 1 ? 0 : times[idx - 2];
    const delta = unlockedAt - prev;
    const prevDelta = idx === 0 ? undefined : prev - prevPrev;
    return {
      gen: idx + 1,
      unlockedAt,
      delta,
      accel: prevDelta !== undefined ? delta - prevDelta : undefined,
    };
  });
}

/** Constrói as entradas do log a partir do estado vivo da linha. */
function buildEntries(line: Line | undefined): {
  entries: Entry[];
  uptime: number;
} {
  if (!line) return { entries: [], uptime: 0 };
  const times = line.gens
    .map((g) => g.unlockedAt)
    .filter((u): u is number => u !== undefined);
  return { entries: entriesFromTimes(times), uptime: line.uptime };
}

interface ActivityProps {
  /** Leva o jogador para o Reino (CTA do estado vazio). */
  onNavigate: (page: 'reino') => void;
}

/** Log de desbloqueios do Reino, uma sub-aba por linha de produção, com
    cada tempo explicado. */
export default function Activity({ onNavigate }: ActivityProps) {
  const { t } = useI18n();
  const [line, setLine] = useState<LineId>(ENABLED_LINES[0]?.id ?? 'comida');
  const lineState = useGameStore((s) => s.lines[line]);
  const listRef = useRef<HTMLDivElement>(null);

  const { entries, uptime } = buildEntries(lineState);

  // Mesma animação de scroll da lista de produção do Reino (alvo por frame)
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

  // "Colado no fim": segue os registros novos, a menos que o usuário tenha
  // rolado para cima para ler o histórico.
  const stickRef = useRef(true);

  // Entrada nova no log (ou troca de aba) → rola até o fim
  const entryCount = entries.length;
  useEffect(() => {
    if (stickRef.current) scrollToEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryCount, line]);

  // Setinhas esmaecidas: aparecem quando há conteúdo além das bordas
  const [edges, setEdges] = useState({ above: false, below: false });
  const updateEdges = () => {
    const el = listRef.current;
    if (!el) return;
    const above = el.scrollTop > 4;
    const below = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setEdges((e) => (e.above === above && e.below === below ? e : { above, below }));
  };

  const onListScroll = () => {
    const el = listRef.current;
    if (el) {
      stickRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    }
    updateEdges();
  };

  useEffect(() => {
    updateEdges();
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      // A aba oculta tem altura 0; ao ficar visível a lista ganha tamanho e,
      // se estávamos colados no fim, recola direto (sem animação).
      if (stickRef.current) el.scrollTop = el.scrollHeight;
      updateEdges();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryCount]);

  // ===== Resumo do header =====
  const last = entries[entries.length - 1];
  const avgInterval =
    entries.length > 1 ? last.unlockedAt / (entries.length - 1) : undefined;
  const sinceLast = last ? Math.max(uptime - last.unlockedAt, 0) : 0;

  const gameName = t('nav.reino');
  const lineName = t(`reino.line.${line}` as TKey);

  return (
    <div className={styles.wrap}>
      {/* Sub-abas por linha de produção, espelhando as abas do Reino */}
      <nav className={styles.tabs}>
        {ENABLED_LINES.map((l) => (
          <button
            key={l.id}
            className={`${styles.tab} ${line === l.id ? styles.tabActive : ''}`}
            onClick={() => {
              stickRef.current = true;
              setLine(l.id);
            }}
          >
            {t(`reino.line.${l.id}` as TKey)}
          </button>
        ))}
      </nav>

      {entries.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            {t('activity.empty', { game: lineName })}
          </p>
          <button className="btn-primary" onClick={() => onNavigate('reino')}>
            {t('activity.cta', { game: gameName })}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.summary}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{entries.length}</span>
              <span className={styles.summaryLabel}>{t('activity.unlocked')}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{fmtTime(uptime)}</span>
              <span className={styles.summaryLabel}>{t('activity.playTime')}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>
                {avgInterval !== undefined ? fmtTime(avgInterval) : '—'}
              </span>
              <span className={styles.summaryLabel}>
                {t('activity.avgInterval')}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{fmtTime(sinceLast)}</span>
              <span className={styles.summaryLabel}>{t('activity.sinceLast')}</span>
            </div>
          </div>

          <div className={gstyles.listWrap}>
            {edges.above && (
              <button
                className={`${gstyles.fade} ${gstyles.fadeTop}`}
                onClick={scrollToStart}
                aria-label={t('common.toStart')}
              >
                ↑
              </button>
            )}

            <div className={gstyles.list} ref={listRef} onScroll={onListScroll}>
              {entries.map((entry) => (
                <div key={entry.gen} className={styles.entry}>
                  <span className={styles.entryTitle}>
                    {t(`reino.gen.${line}.${entry.gen}` as TKey)}
                  </span>

                  <div className={styles.fields}>
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>
                        {t('activity.unlockedWith')}
                      </span>
                      <span className={styles.fieldValue}>
                        {t('activity.ofPlay', { time: fmtTime(entry.unlockedAt) })}
                      </span>
                    </div>

                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>
                        {t('activity.sincePrev')}
                      </span>
                      <span className={styles.fieldValue}>
                        {entry.gen === 1
                          ? t('activity.gameStart')
                          : `+${fmtTime(entry.delta ?? 0)}`}
                      </span>
                    </div>

                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>
                        {t('activity.pace')}
                      </span>
                      {entry.accel === undefined ? (
                        <span className={styles.fieldValue}>—</span>
                      ) : entry.accel === 0 ? (
                        <span className={styles.fieldValue}>
                          {t('activity.samePace')}
                        </span>
                      ) : (
                        <span
                          className={`${styles.fieldValue} ${
                            entry.accel > 0 ? styles.slower : styles.faster
                          }`}
                        >
                          {entry.accel > 0 ? '+' : '−'}
                          {fmtTime(Math.abs(entry.accel))}{' '}
                          {entry.accel > 0
                            ? t('activity.slower')
                            : t('activity.faster')}
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
                aria-label={t('common.toEnd')}
              >
                ↓
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
