/** Aba Jogos salvos: slots (carregar/renomear/excluir), raio-X do save e o
    reset com confirmação em duas etapas. */

import { useState } from 'react';
import Decimal from 'break_eternity.js';
import type { GameTab } from '../../../App';
import { fmt, fmtTime } from '../../../lib/format';
import { ENABLED_LINES } from '../../../game/lines';
import { getDateLocale, useI18n, type TKey } from '../../../lib/locale';
import {
  loadSave,
  nextSlotName,
  saveKeyForSlot,
  type SlotMeta,
} from '../../../lib/storage';
import styles from '../Settings.module.css';

const GAMES: GameTab[] = ['reino'];

/** Campos que sinalizam progresso iniciado no save. */
interface SaveProbe {
  /** Reino: uma linha por chave; conta se qualquer linha foi iniciada. */
  lines?: Record<
    string,
    | {
        started?: boolean;
        startedAt?: number;
        uptime?: number;
        totalProduced?: string;
      }
    | undefined
  >;
}

/** Há progresso para zerar? (jogo de fato iniciado, não só o save gravado
    automaticamente). No Reino, conta por qualquer linha iniciada. */
function hasProgress(slotId: string, game: GameTab): boolean {
  const s = loadSave<SaveProbe>(saveKeyForSlot(slotId, game));
  if (!s) return false;
  return Object.values(s.lines ?? {}).some((l) => l?.started === true);
}

