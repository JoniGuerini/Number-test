/** Painel de sub-recursos da linha ativa — só exibição (estoque futuro). */

import { fmt } from '../../lib/format';
import { useI18n, type TKey } from '../../lib/locale';
import styles from './Reino.module.css';
import type { LineId } from './lines';
import { subResourcesOf } from './subresources';

interface SubResourcePanelProps {
  lineId: LineId;
}

export default function SubResourcePanel({ lineId }: SubResourcePanelProps) {
  const { t } = useI18n();
  const subs = subResourcesOf(lineId);

  return (
    <section className={styles.subSection} aria-label={t('reino.sub.section')}>
      <div className={styles.subCards}>
        {subs.map((slug) => (
          <div key={slug} className={styles.subCard}>
            <span className={styles.subLabel}>
              {t(`reino.sub.${lineId}.${slug}` as TKey)}
            </span>
            <span className={styles.subAmount}>{fmt(0)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
