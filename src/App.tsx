import { useState } from 'react';
import Counter from './components/Counter/Counter';
import Generators from './components/Generators/Generators';
import Cycles from './components/Cycles/Cycles';
import FpsMeter from './components/FpsMeter/FpsMeter';
import { useWakeLock } from './hooks/useWakeLock';
import {
  clearSave,
  COUNTER_SAVE_KEY,
  CYCLES_SAVE_KEY,
  GENERATORS_SAVE_KEY,
} from './lib/storage';
import styles from './App.module.css';

const SAVE_KEYS: Record<Page, string> = {
  contador: COUNTER_SAVE_KEY,
  geradores: GENERATORS_SAVE_KEY,
  ciclos: CYCLES_SAVE_KEY,
};

type Page = 'contador' | 'geradores' | 'ciclos';

export default function App() {
  useWakeLock();

  const [page, setPage] = useState<Page>('ciclos');
  // Trocar a key remonta o componente da aba, zerando só aquele jogo.
  const [resetKeys, setResetKeys] = useState<Record<Page, number>>({
    contador: 0,
    geradores: 0,
    ciclos: 0,
  });

  const resetActive = () => {
    clearSave(SAVE_KEYS[page]);
    setResetKeys((keys) => ({ ...keys, [page]: keys[page] + 1 }));
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
            className={`btn-secondary danger ${styles.resetTab}`}
            onClick={resetActive}
          >
            Zerar
          </button>
        </nav>
      </footer>
    </div>
  );
}
