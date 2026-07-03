import { useEffect, useRef, useState } from 'react';
import { fmtTime } from '../../lib/format';
import { loadSave, saveKeyFor } from '../../lib/storage';
// Reusa o esqueleto visual das listas de geradores (scroll, fades)
import gstyles from '../Generators/Generators.module.css';
import styles from './Activity.module.css';

type LogGame = 'ciclos' | 'geradores';

const GAMES: { id: LogGame; name: string }[] = [
  { id: 'ciclos', name: 'Ciclos' },
  { id: 'geradores', name: 'Geradores' },
];

/** Campos comuns aos saves dos dois modos que interessam ao log. */
interface GameSaveLite {
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

function readLog(saveKey: string): { entries: Entry[]; uptime: number } {
  const save = loadSave<GameSaveLite>(saveKey);
  if (!save) return { entries: [], uptime: 0 };

  const unlocked = save.gens
    .map((g, i) => ({ gen: i + 1, unlockedAt: g.unlockedAt }))
    .filter((e): e is { gen: number; unlockedAt: number } => e.unlockedAt !== undefined);

  const entries = unlocked.map((e, idx) => {
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

  return { entries, uptime: save.uptime };
}

interface ActivityProps {
  /** Leva o jogador para a aba do modo (CTA do estado vazio). */
  onNavigate: (game: LogGame) => void;
}

/** Log de desbloqueios, com abas por modo e cada tempo explicado. */
export default function Activity({ onNavigate }: ActivityProps) {
  // Chaves dos saves do slot ativo (trocar de slot remonta o componente)
  const [keys] = useState(() => ({
    ciclos: saveKeyFor('ciclos'),
    geradores: saveKeyFor('geradores'),
  }));
  const [game, setGame] = useState<LogGame>('ciclos');
  const [log, setLog] = useState(() => readLog(keys.ciclos));
  const { entries, uptime } = log;
  const listRef = useRef<HTMLDivElement>(null);

  // O save é gravado 1x/s; reler no mesmo ritmo mantém o log vivo.
  useEffect(() => {
    setLog(readLog(keys[game]));
    const id = setInterval(() => setLog(readLog(keys[game])), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

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

  // "Colado no fim": segue os registros novos, a menos que o usuário tenha
  // rolado para cima para ler o histórico.
  const stickRef = useRef(true);

  // Trocar de modo volta a colar no fim
  useEffect(() => {
    stickRef.current = true;
  }, [game]);

  // Entrada nova no log (ou troca de modo) → rola até o fim
  const entryCount = entries.length;
  useEffect(() => {
    if (stickRef.current) scrollToEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryCount, game]);

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
  }, [entryCount, game]);

  // ===== Resumo do header =====
  const last = entries[entries.length - 1];
  const avgInterval =
    entries.length > 1 ? last.unlockedAt / (entries.length - 1) : undefined;
  const sinceLast = last ? Math.max(uptime - last.unlockedAt, 0) : 0;

  const gameName = GAMES.find((g) => g.id === game)?.name ?? game;

  return (
    <div className={styles.wrap}>
      <nav className={styles.tabs}>
        {GAMES.map((g) => (
          <button
            key={g.id}
            className={`${styles.tab} ${game === g.id ? styles.tabActive : ''}`}
            onClick={() => setGame(g.id)}
          >
            {g.name}
          </button>
        ))}
      </nav>

      {entries.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            Nenhum desbloqueio registrado no modo {gameName} ainda.
          </p>
          <button className="btn-primary" onClick={() => onNavigate(game)}>
            Começar a jogar {gameName}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.summary}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{entries.length}</span>
              <span className={styles.summaryLabel}>geradores desbloqueados</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{fmtTime(uptime)}</span>
              <span className={styles.summaryLabel}>tempo de jogo</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>
                {avgInterval !== undefined ? fmtTime(avgInterval) : '—'}
              </span>
              <span className={styles.summaryLabel}>
                média do “tempo desde o anterior”
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{fmtTime(sinceLast)}</span>
              <span className={styles.summaryLabel}>desde o último</span>
            </div>
          </div>

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

            <div className={gstyles.list} ref={listRef} onScroll={onListScroll}>
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
                      <span className={styles.fieldLabel}>
                        tempo desde o anterior
                      </span>
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
        </>
      )}
    </div>
  );
}
