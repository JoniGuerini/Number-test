import { useEffect, useState } from 'react';
import Reino from './components/Reino/Reino';
import Activity from './components/Activity/Activity';
import Chat from './components/Chat/Chat';
import Leaderboard from './components/Leaderboard/Leaderboard';
import Login from './components/Login/Login';
import PatchNotes from './components/PatchNotes/PatchNotes';
import Settings from './components/Settings/Settings';
import FpsMeter from './components/FpsMeter/FpsMeter';
import FullscreenToggle from './components/FullscreenToggle/FullscreenToggle';
import { useAuth } from './lib/auth';
import { useWakeLock } from './hooks/useWakeLock';
import { useI18n } from './lib/locale';
import { playPress, playRelease } from './lib/sound';
import {
  clearSave,
  createSlot,
  deleteSlot,
  getActiveSlotId,
  listSlots,
  renameSlot,
  saveKeyForSlot,
  switchSlot,
} from './lib/storage';
import styles from './App.module.css';

export type GameTab = 'reino';
type Page = GameTab | 'atividade' | 'chat' | 'classificacao' | 'notas';

/* A última página visitada sobrevive ao refresh */
const PAGE_KEY = 'number-test:page';
const PAGES: Page[] = ['reino', 'atividade', 'chat', 'classificacao', 'notas'];

function readStoredPage(): Page {
  try {
    const stored = localStorage.getItem(PAGE_KEY);
    if (stored && (PAGES as string[]).includes(stored)) return stored as Page;
  } catch {
    // Sem localStorage — cai no padrão
  }
  return 'reino';
}

export default function App() {
  useWakeLock();
  const { t } = useI18n();
  // Gate de autenticação (mock): sem usuário, mostra o login antes do jogo.
  const user = useAuth();

  // Feedback sonoro global: um som ao pressionar qualquer botão habilitado e
  // outro (variação mais leve) ao soltar — sensação de tecla física.
  useEffect(() => {
    let pressed = false;

    const onPointerDown = (e: PointerEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest?.('button');
      if (btn && !btn.disabled && !btn.hasAttribute('data-nosound')) {
        pressed = true;
        playPress();
      }
    };
    // O soltar toca mesmo se o dedo/cursor saiu do botão (como tecla real)
    const onPointerUp = () => {
      if (pressed) {
        pressed = false;
        playRelease();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const [page, setPage] = useState<Page>(readStoredPage);
  useEffect(() => {
    try {
      localStorage.setItem(PAGE_KEY, page);
    } catch {
      // Sem localStorage — vale só pra sessão
    }
  }, [page]);

  // Config vive num modal sobre a interface (não é mais uma página exclusiva)
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Ao deslogar (inclusive pelo "Sair da conta" dentro do Config): fecha o
  // modal e volta a página para o Reino, para que o próximo login caia direto
  // na tela do Reino em vez de restaurar a última aba visitada.
  useEffect(() => {
    if (!user) {
      setSettingsOpen(false);
      setPage('reino');
    }
  }, [user]);
  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);
  // Trocar a key remonta o componente da aba, zerando só aquele jogo.
  const [resetKeys, setResetKeys] = useState({
    reino: 0,
  });

  // ===== Slots de save =====
  const [slots, setSlots] = useState(listSlots);
  const [activeSlotId, setActiveSlotId] = useState(getActiveSlotId);

  // Zera um modo de um slot específico; se for o ativo, remonta o jogo.
  const resetGame = (slotId: string, game: GameTab) => {
    clearSave(saveKeyForSlot(slotId, game));
    if (slotId === activeSlotId) {
      setResetKeys((keys) => ({ ...keys, [game]: keys[game] + 1 }));
    }
  };
  // Muda a cada troca de slot: remonta os jogos, que carregam do slot novo
  const [slotEpoch, setSlotEpoch] = useState(0);

  const refreshSlots = () => {
    setSlots(listSlots());
    setActiveSlotId(getActiveSlotId());
  };

  // Cria sem trocar: o jogador carrega o save novo quando quiser
  const handleCreateSlot = (name?: string) => {
    createSlot(name);
    refreshSlots();
  };

  const handleRenameSlot = (id: string, name: string) => {
    renameSlot(id, name);
    refreshSlots();
  };

  const handleSwitchSlot = (id: string) => {
    if (id === activeSlotId) return;
    switchSlot(id);
    refreshSlots();
    setSlotEpoch((e) => e + 1);
  };

  const handleDeleteSlot = (id: string) => {
    if (id === activeSlotId) return;
    deleteSlot(id);
    refreshSlots();
  };

  // Sem usuário autenticado, o app é substituído pela tela de login (mock).
  // Fica após todos os hooks para não quebrar a ordem de hooks do React.
  if (!user) return <Login />;

  return (
    <div className={styles.frame}>
      <FullscreenToggle />
      <FpsMeter />

      {/* As telas ficam sempre montadas para o progresso não resetar ao trocar de aba. */}
      <main
        className={`${styles.contentFull} ${page !== 'reino' ? styles.hidden : ''}`}
      >
        <Reino key={`${slotEpoch}:${resetKeys.reino}`} />
      </main>
      <main
        className={`${styles.contentFull} ${page !== 'atividade' ? styles.hidden : ''}`}
      >
        {/* Remonta ao zerar o Reino (ou trocar de slot) para o log acompanhar */}
        <Activity
          key={`${slotEpoch}:${resetKeys.reino}`}
          onNavigate={setPage}
        />
      </main>
      <main
        className={`${styles.contentFull} ${page !== 'chat' ? styles.hidden : ''}`}
      >
        <Chat />
      </main>
      <main
        className={`${styles.contentFull} ${page !== 'classificacao' ? styles.hidden : ''}`}
      >
        <Leaderboard />
      </main>
      <main
        className={`${styles.contentFull} ${page !== 'notas' ? styles.hidden : ''}`}
      >
        <PatchNotes />
      </main>

      <footer className={styles.footer}>
        <nav className={styles.tabs}>
          {PAGES.map((p) => (
            <button
              key={p}
              className={`${styles.tab} ${page === p && !settingsOpen ? styles.active : ''}`}
              onClick={() => {
                setSettingsOpen(false);
                setPage(p);
              }}
            >
              {t(`nav.${p}`)}
            </button>
          ))}
          <button
            className={`${styles.tab} ${settingsOpen ? styles.active : ''}`}
            onClick={() => setSettingsOpen((o) => !o)}
          >
            {t('nav.config')}
          </button>
        </nav>
      </footer>

      {settingsOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <Settings
              onReset={resetGame}
              slots={slots}
              activeSlotId={activeSlotId}
              onCreateSlot={handleCreateSlot}
              onSwitchSlot={handleSwitchSlot}
              onDeleteSlot={handleDeleteSlot}
              onRenameSlot={handleRenameSlot}
            />
          </div>
        </div>
      )}
    </div>
  );
}
