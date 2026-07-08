/** Aba Perfil: identidade do jogador + raio-X do reino (mock do ranking). */

import { signOut, useAuth } from '../../../lib/auth';
import { getDateLocale, useI18n, type TKey } from '../../../lib/locale';
import {
  LB_GEN_CAP,
  LB_LINE,
  YOU_ENTRY,
  YOU_GEN_LEVEL,
  YOU_SEASON_JOINED,
} from '../../Leaderboard/mockData';
import styles from '../Settings.module.css';

export default function ProfileTab() {
  const { t } = useI18n();
  const authUser = useAuth();
  if (!authUser) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t('tab.perfil')}</h2>
      <p className={styles.sectionHint}>{t('profile.hint')}</p>

      <div className={styles.profileHead}>
        <div className={styles.profileId}>
          <span className={styles.profileName} data-rank={YOU_ENTRY.rank}>
            {authUser.name}
          </span>
          <span className={styles.profileVia}>{authUser.email}</span>
        </div>
      </div>

      <span className={styles.subLabel}>{t('profile.kingdom')}</span>
      <div className={styles.statGrid}>
        {(
          [
            [t('chat.profile.ranking'), `#${YOU_ENTRY.pos.toLocaleString(getDateLocale())}`],
            [t('chat.profile.prosperity'), YOU_ENTRY.prosperity.toLocaleString(getDateLocale())],
            [t('chat.profile.wheat'), YOU_ENTRY.bases.comida],
            [t('chat.profile.topGen'), t(`reino.gen.${LB_LINE}.${YOU_GEN_LEVEL}` as TKey)],
            [t('chat.profile.generators'), `${YOU_GEN_LEVEL}/${LB_GEN_CAP}`],
            [t('chat.profile.clan'), YOU_ENTRY.clan ?? t('chat.profile.noClan')],
            [t('chat.profile.since'), t('chat.profile.season', { n: YOU_SEASON_JOINED })],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div className={styles.statCard} key={label}>
            <span className={styles.statCardLabel}>{label}</span>
            <span className={styles.statCardValue}>{value}</span>
          </div>
        ))}
      </div>

      <button className={`btn-secondary ${styles.signoutBtn}`} onClick={signOut}>
        {t('auth.signout')}
      </button>
    </section>
  );
}
