import { useEffect, useMemo, useRef, useState } from 'react';
import { SIMULATED_UNLOCKS } from '../../data/simulatedUnlocks';
import { fmtTime } from '../../lib/format';
import { useI18n, type TKey } from '../../lib/locale';
import { loadSave, saveKeyFor } from '../../lib/storage';
import { ENABLED_LINES, type LineId } from '../Reino/lines';
// Reusa o esqueleto visual das listas de produção (scroll, fades)
import gstyles from '../../styles/productionList.module.css';
import styles from './Activity.module.css';

/** Real = desbloqueios do seu save; Simulada = previsão determinística do
    modo automático (pré-computada por scripts/simulate-reino.mjs deep). */
type ActivityView = 'real' | 'sim';

/** Campos de uma linha do Reino que interessam ao log. */
interface LineSaveLite {
  gens: { bought: number; unlockedAt?: number }[];
  uptime: number;
}

/** Save do Reino: uma linha por chave. */
interface ReinoSaveLite {
  lines?: Partial<Record<string, LineSaveLite>>;
}

interface Entry {
  gen: number;
  unlockedAt: number;
  /** Intervalo desde o desbloqueio anterior. */
  delta?: number;
  /** Diferença entre este intervalo e o anterior (ritmo). */
  accel?: number;
}

/** Converte a sequência de tempos de desbloqueio (g1, g2, …) em entradas do
    log com intervalo e ritmo. Serve tanto pro save real quanto pra simulação
    (os desbloqueios são sempre sequenciais). */
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

/** Constrói as entradas do log a partir de um save (gens + uptime). */
function buildEntries(save: LineSaveLite | null | undefined): {
  entries: Entry[];
  uptime: number;
} {
  if (!save) return { entries: [], uptime: 0 };
  const times = save.gens
    .map((g) => g.unlockedAt)
    .filter((u): u is number => u !== undefined);
  return { entries: entriesFromTimes(times), uptime: save.uptime };
}

/** Lê o log de UMA linha do Reino (o save tem uma sub-chave por linha). */
function readLog(key: string, line: LineId): { entries: Entry[]; uptime: number } {
  const save = loadSave<ReinoSaveLite>(key);
  return buildEntries(save?.lines?.[line]);
}

interface ActivityProps {
  /** Leva o jogador para o Reino (CTA do estado vazio). */
  onNavigate: (page: 'reino') => void;
}

/** Log de desbloqueios do Reino: abas Real (seu save) / Simulada (previsão
    do automático), uma sub-aba por linha de produção, cada tempo explicado. */
export default function Activity({ onNavigate }: ActivityProps) {
  const { t } = useI18n();
  // Chave do save do slot ativo (trocar de slot remonta o componente)
  const [key] = useState(() => saveKeyFor('reino'));
  const [view, setView] = useState<ActivityView>('real');
  const [line, setLine] = useState<LineId>(ENABLED_LINES[0]?.id ?? 'comida');
  const [log, setLog] = useState(() => readLog(key, line));
  const listRef = useRef<HTMLDivElement>(null);

  // O save é gravado 1x/s; reler no mesmo ritmo mantém o log vivo. Trocar de
  // aba relê na hora (o efeito re-executa com a nova linha).
  useEffect(() => {
    if (view !== 'real') return;
    setLog(readLog(key, line));
    const id = setInterval(() => setLog(readLog(key, line)), 1000);
    return () => clearInterval(id);
  }, [key, line, view]);

  const simEntries = useMemo(
    () => entriesFromTimes(SIMULATED_UNLOCKS[line] ?? []),
    [line]
  );
  const entries = view === 'real' ? log.entries : simEntries;
  const uptime = log.uptime;

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
  }, [entryCount, line, view]);

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
      {/* Abas de visão: seu save (Real) × previsão do automático (Simulada).
          Mesma linguagem (e largura total) das abas de linha logo abaixo. */}
      <nav className={styles.tabs}>
        {(['real', 'sim'] as ActivityView[]).map((v) => (
          <button
            key={v}
            className={`${styles.tab} ${view === v ? styles.tabActive : ''}`}
            onClick={() => {
              stickRef.current = true;
              setView(v);
            }}
          >
            {t(`activity.view.${v}` as TKey)}
          </button>
        ))}
      </nav>

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
            {view === 'real' ? (
              <div className={styles.summaryItem}>
                <span className={styles.summaryValue}>{fmtTime(uptime)}</span>
                <span className={styles.summaryLabel}>{t('activity.playTime')}</span>
              </div>
            ) : (
              <div className={styles.summaryItem}>
                <span className={styles.summaryValue}>
                  {last ? fmtTime(last.unlockedAt) : '—'}
                </span>
                <span className={styles.summaryLabel}>{t('activity.lastUnlock')}</span>
              </div>
            )}
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>
                {avgInterval !== undefined ? fmtTime(avgInterval) : '—'}
              </span>
              <span className={styles.summaryLabel}>
                {t('activity.avgInterval')}
              </span>
            </div>
            {view === 'real' && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryValue}>{fmtTime(sinceLast)}</span>
                <span className={styles.summaryLabel}>{t('activity.sinceLast')}</span>
              </div>
            )}
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
