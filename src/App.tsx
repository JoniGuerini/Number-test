import { useEffect, useState } from 'react';
import Counter from './components/Counter/Counter';
import Generators from './components/Generators/Generators';
import Cycles from './components/Cycles/Cycles';
import Activity from './components/Activity/Activity';
import Settings from './components/Settings/Settings';
import FpsMeter from './components/FpsMeter/FpsMeter';
import { useWakeLock } from './hooks/useWakeLock';
import { playPress, playRelease } from './lib/sound';
import {
  clearSave,
  COUNTER_SAVE_KEY,
  CYCLES_SAVE_KEY,
  GENERATORS_SAVE_KEY,
} from './lib/storage';
import styles from './App.module.css';

/** Jogos com save (podem ser zerados pela Config). */
const SAVE_KEYS: Record<GameTab, string> = {
  contador: COUNTER_SAVE_KEY,
  geradores: GENERATORS_SAVE_KEY,
  ciclos: CYCLES_SAVE_KEY,
};

export type GameTab = 'contador' | 'geradores' | 'ciclos';
type Page = GameTab | 'atividade' | 'config';

export default function App() {
  useWakeLock();

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

  const [page, setPage] = useState<Page>('ciclos');
  // Trocar a key remonta o componente da aba, zerando só aquele jogo.
  const [resetKeys, setResetKeys] = useState({
    contador: 0,
    geradores: 0,
    ciclos: 0,
  });

  const resetGame = (game: GameTab) => {
    clearSave(SAVE_KEYS[game]);
    setResetKeys((keys) => ({ ...keys, [game]: keys[game] + 1 }));
  };

  return (
    <div className={styles.frame}>
      <FpsMeter />

      {/* As duas telas ficam sempre montadas para o progresso não resetar ao trocar de aba. */}
      <main
        className={`${styles.contentCenter} ${page !== 'contador' ? styles.hidden : ''}`}
      >
        <Counter key={resetKeys.contador} />
      </main>
      <main
        className={`${styles.contentFull} ${page !== 'geradores' ? styles.hidden : ''}`}
      >
        <Generators key={resetKeys.geradores} />
      </main>
      <main
        className={`${styles.contentFull} ${page !== 'ciclos' ? styles.hidden : ''}`}
      >
        <Cycles key={resetKeys.ciclos} />
      </main>
      <main
        className={`${styles.contentFull} ${page !== 'atividade' ? styles.hidden : ''}`}
      >
        {/* Remonta ao zerar os Ciclos para o log sumir junto */}
        <Activity key={resetKeys.ciclos} />
      </main>
      <main
        className={`${styles.contentCenter} ${page !== 'config' ? styles.hidden : ''}`}
      >
        <Settings onReset={resetGame} />
      </main>

      <footer className={styles.footer}>
        <nav className={styles.tabs}>
          <button
            className={`${styles.tab} ${page === 'contador' ? styles.active : ''}`}
            onClick={() => setPage('contador')}
          >
            Contador
          </button>
          <button
            className={`${styles.tab} ${page === 'geradores' ? styles.active : ''}`}
            onClick={() => setPage('geradores')}
          >
            Geradores
          </button>
          <button
            className={`${styles.tab} ${page === 'ciclos' ? styles.active : ''}`}
            onClick={() => setPage('ciclos')}
          >
            Ciclos
          </button>
          <button
            className={`${styles.tab} ${page === 'atividade' ? styles.active : ''}`}
            onClick={() => setPage('atividade')}
          >
            Atividade
          </button>
          <button
            className={`${styles.tab} ${page === 'config' ? styles.active : ''}`}
            onClick={() => setPage('config')}
          >
            Config
          </button>
        </nav>
      </footer>
    </div>
  );
}
