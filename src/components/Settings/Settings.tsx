import { useState } from 'react';
import {
  getSoundThemeId,
  getSoundVolume,
  playPress,
  setSoundTheme,
  setSoundVolume,
  SOUND_THEMES,
  type SoundTheme,
} from '../../lib/sound';
import styles from './Settings.module.css';

export default function Settings() {
  const [themeId, setThemeId] = useState(getSoundThemeId());
  const [volume, setVolume] = useState(getSoundVolume());

  const changeVolume = (value: number) => {
    setSoundVolume(value);
    setVolume(value);
  };

  const choose = (theme: SoundTheme) => {
    setSoundTheme(theme.id);
    setThemeId(theme.id);
    // Prévia do par escolhido
    theme.press();
    setTimeout(() => theme.release(), 130);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h2 className={styles.title}>Configurações</h2>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>som dos botões</span>
          {SOUND_THEMES.map((theme) => (
            // data-nosound: a prévia manual toca o par novo, sem o clique
            // global (que ainda seria o tema antigo) por cima
            <button
              key={theme.id}
              className={`${styles.option} ${theme.id === themeId ? styles.active : ''}`}
              data-nosound
              onClick={() => choose(theme)}
            >
              <span>{theme.name}</span>
              {theme.id === themeId && <span className={styles.badge}>ativo</span>}
            </button>
          ))}
          <p className={styles.hint}>
            Toque para ouvir e ativar. O som vale para todos os botões do app.
          </p>
        </div>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>volume</span>
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
      </div>
    </div>
  );
}
