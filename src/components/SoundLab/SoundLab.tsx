import { SOUNDS } from '../../lib/sound';
import styles from './SoundLab.module.css';

/** Aba de audição dos efeitos sonoros candidatos a som de clique. */
export default function SoundLab() {
  const groups = [...new Set(SOUNDS.map((s) => s.group))];

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Toque em um card para ouvir o efeito ({SOUNDS.length} candidatos).
      </p>

      {groups.map((group) => (
        <section key={group} className={styles.section}>
          <h3 className={styles.groupTitle}>{group}</h3>
          <div className={styles.grid}>
            {SOUNDS.filter((s) => s.group === group).map((sound) => (
              // data-nosound: não dispara o clique global por cima da audição
              <button
                key={sound.id}
                className={styles.card}
                data-nosound
                onClick={() => sound.play()}
              >
                <span className={styles.playIcon}>▶</span>
                <span className={styles.name}>{sound.name}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
