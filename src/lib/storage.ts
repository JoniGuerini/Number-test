export const COUNTER_SAVE_KEY = 'number-test:contador';
export const GENERATORS_SAVE_KEY = 'number-test:geradores';
export const CYCLES_SAVE_KEY = 'number-test:ciclos';

export function loadSave<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSave(key: string, data: unknown): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function clearSave(key: string): void {
  localStorage.removeItem(key);
}
