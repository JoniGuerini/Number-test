/** Aba Som: liga/desliga e volume mestre dos cliques. */

import { useState } from 'react';
import { useI18n } from '../../../lib/locale';
import {
  getSoundVolume,
  isSoundOn,
  playPress,
  setSoundOn,
  setSoundVolume,
} from '../../../lib/sound';
import styles from '../Settings.module.css';

export default function SoundTab() {
  const { t } = useI18n();
  const [volume, setVolume] = useState(getSoundVolume());
  const [soundOn, setSoundOnState] = useState(isSoundOn());

  const toggleSound = () => {
    setSoundOn(!soundOn);
    setSoundOnState(!soundOn);
  };

  const changeVolume = (value: number) => {
    setSoundVolume(value);
    setVolume(value);
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t('sound.title')}</h2>
      <p className={styles.sectionHint}>{t('sound.hint')}</p>
      <div className={styles.sectionBody}>
        <button
          className={styles.option}
          role="switch"
          aria-checked={soundOn}
          onClick={toggleSound}
        >
          <span>{t('sound.enabled')}</span>
          <span
            className={`${styles.switch} ${soundOn ? styles.switchOn : ''}`}
            aria-hidden="true"
          >
            <span className={styles.switchThumb} />
          </span>
        </button>
        <div className={styles.volumeRow}>
          <div className={styles.sliderShell}>
            {/* Canaleta (baixo relevo) e preenchimento (alto relevo) */}
            <div className={styles.trackGroove} aria-hidden="true" />
            <div
              className={styles.trackFill}
              style={{ width: `${Math.round(volume * 100)}%` }}
              aria-hidden="true"
            />
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => changeVolume(Number(e.target.value) / 100)}
              onPointerUp={() => playPress()}
              aria-label={t('sound.volumeAria')}
            />
          </div>
          <span className={styles.volumeValue}>{Math.round(volume * 100)}%</span>
        </div>
      </div>
    </section>
  );
}
