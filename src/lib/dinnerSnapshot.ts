import type { PantryItem, PantryMedia, RecommendedIngredient, SavedRecipe } from '../types';

export interface SyncScan {
  id: string;
  images: string[];
  status: 'scanning' | 'done' | 'error';
  clips: unknown[];
  progress: string;
  error?: string;
  createdAt: string;
  updatedAt?: number;
}

export interface DinnerSnapshot {
  v: 1;
  revisedAt: number;
  deviceId: string;
  pantry: PantryItem[];
  pantryTombs: Record<string, number>;
  media: PantryMedia[];
  mediaTombs: Record<string, number>;
  recommendedManual: RecommendedIngredient[];
  recTombs: Record<string, number>;
  dismissed: string[];
  dismissedAt: number;
  saves: SavedRecipe[];
  savesTombs: Record<string, number>;
  scans: SyncScan[];
  scansTombs: Record<string, number>;
}

const MAX_CHARS = 1_200_000;

function stamp<T extends { updatedAt?: number }>(item: T, fallback = 0): number {
  return typeof item.updatedAt === 'number' && item.updatedAt > 0 ? item.updatedAt : fallback;
}

export function mergeTombs(
  a: Record<string, number> = {},
  b: Record<string, number> = {},
): Record<string, number> {
  const out = { ...a };
  for (const [id, ts] of Object.entries(b)) {
    out[id] = Math.max(out[id] ?? 0, ts);
  }
  return out;
}

export function mergeById<T extends { id: string; updatedAt?: number }>(
  local: T[],
  remote: T[],
  tombs: Record<string, number>,
): T[] {
  const map = new Map<string, T>();
  for (const item of [...local, ...remote]) {
    const prev = map.get(item.id);
    if (!prev || stamp(item) >= stamp(prev)) map.set(item.id, item);
  }
  return [...map.values()].filter((item) => stamp(item) > (tombs[item.id] ?? 0));
}

export function emptySnapshot(deviceId: string, revisedAt = Date.now()): DinnerSnapshot {
  return {
    v: 1,
    revisedAt,
    deviceId,
    pantry: [],
    pantryTombs: {},
    media: [],
    mediaTombs: {},
    recommendedManual: [],
    recTombs: {},
    dismissed: [],
    dismissedAt: 0,
    saves: [],
    savesTombs: {},
    scans: [],
    scansTombs: {},
  };
}

export function mergeSnapshots(local: DinnerSnapshot, remote: DinnerSnapshot): DinnerSnapshot {
  const pantryTombs = mergeTombs(local.pantryTombs, remote.pantryTombs);
  const mediaTombs = mergeTombs(local.mediaTombs, remote.mediaTombs);
  const savesTombs = mergeTombs(local.savesTombs, remote.savesTombs);
  const scansTombs = mergeTombs(local.scansTombs, remote.scansTombs);
  const recTombs = mergeTombs(local.recTombs ?? {}, remote.recTombs ?? {});
  const dismissed =
    (local.dismissedAt || 0) >= (remote.dismissedAt || 0) ? local.dismissed : remote.dismissed;
  const dismissedAt = Math.max(local.dismissedAt || 0, remote.dismissedAt || 0);
  return {
    v: 1,
    revisedAt: Math.max(local.revisedAt, remote.revisedAt, Date.now()),
    deviceId: local.deviceId,
    pantry: mergeById(local.pantry, remote.pantry, pantryTombs),
    pantryTombs,
    media: mergeById(local.media, remote.media, mediaTombs),
    mediaTombs,
    recommendedManual: mergeById(local.recommendedManual, remote.recommendedManual, recTombs),
    recTombs,
    dismissed,
    dismissedAt,
    saves: mergeById(local.saves, remote.saves, savesTombs),
    savesTombs,
    scans: mergeById(local.scans, remote.scans, scansTombs),
    scansTombs,
  };
}

function stripDataUrls<T>(items: T[], key: 'src' | 'images'): T[] {
  return items.map((item) => {
    const rec = item as T & { src?: string; images?: string[] };
    if (key === 'src' && rec.src?.startsWith('data:')) return { ...rec, src: '' };
    if (key === 'images' && Array.isArray(rec.images)) {
      return { ...rec, images: rec.images.filter((src) => !src.startsWith('data:')) };
    }
    return item;
  });
}

/** Drop bulky data-URL photos if the snapshot is too large to upload. */
export function slimSnapshot(snapshot: DinnerSnapshot): DinnerSnapshot {
  let current = snapshot;
  if (JSON.stringify(current).length <= MAX_CHARS) return current;
  current = {
    ...current,
    media: stripDataUrls(current.media, 'src'),
    scans: current.scans.map((s) => ({ ...s, images: [] })),
  };
  if (JSON.stringify(current).length <= MAX_CHARS) return current;
  return {
    ...current,
    saves: stripDataUrls(current.saves, 'images'),
  };
}

export function snapshotsEqual(a: DinnerSnapshot, b: DinnerSnapshot): boolean {
  const skip = new Set(['revisedAt', 'deviceId']);
  const pick = (s: DinnerSnapshot) =>
    Object.fromEntries(Object.entries(s).filter(([k]) => !skip.has(k)));
  return JSON.stringify(pick(a)) === JSON.stringify(pick(b));
}
