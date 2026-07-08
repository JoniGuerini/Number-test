/** Painel de sub-recursos da linha ativa — só exibição (estoque futuro).
    memo(): conteúdo estático por linha; fica fora dos renders 4x/s do Reino. */

import { memo } from 'react';
import { fmt } from '../../lib/format';
import { useI18n, type TKey } from '../../lib/locale';
import styles from './Reino.module.css';
import type { LineId } from '../../game/lines';
import { subResourcesOf } from '../../game/subresources';

interface SubResourcePanelProps {
  lineId: LineId;
}

function SubResourcePanel({ lineId }: SubResourcePanelProps) {
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

export default memo(SubResourcePanel);
