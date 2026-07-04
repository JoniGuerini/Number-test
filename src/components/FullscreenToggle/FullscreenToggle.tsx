import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/locale';
import styles from './FullscreenToggle.module.css';

/** Botão fixo no topo que entra/sai de tela cheia (Fullscreen API).
    Não renderiza em navegadores sem suporte (ex.: iOS Safari). */
export default function FullscreenToggle() {
  const { t } = useI18n();
  const [isFull, setIsFull] = useState(false);
  const [supported] = useState(
    () =>
      typeof document !== 'undefined' &&
      typeof document.documentElement.requestFullscreen === 'function'
  );

  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };

  const label = isFull ? t('fullscreen.exit') : t('fullscreen.enter');

  return (
    <button
      className={styles.btn}
      onClick={toggle}
      aria-label={label}
      aria-pressed={isFull}
      title={label}
    >
      <svg
        className={styles.icon}
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {isFull ? (
          // Cantos apontando para dentro (sair)
          <path d="M9 5v4H5 M15 5v4h4 M9 19v-4H5 M15 19v-4h4" />
        ) : (
          // Cantos apontando para fora (entrar)
          <path d="M5 9V5h4 M19 9V5h-4 M5 15v4h4 M19 15v4h-4" />
        )}
      </svg>
    </button>
  );
}
