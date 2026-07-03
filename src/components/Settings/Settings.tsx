import { useState } from 'react';
import type { GameTab } from '../../App';
import { getSoundVolume, playPress, setSoundVolume } from '../../lib/sound';
import type { SlotMeta } from '../../lib/storage';
import styles from './Settings.module.css';

const GAMES: { id: GameTab; name: string }[] = [
  { id: 'contador', name: 'Contador' },
  { id: 'geradores', name: 'Geradores' },
  { id: 'ciclos', name: 'Ciclos' },
];

const fmtSlotDate = (ms: number): string =>
  new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

interface SettingsProps {
  onReset: (game: GameTab) => void;
  slots: SlotMeta[];
  activeSlotId: string;
  onCreateSlot: () => void;
  onSwitchSlot: (id: string) => void;
  onDeleteSlot: (id: string) => void;
}

export default function Settings({
  onReset,
  slots,
  activeSlotId,
  onCreateSlot,
  onSwitchSlot,
  onDeleteSlot,
}: SettingsProps) {
  const [volume, setVolume] = useState(getSoundVolume());

  const changeVolume = (value: number) => {
    setSoundVolume(value);
    setVolume(value);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        {/* ===== Saves ===== */}
        <section className={`${styles.panel} ${styles.panelWide}`}>
          <h2 className={styles.panelTitle}>Saves</h2>
          <p className={styles.panelHint}>
            Cada save guarda os três modos. Criar um novo começa do zero sem
            perder os anteriores; o ✕ exclui (só saves inativos).
          </p>

          <div className={styles.panelBody}>
            {slots.map((slot) => {
              const active = slot.id === activeSlotId;
              return (
                <div key={slot.id} className={styles.slotRow}>
                  <button
                    className={`${styles.option} ${active ? styles.active : ''}`}
                    onClick={() => onSwitchSlot(slot.id)}
                  >
                    <span>
                      {slot.name}
                      <span className={styles.slotDate}>
                        {' · '}
                        {fmtSlotDate(slot.lastPlayedAt)}
                      </span>
                    </span>
                    <span className={styles.badge}>{active ? 'ativo' : 'usar'}</span>
                  </button>
                  <button
                    className={`${styles.slotDelete} ${active ? '' : styles.slotDeleteOn}`}
                    disabled={active}
                    onClick={() => onDeleteSlot(slot.id)}
                    aria-label={`Excluir ${slot.name}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            <button className={styles.option} onClick={onCreateSlot}>
              <span>Criar novo save</span>
              <span className={styles.badge}>+</span>
            </button>
          </div>
        </section>

        {/* ===== Som ===== */}
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Som</h2>
          <p className={styles.panelHint}>
            Volume do click dos botões. Solte o controle para ouvir uma prévia.
          </p>

          <div className={styles.panelBody}>
            <div className={styles.volumeRow}>
              <input
                type="range"
                className={styles.slider}
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(e) => changeVolume(Number(e.target.value) / 100)}
                onPointerUp={() => playPress()}
                aria-label="Volume do som dos botões"
              />
              <span className={styles.volumeValue}>{Math.round(volume * 100)}%</span>
            </div>
          </div>
        </section>

        {/* ===== Zerar progresso ===== */}
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Zerar progresso</h2>
          <p className={styles.panelHint}>
            Apaga o save e recomeça do zero apenas o modo escolhido, no save
            ativo.
          </p>

          <div className={styles.panelBody}>
            {GAMES.map((game) => (
              <button
                key={game.id}
                className={`${styles.option} ${styles.dangerOption}`}
                onClick={() => onReset(game.id)}
              >
                <span>{game.name}</span>
                <span className={styles.badge}>zerar</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