const fmtSlotDate = (ms: number, dateLocale: string): string =>
  new Date(ms).toLocaleString(dateLocale, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export interface SavesTabProps {
  onReset: (slotId: string, game: GameTab) => void;
  slots: SlotMeta[];
  activeSlotId: string;
  onCreateSlot: (name?: string) => void;
  onSwitchSlot: (id: string) => void;
  onDeleteSlot: (id: string) => void;
  onRenameSlot: (id: string, name: string) => void;
}

export default function SavesTab({
  onReset,
  slots,
  activeSlotId,
  onCreateSlot,
  onSwitchSlot,
  onDeleteSlot,
  onRenameSlot,
}: SavesTabProps) {
  const { t } = useI18n();
  // Slot com as opções (carregar / renomear / zerar) abertas abaixo dele
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);
  // Confirmação em duas etapas do resetar jogo salvo (o botão grande vira
  // o par Resetar/Cancelar); zera ao expandir/recolher outro slot
  const [confirmResetGame, setConfirmResetGame] = useState<GameTab | null>(null);
  // Rascunho do nome no painel expandido (renomear)
  const [renameDraft, setRenameDraft] = useState('');
  // Criação de save: input com nome pré-preenchido antes de confirmar
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');

  const confirmCreate = () => {
    onCreateSlot(createName);
    setCreating(false);
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t('saves.title')}</h2>
      <p className={styles.sectionHint}>{t('saves.hint')}</p>
      <div className={styles.sectionBody}>
        {slots.map((slot) => {
          const active = slot.id === activeSlotId;
          const expanded = slot.id === expandedSlotId;
          // Nenhum modo iniciado: save vazio (sem data pra mostrar)
          const empty = !GAMES.some((g) => hasProgress(slot.id, g));
          return (
            <div key={slot.id} className={styles.slotBlock}>
              <div className={styles.slotRow}>
                <button
                  className={`${styles.option} ${active ? styles.active : ''}`}
                  onClick={() => {
                    setConfirmResetGame(null);
                    if (expanded) {
                      setExpandedSlotId(null);
                    } else {
                      setExpandedSlotId(slot.id);
                      setRenameDraft(slot.name);
                    }
                  }}
                >
                  <span>
                    {slot.name}
                    <span className={styles.slotDate}>
                      {' · '}
                      {empty
                        ? t('saves.noData')
                        : fmtSlotDate(slot.lastPlayedAt, getDateLocale())}
                    </span>
                  </span>
                  <span className={styles.badge}>
                    {active && t('saves.active')}
                    <svg
                      className={`${styles.caret} ${expanded ? styles.caretUp : ''}`}
                      width="9"
                      height="6"
                      viewBox="0 0 9 6"
                      aria-hidden="true"
                    >
                      <path
                        d="M1 1.5 L4.5 4.5 L8 1.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
                {/* The active save can't be deleted, so its button
                    doesn't render — the card takes the full row */}
                {!active && (
                  <button
                    className={`${styles.slotDelete} ${styles.slotDeleteOn}`}
                    onClick={() => onDeleteSlot(slot.id)}
                    aria-label={t('saves.deleteAria', { name: slot.name })}
                  >
                    {/* SVG instead of the ✕ character: the glyph size
                        varied between macOS and Windows (fallback font) */}
                    <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true">
                      <path
                        d="M1 1 L9 9 M9 1 L1 9"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {expanded && (
                <div className={styles.slotOptions}>
                  <div className={styles.nameRow}>
                    <input
                      className={styles.nameInput}
                      value={renameDraft}
                      maxLength={40}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onRenameSlot(slot.id, renameDraft);
                      }}
                      aria-label={t('saves.nameAria', { name: slot.name })}
                    />
                    <button
                      className="btn-secondary"
                      disabled={
                        !renameDraft.trim() || renameDraft.trim() === slot.name
                      }
                      onClick={() => onRenameSlot(slot.id, renameDraft)}
                    >
                      {t('saves.rename')}
                    </button>
                  </div>
                  {(() => {
                    // Raio-X do save: início, tempo decorrido e o total
                    // produzido por linha. Snapshot do localStorage — o save
                    // do slot ativo persiste a cada 1s.
                    const probe = loadSave<SaveProbe>(
                      saveKeyForSlot(slot.id, 'reino')
                    );
                    const anchor = probe?.lines?.comida;
                    if (!anchor?.started || anchor.startedAt === undefined)
                      return null;
                    return (
                      <div className={styles.saveStats}>
                        <div className={styles.statGrid}>
                          <div className={styles.statCard}>
                            <span className={styles.statCardLabel}>
                              {t('common.startLabel')}
                            </span>
                            <span className={styles.statCardValue}>
                              {fmtSlotDate(anchor.startedAt, getDateLocale())}
                            </span>
                          </div>
                          <div className={styles.statCard}>
                            <span className={styles.statCardLabel}>
                              {t('common.time')}
                            </span>
                            <span className={styles.statCardValue}>
                              {fmtTime(anchor.uptime ?? 0)}
                            </span>
                          </div>
                        </div>
                        <span className={styles.subLabel}>
                          {t('common.produced')}
                        </span>
                        <div className={styles.lineStatsGrid}>
                          {ENABLED_LINES.map((d) => (
                            <div className={styles.statCard} key={d.id}>
                              <span className={styles.statCardLabel}>
                                {t(`reino.line.${d.id}` as TKey)}
                              </span>
                              <span className={styles.statCardValue}>
                                {fmt(
                                  new Decimal(
                                    probe?.lines?.[d.id]?.totalProduced ?? 0
                                  )
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  {!active && (
                    <button
                      className={`btn-primary ${styles.loadBtn}`}
                      onClick={() => {
                        onSwitchSlot(slot.id);
                        setExpandedSlotId(null);
                      }}
                    >
                      {t('saves.load')}
                    </button>
                  )}
                  <div className={styles.resetRow}>
                    {GAMES.map((game) =>
                      confirmResetGame === game ? (
                        <div key={game} className={styles.resetPair}>
                          <button
                            className={styles.dangerBtn}
                            onClick={() => {
                              onReset(slot.id, game);
                              setConfirmResetGame(null);
                            }}
                          >
                            {t('saves.resetConfirm')}
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => setConfirmResetGame(null)}
                          >
                            {t('saves.cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          key={game}
                          className={styles.dangerBtn}
                          disabled={!hasProgress(slot.id, game)}
                          onClick={() => setConfirmResetGame(game)}
                        >
                          {t('saves.reset')}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {creating ? (
          <div className={styles.nameRow}>
            <input
              className={styles.nameInput}
              value={createName}
              maxLength={40}
              autoFocus
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmCreate();
                if (e.key === 'Escape') setCreating(false);
              }}
              aria-label={t('saves.newNameAria')}
            />
            <button className="btn-primary" onClick={confirmCreate}>
              {t('saves.confirmCreate')}
            </button>
            <button className="btn-secondary" onClick={() => setCreating(false)}>
              {t('saves.cancel')}
            </button>
          </div>
        ) : (
          <button
            className="btn-primary"
            onClick={() => {
              setCreateName(nextSlotName());
              setCreating(true);
            }}
          >
            {t('saves.create')}
          </button>
        )}
      </div>
    </section>
  );
}
