import { CHANGELOG, type PatchNote } from '../../data/changelog';
import styles from './PatchNotes.module.css';

/** Categorias de mudança, na ordem de exibição. As chaves batem com os
    campos opcionais de PatchNote; o label é o cabeçalho da seção. */
const SECTIONS: { key: keyof PatchNote; label: string }[] = [
  { key: 'major', label: 'Major features' },
  { key: 'minor', label: 'Minor features' },
  { key: 'qol', label: 'Quality of life' },
  { key: 'fixes', label: 'Fixes' },
];

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

            <p className={styles.summary}>{patch.summary}</p>

            {SECTIONS.map(({ key, label }) => {
              const items = patch[key] as string[] | undefined;
              if (!items || items.length === 0) return null;
              return (
                <section key={key} className={styles.section}>
                  <div className={styles.sectionLabel} data-cat={key}>
                    <span className={styles.dot} aria-hidden="true" />
                    {label}
                  </div>
                  <ul className={styles.items}>
                    {items.map((note, i) => (
                      <li key={i} className={styles.note} data-cat={key}>
                        {note}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </article>
        ))}
      </div>
    </div>
  );
}
