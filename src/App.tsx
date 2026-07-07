import { useEffect, useRef, useState } from 'react';
import {
  Castle,
  FlaskConical,
  History,
  MessagesSquare,
  Settings as SettingsIcon,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import Reino from './components/Reino/Reino';
import Activity from './components/Activity/Activity';
import Chat from './components/Chat/Chat';
import Leaderboard from './components/Leaderboard/Leaderboard';
import Upgrades from './components/Upgrades/Upgrades';
import Login from './components/Login/Login';
import PatchNotes from './components/PatchNotes/PatchNotes';
import Settings from './components/Settings/Settings';
import FpsMeter, { VersionBadge } from './components/FpsMeter/FpsMeter';
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
type Page = GameTab | 'melhorias' | 'atividade' | 'chat' | 'classificacao' | 'notas';

/* A última página visitada sobrevive ao refresh */
const PAGE_KEY = 'number-test:page';
/* Abas do rodapé — Notas fica fora: abre pelo cardzinho da versão no topo */
const PAGES: Exclude<Page, 'notas'>[] = ['reino', 'melhorias', 'atividade', 'chat', 'classificacao'];
const VALID_PAGES: Page[] = [...PAGES, 'notas'];

/* Ícones do menu (Lucide): só no chrome da UI — geradores e abas de linha de
   produção seguem só com texto, por decisão de design. */
const PAGE_ICONS: Record<Exclude<Page, 'notas'>, LucideIcon> = {
  reino: Castle,
  melhorias: FlaskConical,
  atividade: History,
  chat: MessagesSquare,
  classificacao: Trophy,
};

function readStoredPage(): Page {
  try {
    const stored = localStorage.getItem(PAGE_KEY);
    if (stored && (VALID_PAGES as string[]).includes(stored)) return stored as Page;
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
  // Página a restaurar ao sair das Notas pelo botão da versão. Se o app já
  // abriu direto nas Notas (refresh), o retorno cai no Reino.
  const notesReturnRef = useRef<Page>('reino');
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
      {/* Engrenagem só-ícone ao lado do fullscreen (lado oposto à telemetria):
          libera um slot de menu no rodapé. */}
      <button
        className={`${styles.configBtn} ${settingsOpen ? styles.configBtnOn : ''}`}
        onClick={() => setSettingsOpen((o) => !o)}
        aria-label={t('nav.config')}
        aria-pressed={settingsOpen}
        title={t('nav.config')}
      >
        <SettingsIcon className={styles.configIcon} aria-hidden="true" />
      </button>
      <FpsMeter />
      <VersionBadge
        notesOpen={page === 'notas' && !settingsOpen}
        onOpenNotes={() => {
          setSettingsOpen(false);
          if (page === 'notas') {
            // Mesmo botão volta para onde o jogador estava antes das Notas
            setPage(notesReturnRef.current);
          } else {
            notesReturnRef.current = page;
            setPage('notas');
          }
        }}
      />

      {/* As telas ficam sempre montadas para o progresso não resetar ao trocar de aba. */}
      <main
        className={`${styles.contentFull} ${page !== 'reino' ? styles.hidden : ''}`}
      >
        <Reino key={`${slotEpoch}:${resetKeys.reino}`} />
      </main>
      <main
        className={`${styles.contentFull} ${page !== 'melhorias' ? styles.hidden : ''}`}
      >
        <Upgrades key={slotEpoch} onNavigate={setPage} />
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
          {PAGES.map((p) => {
            const Icon = PAGE_ICONS[p];
            return (
              <button
                key={p}
                className={`${styles.tab} ${page === p && !settingsOpen ? styles.active : ''}`}
                onClick={() => {
                  setSettingsOpen(false);
                  setPage(p);
                }}
              >
                <Icon className={styles.tabIcon} aria-hidden="true" />
                <span>{t(`nav.${p}`)}</span>
              </button>
            );
          })}
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
