import { SOUNDS } from '../../lib/sound';
import styles from './SoundLab.module.css';

/** Aba de audição dos efeitos sonoros candidatos a som de clique. */
export default function SoundLab() {
  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Toque em ouvir para comparar os candidatos a som de clique.
      </p>

      <div className={styles.list}>
        {SOUNDS.map((sound) => (
          <div key={sound.id} className={styles.row}>
            <span className={styles.name}>{sound.name}</span>
            {/* data-nosound: não dispara o clique global por cima da audição */}
            <button
              className={`btn-primary ${styles.playBtn}`}
              data-nosound
              onClick={() => sound.play()}
            >
              ▶ ouvir
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
