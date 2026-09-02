/**
 * Thin, failure-tolerant wrapper over localStorage. Private-mode browsers and
 * `file://` sandboxes throw on access, so every call degrades to a no-op rather
 * than taking the lab down with it.
 */
const PREFIX = 'vpl:';

function backing(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = `${PREFIX}__probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

let store: Storage | null | undefined;
const memory = new Map<string, string>();

function target(): Storage | null {
  if (store === undefined) store = backing();
  return store;
}

export function readJSON<T>(key: string, fallback: T): T {
  const full = PREFIX + key;
  try {
    const raw = target()?.getItem(full) ?? memory.get(full) ?? null;
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  const full = PREFIX + key;
  const raw = JSON.stringify(value);
  memory.set(full, raw);
  try {
    target()?.setItem(full, raw);
  } catch {
    /* quota or privacy mode — the in-memory copy keeps the session working */
  }
}

export function removeKey(key: string): void {
  const full = PREFIX + key;
  memory.delete(full);
  try {
    target()?.removeItem(full);
  } catch {
    /* ignore */
  }
}
