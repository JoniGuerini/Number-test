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
import { startGameRuntime, useGameStore } from './store/gameStore';
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
/* Abas do rodapé — Notas, Atividade, Classificação e Social ficam fora:
   abrem pelos botões do topo (cardzinho da versão e a fileira direita) */
const PAGES: Exclude<Page, 'notas' | 'atividade' | 'classificacao' | 'chat'>[] = ['reino', 'melhorias'];
const VALID_PAGES: Page[] = [...PAGES, 'chat', 'classificacao', 'atividade', 'notas'];

/* Ícones do menu (Lucide): só no chrome da UI — geradores e abas de linha de
   produção seguem só com texto, por decisão de design. */
const PAGE_ICONS: Record<Exclude<Page, 'notas' | 'atividade' | 'classificacao' | 'chat'>, LucideIcon> = {
  reino: Castle,
  melhorias: FlaskConical,
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

  // Runtime do jogo (tick da simulação + persistência) — vive na gameStore,
  // fora do React; roda independente de qual página está visível.
  useEffect(() => startGameRuntime(), []);

  // Feedback sonoro global: um som ao pressionar qualquer botão habilitado e
  // outro (variação mais leve) ao soltar — sensação de tecla física.
  // CAPTURE, não bubble: o React processa o clique (compra etc.) de forma
  // síncrona antes de o evento chegar ao document, e a compra bem-sucedida
  // costuma DESABILITAR o botão (preço dobra > saldo) — no bubble, o clique
  // que funcionou era avaliado contra o DOM pós-compra e ficava mudo.
  useEffect(() => {
    // Um registro por pointerId: dois dedos no touch não engolem o soltar.
    const down = new Set<number>();

    const onPointerDown = (e: PointerEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest?.('button');
      if (btn && !btn.disabled && !btn.hasAttribute('data-nosound')) {
        down.add(e.pointerId);
        playPress();
      }
    };
    // O soltar toca mesmo se o dedo/cursor saiu do botão (como tecla real)
    const onPointerUp = (e: PointerEvent) => {
      if (down.delete(e.pointerId)) playRelease();
    };
    // Gesto cancelado (virou scroll etc.): esquece o toque sem som de soltar
    const onPointerCancel = (e: PointerEvent) => {
      down.delete(e.pointerId);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerCancel, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerCancel, true);
    };
  }, []);

  const [page, setPage] = useState<Page>(readStoredPage);
  // Fechar um menu do topo volta sempre ao último menu PRINCIPAL (rodapé:
  // Produção/Melhorias) — nunca a outro menu do topo. O ref acompanha a
  // navegação: só páginas do rodapé o atualizam.
  const mainReturnRef = useRef<Page>('reino');
  useEffect(() => {
    if ((PAGES as string[]).includes(page)) mainReturnRef.current = page;
  }, [page]);
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

  // Zera um modo de um slot específico; se for o ativo, recarrega a store
  // (senão o estado vivo regravaria o save apagado) e remonta o jogo.
  const resetGame = (slotId: string, game: GameTab) => {
    clearSave(saveKeyForSlot(slotId, game));
    if (slotId === activeSlotId) {
      useGameStore.getState().hydrate();
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
    // Grava o progresso no slot atual ANTES de trocar (a persistência
    // periódica pode estar até 1s atrasada), depois carrega o slot novo.
    useGameStore.getState().persist();
    switchSlot(id);
    useGameStore.getState().hydrate();
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
      {/* Fileira de controles do topo-direito: telemetria, Atividade,
          fullscreen e a engrenagem de Config colada na borda */}
      <div className={styles.topRight}>
        <FpsMeter />
        <button
          className={`${styles.cornerBtn} ${page === 'chat' && !settingsOpen ? styles.cornerBtnOn : ''}`}
          onClick={() => {
            setSettingsOpen(false);
            setPage(page === 'chat' ? mainReturnRef.current : 'chat');
          }}
          title={t('nav.chat')}
        >
          <MessagesSquare className={styles.cornerIcon} aria-hidden="true" />
          <span>{t('nav.chat')}</span>
        </button>
        <button
          className={`${styles.cornerBtn} ${page === 'classificacao' && !settingsOpen ? styles.cornerBtnOn : ''}`}
          onClick={() => {
            setSettingsOpen(false);
            setPage(page === 'classificacao' ? mainReturnRef.current : 'classificacao');
          }}
          title={t('nav.classificacao')}
        >
          <Trophy className={styles.cornerIcon} aria-hidden="true" />
          <span>{t('nav.classificacao')}</span>
        </button>
        <button
          className={`${styles.cornerBtn} ${page === 'atividade' && !settingsOpen ? styles.cornerBtnOn : ''}`}
          onClick={() => {
            setSettingsOpen(false);
            setPage(page === 'atividade' ? mainReturnRef.current : 'atividade');
          }}
          title={t('nav.atividade')}
        >
          <History className={styles.cornerIcon} aria-hidden="true" />
          <span>{t('nav.atividade')}</span>
        </button>
        <FullscreenToggle />
        <button
          className={`${styles.cornerBtn} ${styles.cornerBtnSquare} ${settingsOpen ? styles.cornerBtnOn : ''}`}
          onClick={() => setSettingsOpen((o) => !o)}
          aria-label={t('nav.config')}
          aria-pressed={settingsOpen}
          title={t('nav.config')}
        >
          <SettingsIcon className={styles.cornerIcon} aria-hidden="true" />
        </button>
      </div>
      <VersionBadge
        notesOpen={page === 'notas' && !settingsOpen}
        onOpenNotes={() => {
          setSettingsOpen(false);
          // O mesmo botão fecha as Notas, voltando ao último menu principal
          setPage(page === 'notas' ? mainReturnRef.current : 'notas');
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
