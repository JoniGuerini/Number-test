import { useState, useSyncExternalStore } from 'react';
import type { GameTab } from '../../App';
import {
  getVideoPrefs,
  setVideoPref,
  subscribeVideoPrefs,
  THEMES,
  type VideoPrefs,
} from '../../lib/prefs';
import { getSoundVolume, playPress, setSoundVolume } from '../../lib/sound';
import type { SlotMeta } from '../../lib/storage';
import styles from './Settings.module.css';

const GAMES: { id: GameTab; name: string }[] = [
  { id: 'contador', name: 'Contador' },
  { id: 'geradores', name: 'Geradores' },
  { id: 'ciclos', name: 'Ciclos' },
];

const VIDEO_TOGGLES: {
  key: Exclude<keyof VideoPrefs, 'theme'>;
  name: string;
}[] = [
  { key: 'showFps', name: 'Card de FPS' },
  { key: 'showFrameTime', name: 'Card de frame time (ms / máx)' },
  { key: 'showBattery', name: 'Card de bateria' },
];

type ConfigTab = 'saves' | 'som' | 'video';

const TABS: { id: ConfigTab; name: string }[] = [
  { id: 'saves', name: 'Saves' },
  { id: 'som', name: 'Som' },
  { id: 'video', name: 'Vídeo' },
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
  const [tab, setTab] = useState<ConfigTab>('saves');
  const [volume, setVolume] = useState(getSoundVolume());
  const videoPrefs = useSyncExternalStore(subscribeVideoPrefs, getVideoPrefs);

  const changeVolume = (value: number) => {
    setSoundVolume(value);
    setVolume(value);
  };

  return (
    <div className={styles.panel}>
      <nav className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.name}
          </button>
        ))}
      </nav>

      <div className={styles.body}>
        {tab === 'saves' && (
          <>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Saves</h2>
              <p className={styles.sectionHint}>
                Cada save guarda os três modos. Criar um novo começa do zero sem
                perder os anteriores; o ✕ exclui (só saves inativos).
              </p>
              <div className={styles.sectionBody}>
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
                        <span className={styles.badge}>
                          {active ? 'ativo' : 'usar'}
                        </span>
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

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Zerar progresso</h2>
              <p className={styles.sectionHint}>
                Apaga e recomeça do zero apenas o modo escolhido, no save ativo.
              </p>
              <div className={styles.sectionBody}>
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
          </>
        )}

        {tab === 'som' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Som</h2>
            <p className={styles.sectionHint}>
              Volume do click dos botões. Solte o controle para ouvir uma prévia.
            </p>
            <div className={styles.sectionBody}>
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
                    aria-label="Volume do som dos botões"
                  />
                </div>
                <span className={styles.volumeValue}>
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>
          </section>
        )}

        {tab === 'video' && (
          <>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Paleta de cores</h2>
              <p className={styles.sectionHint}>
                O tema vale para o app inteiro e fica salvo neste dispositivo.
              </p>
              <div className={styles.sectionBody}>
                {THEMES.map((theme) => {
                  const active = videoPrefs.theme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      className={`${styles.option} ${active ? styles.active : ''}`}
                      onClick={() => setVideoPref('theme', theme.id)}
                    >
                      <span>{theme.name}</span>
                      <span className={styles.badge}>
                        {active ? 'ativo' : 'usar'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Telemetria</h2>
              <p className={styles.sectionHint}>
                Escolha quais cardzinhos aparecem no topo da tela.
              </p>
              <div className={styles.sectionBody}>
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
                      <span>{toggle.name}</span>
                      <span
                        className={`${styles.switch} ${on ? styles.switchOn : ''}`}
                        aria-hidden="true"
                      >
                        <span className={styles.switchThumb} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
