/** Classificação (protótipo 100% mock). Ranking por prosperidade do futuro
    multiplayer, um card por jogador: abas Global / Amigos / Clã, top 100 com
    destaque de pódio, variação diária de posição e o seu card fixado quando
    você está fora da janela. Nada persiste nem fala com rede. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getDateLocale, useI18n, type TKey } from '../../lib/locale';
import { ENABLED_LINES } from '../../game/lines';
import styles from './Leaderboard.module.css';
import {
  FRIENDS,
  CLAN,
  GLOBAL,
  SCOPES,
  SEASON,
  SEASON_ENDS,
  TOTAL_PLAYERS,
  YOU_ENTRY,
  type LbEntry,
  type LbScope,
} from './mockData';

const ROWS: Record<LbScope, LbEntry[]> = {
  global: GLOBAL,
  amigos: FRIENDS,
  cla: CLAN,
};

/** Medalha do pódio (cores das insígnias ouro/prata/bronze). */
const medalOf = (pos: number): string | undefined =>
  pos === 1 ? 'ouro' : pos === 2 ? 'prata' : pos === 3 ? 'bronze' : undefined;

export default function Leaderboard() {
  const { t } = useI18n();
  const loc = getDateLocale();
  const [scope, setScope] = useState<LbScope>('global');

  const listRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ above: false, below: false });

  const rows = ROWS[scope];

  const updateEdges = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setEdges({
      above: el.scrollTop > 4,
      below: el.scrollTop + el.clientHeight < el.scrollHeight - 4,
    });
  }, []);

  // Trocar de aba volta a lista ao topo.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = 0;
    updateEdges();
  }, [scope, updateEdges]);

  useEffect(() => {
    const el = listRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    updateEdges();
    el.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    const ro = new ResizeObserver(updateEdges);
    ro.observe(inner);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', updateEdges);
      ro.disconnect();
    };
  }, [updateEdges]);

  const animate = (getTarget: (el: HTMLDivElement) => number) => {
    const el = listRef.current;
    if (!el) return;
    const from = el.scrollTop;
    const start = performance.now();
    const DURATION_MS = 400;
    const step = (now: number) => {
      const list = listRef.current;
      if (!list) return;
      const p = Math.min((now - start) / DURATION_MS, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      list.scrollTop = from + (getTarget(list) - from) * ease;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const renderCard = (e: LbEntry) => {
    const medal = medalOf(e.pos);
    return (
      <div
        key={`${e.pos}:${e.you ? 'you' : e.name}`}
        className={`${styles.card2} ${e.you ? styles.cardYou : ''}`}
        data-rank={medal}
      >
        <div className={styles.rankBox}>
          <span className={styles.pos}>{e.pos}</span>
          <span
            className={`${styles.delta} ${
              e.delta > 0 ? styles.up : e.delta < 0 ? styles.down : ''
            }`}
          >
            {e.delta === 0 ? '—' : e.delta > 0 ? `▲${e.delta}` : `▼${-e.delta}`}
          </span>
        </div>

        <div className={styles.main}>
          <div className={styles.identity}>
            <span className={styles.name} data-rank={e.rank}>
              {e.you ? t('lb.you') : e.name}
            </span>
          </div>
          <span className={styles.clan}>{e.clan ?? '—'}</span>
        </div>

        <div className={styles.stats}>
          {ENABLED_LINES.map((line) => (
            <div className={styles.stat} key={line.id}>
              <span className={styles.statLabel}>
                {t(`reino.base.${line.id}` as TKey)}
              </span>
              <span className={styles.statValue}>{e.bases[line.id]}</span>
            </div>
          ))}
        </div>

        <div className={styles.scoreBox}>
          <span className={styles.score}>{e.prosperity.toLocaleString(loc)}</span>
          <span className={styles.scoreLabel}>{t('lb.col.prosperity')}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <nav className={styles.tabs}>
          {SCOPES.map((s) => (
            <button
              key={s}
              className={`${styles.tab} ${scope === s ? styles.tabActive : ''}`}
              onClick={() => setScope(s)}
            >
              {t(`lb.scope.${s}` as TKey)}
            </button>
          ))}
        </nav>
        <span className={styles.seasonInfo}>
          {t('lb.season', { n: SEASON })}
          {' · '}
          {t('lb.endsIn', { time: SEASON_ENDS })}
          {' · '}
          {t('lb.players', { n: TOTAL_PLAYERS.toLocaleString(loc) })}
        </span>
      </div>

      <div className={styles.card}>
        <div className={styles.listWrap}>
          {edges.above && (
            <button
              className={`${styles.fade} ${styles.fadeTop}`}
              onClick={() => animate(() => 0)}
              aria-label={t('common.toStart')}
            >
              ↑
            </button>
          )}
          <div className={styles.scroll} ref={listRef}>
            <div className={styles.inner} ref={innerRef}>
              {rows.map(renderCard)}
            </div>
          </div>
          {edges.below && (
            <button
              className={`${styles.fade} ${styles.fadeBottom}`}
              onClick={() => animate((el) => el.scrollHeight - el.clientHeight)}
              aria-label={t('common.toEnd')}
            >
              ↓
            </button>
          )}
        </div>

        {/* Fora do top 100, sua linha fica fixada no rodapé do card */}
        {scope === 'global' && (
          <div className={styles.youBar}>
            <span className={styles.youLabel}>{t('lb.yourPosition')}</span>
            {renderCard(YOU_ENTRY)}
          </div>
        )}
      </div>
    </div>
  );
}
