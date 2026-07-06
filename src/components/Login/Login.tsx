/** Tela de autenticação (100% mock — protótipo). Desenha o fluxo de entrar /
    criar conta que futuramente vinculará o save ao usuário. Nada valida nem
    fala com rede: "Entrar" funciona com um clique (campos vazios usam um perfil
    mock); provedores sociais e criar conta seguem o mesmo padrão provisório.
    Segue a linguagem visual do card de "Modo de jogo": card único centralizado,
    título serif em latão, campos e botões dos esqueletos globais. */

import { useState } from 'react';
import { useI18n } from '../../lib/locale';
import { signIn, type AuthProvider } from '../../lib/auth';
import styles from './Login.module.css';

type Tab = 'signin' | 'signup';

/** Deriva um nome de exibição a partir do e-mail (parte antes do @). */
const nameFromEmail = (email: string): string => {
  const local = email.split('@')[0]?.trim();
  if (!local) return 'Jogador';
  return local.charAt(0).toUpperCase() + local.slice(1);
};

export default function Login() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isSignup = tab === 'signup';
  // Mock: entrar não exige campos; criar conta ainda pede nome/e-mail/senha preenchidos.
  const canSubmit =
    !isSignup ||
    (email.trim().length > 0 &&
      password.trim().length > 0 &&
      name.trim().length > 0);

  const submit = () => {
    if (!canSubmit) return;
    const resolvedEmail = email.trim() || 'jogador@local.dev';
    signIn({
      name: isSignup ? name.trim() : nameFromEmail(resolvedEmail),
      email: resolvedEmail,
      provider: 'email',
    });
  };

  // Provedores sociais (mock): em produção o e-mail vem do provedor; aqui um
  // endereço fictício mantém o perfil coerente (que exibe só o e-mail).
  const social = (provider: Exclude<AuthProvider, 'email'>) => {
    const mockEmail = provider === 'google' ? 'voce@gmail.com' : 'voce@icloud.com';
    signIn({ name: nameFromEmail(mockEmail), email: mockEmail, provider });
  };

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <span className={styles.mockNote}>{t('auth.mockNote')}</span>

        <header className={styles.brand}>
          <h1 className={styles.title}>{t('auth.title')}</h1>
          <p className={styles.tagline}>{t('auth.tagline')}</p>
        </header>

        <nav className={styles.tabs}>
          <button
            className={`${styles.tab} ${!isSignup ? styles.tabActive : ''}`}
            onClick={() => setTab('signin')}
          >
            {t('auth.tab.signin')}
          </button>
          <button
            className={`${styles.tab} ${isSignup ? styles.tabActive : ''}`}
            onClick={() => setTab('signup')}
          >
            {t('auth.tab.signup')}
          </button>
        </nav>

        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {isSignup && (
            <label className={styles.field}>
              <span className={styles.label}>{t('auth.name')}</span>
              <input
                className={styles.input}
                type="text"
                value={name}
                maxLength={40}
                autoComplete="name"
                placeholder={t('auth.namePlaceholder')}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}

          <label className={styles.field}>
            <span className={styles.label}>{t('auth.email')}</span>
            <input
              className={styles.input}
              type="email"
              value={email}
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.labelRow}>
              <span className={styles.label}>{t('auth.password')}</span>
              {!isSignup && (
                <button
                  type="button"
                  className={styles.forgot}
                  onClick={(e) => e.preventDefault()}
                >
                  {t('auth.forgot')}
                </button>
              )}
            </span>
            <input
              className={styles.input}
              type="password"
              value={password}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder={t('auth.passwordPlaceholder')}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <button
            type="submit"
            className={`btn-primary ${styles.submit}`}
            disabled={!canSubmit}
          >
            {isSignup ? t('auth.signup') : t('auth.signin')}
          </button>
        </form>

        <div className={styles.divider}>
          <span>{t('auth.or')}</span>
        </div>

        <div className={styles.providers}>
          <button className={styles.provider} onClick={() => social('google')}>
            <svg
              className={styles.providerIcon}
              width="16"
              height="16"
              viewBox="0 0 18 18"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
              />
              <path
                fill="#FBBC05"
                d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
              />
            </svg>
            {t('auth.google')}
          </button>
          <button className={styles.provider} onClick={() => social('apple')}>
            <svg
              className={styles.providerIcon}
              width="16"
              height="16"
              viewBox="0 0 18 18"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M13.28 9.57c-.02-1.9 1.55-2.8 1.62-2.85-.88-1.3-2.26-1.47-2.75-1.49-1.17-.12-2.28.69-2.87.69-.59 0-1.5-.67-2.47-.65-1.27.02-2.44.74-3.1 1.87-1.32 2.3-.34 5.7.95 7.56.63.91 1.38 1.93 2.36 1.9.95-.04 1.3-.61 2.45-.61 1.14 0 1.46.61 2.46.59 1.02-.02 1.66-.93 2.28-1.85.72-1.06 1.02-2.08 1.03-2.13-.02-.01-1.97-.76-1.99-3.02ZM11.4 3.9c.52-.64.87-1.51.78-2.4-.75.03-1.66.5-2.2 1.13-.48.56-.9 1.46-.79 2.32.84.06 1.69-.42 2.21-1.05Z" />
            </svg>
            {t('auth.apple')}
          </button>
        </div>

        <p className={styles.legal}>{t('auth.legal')}</p>
      </div>
    </div>
  );
}
