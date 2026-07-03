import { CHANGELOG } from '../../data/changelog';
import styles from './PatchNotes.module.css';

/** Aba Notas: o histórico de versões do laboratório. */
export default function PatchNotes() {
  return (
    <div className={styles.wrap}>
      <div className={styles.list}>
        {CHANGELOG.map((patch) => (
          <article key={patch.version} className={styles.entry}>
            <header className={styles.header}>
              <h2 className={styles.version}>{patch.version}</h2>
              <span className={styles.title}>{patch.title}</span>
              <span className={styles.date}>{patch.date}</span>
            </header>
            <ul className={styles.notes}>
              {patch.notes.map((note, i) => (
                <li key={i} className={styles.note}>
                  {note}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
