/** Config (modal): shell com a sidebar de abas + rodapé de restaurar padrão.
    O conteúdo de cada aba vive em ./tabs/ — um componente por aba. */

import { useState } from 'react';
import {
  Languages,
  Monitor,
  Palette,
  Save,
  UserRound,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import type { GameTab } from '../../App';
import { useI18n } from '../../lib/locale';
import { resetLocale } from '../../lib/locale';
import { resetVideoPrefs } from '../../lib/prefs';
import { resetSound } from '../../lib/sound';
import type { SlotMeta } from '../../lib/storage';
import ProfileTab from './tabs/ProfileTab';
import SavesTab from './tabs/SavesTab';
import ThemesTab from './tabs/ThemesTab';
import SoundTab from './tabs/SoundTab';
import VideoTab from './tabs/VideoTab';
import LanguageTab from './tabs/LanguageTab';
import styles from './Settings.module.css';

type ConfigTab = 'perfil' | 'saves' | 'temas' | 'som' | 'video' | 'idioma';

const TABS: ConfigTab[] = ['perfil', 'saves', 'temas', 'som', 'video', 'idioma'];

/* Ícones das abas (Lucide) — neutros, herdam a cor do rótulo. */
const TAB_ICONS: Record<ConfigTab, LucideIcon> = {
  perfil: UserRound,
  saves: Save,
  temas: Palette,
  som: Volume2,
  video: Monitor,
  idioma: Languages,
};

interface SettingsProps {
  onReset: (slotId: string, game: GameTab) => void;
  slots: SlotMeta[];
  activeSlotId: string;
  onCreateSlot: (name?: string) => void;
  onSwitchSlot: (id: string) => void;
  onDeleteSlot: (id: string) => void;
  onRenameSlot: (id: string, name: string) => void;
}

export default function Settings(props: SettingsProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<ConfigTab>('perfil');
  // Confirmação em duas etapas do botão de restaurar configs
  const [confirmReset, setConfirmReset] = useState(false);
  // Remonta a aba de Som após o reset (o estado local dela relê o padrão)
  const [resetEpoch, setResetEpoch] = useState(0);

  // Restaura temas, som, vídeo e idioma ao padrão (não toca nos jogos salvos).
  const resetAllConfig = () => {
    resetVideoPrefs();
    resetSound();
    resetLocale();
    setResetEpoch((e) => e + 1);
    setConfirmReset(false);
  };

  return (
    <div className={styles.panel}>
      <nav className={styles.tabs}>
        {TABS.map((id) => {
          const Icon = TAB_ICONS[id];
          return (
            <button
              key={id}
              className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon className={styles.tabIcon} aria-hidden="true" />
              <span>{t(`tab.${id}`)}</span>
            </button>
          );
        })}
      </nav>

      <div className={styles.main}>
        <div className={styles.body}>
          {tab === 'perfil' && <ProfileTab />}
          {tab === 'saves' && <SavesTab {...props} />}
          {tab === 'temas' && <ThemesTab />}
          {tab === 'som' && <SoundTab key={resetEpoch} />}
          {tab === 'video' && <VideoTab />}
          {tab === 'idioma' && <LanguageTab />}
        </div>

        <div className={styles.footer}>
          {confirmReset ? (
            <div className={styles.resetConfirm}>
              <span className={styles.resetWarn}>{t('config.resetWarn')}</span>
              <div className={styles.resetActions}>
                <button className="btn-primary" onClick={resetAllConfig}>
                  {t('config.resetConfirm')}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setConfirmReset(false)}
                >
                  {t('saves.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button className="btn-secondary" onClick={() => setConfirmReset(true)}>
              {t('config.reset')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
