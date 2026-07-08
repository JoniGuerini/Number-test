/** Aba Idioma: seleção de língua com bandeiras em SVG (emoji de bandeira
    varia por SO — no Windows viram letras). */

import { BR, ES, US } from 'country-flag-icons/react/3x2';
import { LOCALES, setLocale, useI18n } from '../../../lib/locale';
import styles from '../Settings.module.css';

/* Bandeira de cada idioma (país de referência do dialeto usado). */
const LOCALE_FLAGS: Record<string, typeof BR> = {
  pt: BR,
  en: US,
  es: ES,
};

export default function LanguageTab() {
  const { t, locale } = useI18n();

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t('lang.title')}</h2>
      <p className={styles.sectionHint}>{t('lang.hint')}</p>
      <div className={styles.sectionBody}>
        {LOCALES.map((l) => {
          const active = l.id === locale;
          const Flag = LOCALE_FLAGS[l.id];
          return (
            <button
              key={l.id}
              className={`${styles.option} ${active ? styles.active : ''}`}
              onClick={() => setLocale(l.id)}
            >
              <span className={styles.langName}>
                <Flag className={styles.flag} aria-hidden="true" />
                {l.name}
              </span>
              {active && <span className={styles.badge}>{t('saves.active')}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
