/** Aba Vídeo: telemetria (FPS, memória…) e opções de gameplay visual. */

import { useSyncExternalStore } from 'react';
import { useI18n, type TKey } from '../../../lib/locale';
import {
  getVideoPrefs,
  setVideoPref,
  subscribeVideoPrefs,
  type VideoPrefs,
} from '../../../lib/prefs';
import styles from '../Settings.module.css';

const VIDEO_TOGGLES: {
  key: Exclude<keyof VideoPrefs, 'theme'>;
  label: TKey;
}[] = [
  { key: 'showFps', label: 'video.fps' },
  { key: 'showFrameTime', label: 'video.frameTime' },
  { key: 'showBattery', label: 'video.battery' },
  { key: 'showMemory', label: 'video.memory' },
  { key: 'showDomNodes', label: 'video.domNodes' },
];

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={`${styles.switch} ${on ? styles.switchOn : ''}`}
      aria-hidden="true"
    >
      <span className={styles.switchThumb} />
    </span>
  );
}

export default function VideoTab() {
  const { t } = useI18n();
  const videoPrefs = useSyncExternalStore(subscribeVideoPrefs, getVideoPrefs);
  const allOn = VIDEO_TOGGLES.every((tg) => videoPrefs[tg.key]);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t('video.title')}</h2>
      <p className={styles.sectionHint}>{t('video.hint')}</p>
      <div className={styles.sectionBody}>
        {/* Master switch: on when every card is on; toggles all at once */}
        <button
          className={styles.option}
          role="switch"
          aria-checked={allOn}
          onClick={() =>
            VIDEO_TOGGLES.forEach((tg) => setVideoPref(tg.key, !allOn))
          }
        >
          <span>{t('video.all')}</span>
          <Switch on={allOn} />
        </button>
        <span className={styles.subLabel}>{t('video.individual')}</span>
        {VIDEO_TOGGLES.map((toggle) => {
          const on = videoPrefs[toggle.key];
          return (
            <button
              key={toggle.key}
              className={styles.option}
              role="switch"
              aria-checked={on}
              onClick={() => setVideoPref(toggle.key, !on)}
            >
              <span>{t(toggle.label)}</span>
              <Switch on={on} />
            </button>
          );
        })}

        <span className={styles.subLabel}>{t('video.gameplay')}</span>
        <button
          className={styles.option}
          role="switch"
          aria-checked={videoPrefs.showCycleBars}
          onClick={() => setVideoPref('showCycleBars', !videoPrefs.showCycleBars)}
        >
          <span>{t('video.cycleBars')}</span>
          <Switch on={videoPrefs.showCycleBars} />
        </button>
      </div>
    </section>
  );
}
