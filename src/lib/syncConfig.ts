/** Optional self-hosted worker. When unset, Dinner uses ntfy.sh (works from GitHub Pages). */
export function customSyncApiBase(): string | null {
  const fromEnv = import.meta.env?.VITE_DINNER_SYNC_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.replace(/\/$/, '');
  return null;
}

/** Worker base used for vision when VITE_DINNER_VISION_URL is unset but sync worker is set. */
export function sharedWorkerBase(): string | null {
  return customSyncApiBase();
}
