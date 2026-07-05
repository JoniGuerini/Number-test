/** Autenticação (protótipo/mock). Store reativo no mesmo padrão de prefs/sound
    (useSyncExternalStore), com o usuário persistido em localStorage. NÃO fala
    com rede nem valida nada: qualquer "login" é aceito e serve só para desenhar
    o fluxo. No futuro isto vira o elo entre o usuário e os saves — por ora só
    guarda quem "entrou" para o app abrir direto na próxima visita. */

import { useSyncExternalStore } from 'react';

const AUTH_KEY = 'number-test:auth';

/** Como o usuário entrou (conta obrigatória — sem modo convidado). */
export type AuthProvider = 'email' | 'google' | 'apple';

export interface AuthUser {
  name: string;
  email: string;
  provider: AuthProvider;
}

function readStored(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

let user: AuthUser | null = readStored();
const listeners = new Set<() => void>();

export function getAuth(): AuthUser | null {
  return user;
}

/** "Autentica" (mock): grava o usuário e notifica. */
export function signIn(next: AuthUser): void {
  user = next;
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(next));
  } catch {
    // Sem localStorage — vale só pra sessão
  }
  listeners.forEach((fn) => fn());
}

export function signOut(): void {
  user = null;
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    // Sem localStorage — nada a limpar
  }
  listeners.forEach((fn) => fn());
}

export function subscribeAuth(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Usuário atual (ou null), reativo a login/logout. */
export function useAuth(): AuthUser | null {
  return useSyncExternalStore(subscribeAuth, getAuth);
}
