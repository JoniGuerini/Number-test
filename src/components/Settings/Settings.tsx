import { useState } from 'react';
import type { GameTab } from '../../App';
import { getSoundVolume, playPress, setSoundVolume } from '../../lib/sound';
import styles from './Settings.module.css';

const GAMES: { id: GameTab; name: string }[] = [
  { id: 'contador', name: 'Contador' },
  { id: 'geradores', name: 'Geradores' },
  { id: 'ciclos', name: 'Ciclos' },
];

interface SettingsProps {
  onReset: (game: GameTab) => void;
}

export default function Settings({ onReset }: SettingsProps) {
  const [volume, setVolume] = useState(getSoundVolume());

  const changeVolume = (value: number) => {
    setSoundVolume(value);
    setVolume(value);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h2 className={styles.title}>Configurações</h2>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>volume dos botões</span>
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

        <div className={styles.section}>
          <span className={styles.sectionLabel}>zerar progresso</span>
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
          <p className={styles.hint}>
            Apaga o save e recomeça do zero apenas o modo escolhido.
          </p>
        </div>
      </div>
    </div>
  );
}
