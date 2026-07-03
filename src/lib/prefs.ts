/** Preferências de vídeo/telemetria (quais cardzinhos do topo aparecem).
    Vive na mesma chave de config do som — os dois módulos gravam por merge. */

const CONFIG_KEY = 'number-test:config';

export interface VideoPrefs {
  showFps: boolean;
  showFrameTime: boolean;
  showBattery: boolean;
}

const DEFAULTS: VideoPrefs = {
  showFps: true,
  showFrameTime: true,
  showBattery: true,
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
  listeners.forEach((fn) => fn());
}

/** Para useSyncExternalStore: componentes reagem na hora aos toggles. */
export function subscribeVideoPrefs(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
