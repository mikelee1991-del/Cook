export const PANTRY_KEY = 'dinner-pantry-v1';
export const PANTRY_MEDIA_KEY = 'dinner-pantry-media-v1';
export const RECOMMENDED_MANUAL_KEY = 'dinner-recommended-manual-v1';
export const RECOMMENDED_DISMISSED_KEY = 'dinner-recommended-dismissed-v1';
export const SAVES_KEY = 'dinner-saves-v1';
export const PHOTO_SCANS_KEY = 'dinner-photo-scans-v1';

export const HOUSE_KEY = 'dinner-house-v1';
export const DEVICE_KEY = 'dinner-device-v1';
export const SYNC_META_KEY = 'dinner-sync-meta-v1';

/** All Dinner data keys in this browser's localStorage. */
export const APP_STORAGE_KEYS = [
  PANTRY_KEY,
  PANTRY_MEDIA_KEY,
  RECOMMENDED_MANUAL_KEY,
  RECOMMENDED_DISMISSED_KEY,
  SAVES_KEY,
  PHOTO_SCANS_KEY,
  HOUSE_KEY,
  DEVICE_KEY,
  SYNC_META_KEY,
] as const;

export function clearAllAppData(): void {
  for (const key of APP_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

/** Wipe pantry, saves, scans, and reload — local only, no undo. */
export function hardResetApp(): void {
  const ok = window.confirm(
    'Erase all Dinner data in this browser?\n\nPantry, recommended list, shelf photos, saved recipes, and photo scans will be removed. This cannot be undone.',
  );
  if (!ok) return;
  clearAllAppData();
  window.location.reload();
}
