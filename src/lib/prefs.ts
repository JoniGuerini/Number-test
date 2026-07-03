/** Preferências de vídeo: telemetria (quais cardzinhos do topo aparecem) e
    tema de cores. Vive na mesma chave de config do som — os módulos gravam
    por merge. */

const CONFIG_KEY = 'number-test:config';

/* ===== Tema de cores ===== */

export type ThemeId = 'neutro' | 'midnight' | 'creme' | 'verde';

export const THEMES: { id: ThemeId; name: string }[] = [
  { id: 'neutro', name: 'Dark neutro' },
  { id: 'midnight', name: 'Azul meia-noite' },
  { id: 'creme', name: 'Creme terracota' },
  { id: 'verde', name: 'Verde musgo' },
];

/** Cor da moldura do navegador (theme-color) por tema. */
const THEME_BG: Record<ThemeId, string> = {
  neutro: '#070707',
  midnight: '#0c0e12',
  creme: '#e8dcc8',
  verde: '#0a0f0a',
};

function applyTheme(theme: ThemeId): void {
  // O tema padrão (neutro) vive no :root; os demais via data-theme
  if (theme === 'neutro') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_BG[theme]);
}

export interface VideoPrefs {
  showFps: boolean;
  showFrameTime: boolean;
  showBattery: boolean;
  theme: ThemeId;
}

const DEFAULTS: VideoPrefs = {
  showFps: true,
  showFrameTime: true,
  showBattery: true,
  theme: 'neutro',
};

function readStored(): Partial<VideoPrefs> {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as Partial<VideoPrefs>) : {};
  } catch {
    return {};
  }
}

let prefs: VideoPrefs = { ...DEFAULTS, ...readStored() };
const listeners = new Set<() => void>();

// Aplica o tema salvo assim que o módulo carrega (antes do primeiro paint)
applyTheme(prefs.theme);

export function getVideoPrefs(): VideoPrefs {
  return prefs;
}

export function setVideoPref<K extends keyof VideoPrefs>(
  key: K,
  value: VideoPrefs[K]
): void {
  prefs = { ...prefs, [key]: value };
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...stored, [key]: value }));
  } catch {
    // Sem localStorage — vale só pra sessão
  }
  if (key === 'theme') applyTheme(value as ThemeId);
  listeners.forEach((fn) => fn());
}

/** Para useSyncExternalStore: componentes reagem na hora aos toggles. */
export function subscribeVideoPrefs(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
