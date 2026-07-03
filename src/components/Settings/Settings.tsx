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
import { nextSlotName, type SlotMeta } from '../../lib/storage';
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

type ConfigTab = 'saves' | 'temas' | 'som' | 'video';

const TABS: { id: ConfigTab; name: string }[] = [
  { id: 'saves', name: 'Saves' },
  { id: 'temas', name: 'Temas' },
  { id: 'som', name: 'Som' },
  { id: 'video', name: 'Vídeo' },
];

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
        {theme.name}
      </span>
    </button>
  );
}

const fmtSlotDate = (ms: number): string =>
  new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

interface SettingsProps {
  onReset: (slotId: string, game: GameTab) => void;
  slots: SlotMeta[];
  activeSlotId: string;
  onCreateSlot: (name?: string) => void;
  onSwitchSlot: (id: string) => void;
  onDeleteSlot: (id: string) => void;
  onRenameSlot: (id: string, name: string) => void;
}

export default function Settings({
  onReset,
  slots,
  activeSlotId,
  onCreateSlot,
  onSwitchSlot,
  onDeleteSlot,
  onRenameSlot,
}: SettingsProps) {
  const [tab, setTab] = useState<ConfigTab>('saves');
  // Slot com as opções (carregar / renomear / zerar) abertas abaixo dele
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);
  // Rascunho do nome no painel expandido (renomear)
  const [renameDraft, setRenameDraft] = useState('');
  // Criação de save: input com nome pré-preenchido antes de confirmar
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [volume, setVolume] = useState(getSoundVolume());

  const confirmCreate = () => {
    onCreateSlot(createName);
    setCreating(false);
  };
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
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Saves</h2>
            <p className={styles.sectionHint}>
              Cada save guarda os três modos. Clique num save para abrir as
              opções: carregar ou zerar o progresso de um modo. O ✕ exclui (só
              saves inativos).
            </p>
            <div className={styles.sectionBody}>
              {slots.map((slot) => {
                const active = slot.id === activeSlotId;
                const expanded = slot.id === expandedSlotId;
                return (
                  <div key={slot.id} className={styles.slotBlock}>
                    <div className={styles.slotRow}>
                      <button
                        className={`${styles.option} ${active ? styles.active : ''}`}
                        onClick={() => {
                          if (expanded) {
                            setExpandedSlotId(null);
                          } else {
                            setExpandedSlotId(slot.id);
                            setRenameDraft(slot.name);
                          }
                        }}
                      >
                        <span>
                          {slot.name}
                          <span className={styles.slotDate}>
                            {' · '}
                            {fmtSlotDate(slot.lastPlayedAt)}
                          </span>
                        </span>
                        <span className={styles.badge}>
                          {active && 'ativo '}
                          {expanded ? '▴' : '▾'}
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

                    {expanded && (
                      <div className={styles.slotOptions}>
                        <div className={styles.nameRow}>
                          <input
                            className={styles.nameInput}
                            value={renameDraft}
                            maxLength={40}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter')
                                onRenameSlot(slot.id, renameDraft);
                            }}
                            aria-label={`Nome do ${slot.name}`}
                          />
                          <button
                            className="btn-secondary"
                            disabled={
                              !renameDraft.trim() ||
                              renameDraft.trim() === slot.name
                            }
                            onClick={() => onRenameSlot(slot.id, renameDraft)}
                          >
                            Renomear
                          </button>
                        </div>
                        {!active && (
                          <button
                            className="btn-primary"
                            onClick={() => {
                              onSwitchSlot(slot.id);
                              setExpandedSlotId(null);
                            }}
                          >
                            Carregar save
                          </button>
                        )}
                        {GAMES.map((game) => (
                          <button
                            key={game.id}
                            className={styles.dangerBtn}
                            onClick={() => onReset(slot.id, game.id)}
                          >
                            Zerar {game.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {creating ? (
                <div className={styles.nameRow}>
                  <input
                    className={styles.nameInput}
                    value={createName}
                    maxLength={40}
                    autoFocus
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmCreate();
                      if (e.key === 'Escape') setCreating(false);
                    }}
                    aria-label="Nome do novo save"
                  />
                  <button className="btn-primary" onClick={confirmCreate}>
                    Criar
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setCreating(false)}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setCreateName(nextSlotName());
                    setCreating(true);
                  }}
                >
                  Criar novo save +
                </button>
              )}
            </div>
          </section>
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

        {tab === 'temas' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Temas</h2>
            <p className={styles.sectionHint}>
              Cada card usa as cores do próprio tema. A escolha vale para o app
              inteiro e fica salva neste dispositivo.
            </p>

            <span className={styles.subLabel}>tema ativo</span>
            {(() => {
              const active =
                THEMES.find((t) => t.id === videoPrefs.theme) ?? THEMES[0];
              return <ThemeCard theme={active} active />;
            })()}

            <span className={styles.subLabel}>disponíveis</span>
            <div className={styles.themeGrid}>
              {THEMES.filter((t) => t.id !== videoPrefs.theme).map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  onSelect={() => setVideoPref('theme', theme.id)}
                />
              ))}
            </div>
          </section>
        )}

        {tab === 'video' && (
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
        )}
      </div>
    </div>
  );
}
