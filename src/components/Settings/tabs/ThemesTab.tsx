/** Aba Temas: tema ativo em destaque + grade dos demais. */

import { useSyncExternalStore } from 'react';
import { useI18n } from '../../../lib/locale';
import {
  getVideoPrefs,
  setVideoPref,
  subscribeVideoPrefs,
  THEMES,
} from '../../../lib/prefs';
import styles from '../Settings.module.css';

/** Card de tema pintado com as cores dele mesmo, com mini-mockup dentro. */
function ThemeCard({
  theme,
  active = false,
  onSelect,
}: {
  theme: (typeof THEMES)[number];
  active?: boolean;
  onSelect?: () => void;
}) {
  const { t } = useI18n();
  const [bg, paper, accentColor, ink] = theme.preview;
  return (
    <button
      className={`${styles.themeCard} ${active ? styles.themeCardActive : ''}`}
      style={{ background: bg, ['--theme-accent' as string]: accentColor }}
      onClick={onSelect}
      disabled={active}
    >
      {/* Mini-mockup: um card do tema com texto e barra de acento */}
      <span
        className={styles.themeMock}
        style={{ background: paper }}
        aria-hidden="true"
      >
        <span className={styles.themeMockTitle} style={{ background: accentColor }} />
        <span
          className={styles.themeMockLine}
          style={{ background: ink, opacity: 0.55 }}
        />
        <span className={styles.themeMockBar} style={{ background: accentColor }} />
      </span>

      <span className={styles.themeName} style={{ color: ink }}>
        {t(`theme.${theme.id}`)}
      </span>
    </button>
  );
}

export default function ThemesTab() {
  const { t } = useI18n();
  const videoPrefs = useSyncExternalStore(subscribeVideoPrefs, getVideoPrefs);
  const active = THEMES.find((th) => th.id === videoPrefs.theme) ?? THEMES[0];

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t('themes.title')}</h2>
      <p className={styles.sectionHint}>{t('themes.hint')}</p>

      <span className={styles.subLabel}>{t('themes.active')}</span>
      <ThemeCard theme={active} active />

      <span className={styles.subLabel}>{t('themes.available')}</span>
      <div className={styles.themeGrid}>
        {THEMES.filter((th) => th.id !== videoPrefs.theme).map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            onSelect={() => setVideoPref('theme', theme.id)}
          />
        ))}
      </div>
    </section>
  );
}
