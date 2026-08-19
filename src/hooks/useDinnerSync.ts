import { useCallback, useEffect, useRef, useState } from 'react';
import { DEVICE_KEY, HOUSE_KEY, SYNC_META_KEY } from '../lib/appStorage';
import { decryptJson, encryptJson } from '../lib/dinnerCrypto';
import {
  createHousehold,
  formatHouseCode,
  houseFromHash,
  parseHouseCode,
  type Household,
} from '../lib/dinnerHouse';
import {
  mergeSnapshots,
  slimSnapshot,
  snapshotsEqual,
  type DinnerSnapshot,
} from '../lib/dinnerSnapshot';
import { pullHousePayload, pushHousePayload } from '../lib/dinnerSyncApi';
import type { PhotoScan } from './usePhotoScans';
import type { PantryItem, PantryMedia, RecommendedIngredient, SavedRecipe } from '../types';

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error';

interface SyncMeta {
  pantryTombs: Record<string, number>;
  mediaTombs: Record<string, number>;
  recTombs: Record<string, number>;
  savesTombs: Record<string, number>;
  scansTombs: Record<string, number>;
  dismissedAt: number;
}

const EMPTY_META: SyncMeta = {
  pantryTombs: {},
  mediaTombs: {},
  recTombs: {},
  savesTombs: {},
  scansTombs: {},
  dismissedAt: 0,
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function deviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = `dev-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

function noteDeletes(
  prev: Array<{ id: string }>,
  next: Array<{ id: string }>,
  tombs: Record<string, number>,
  applying: boolean,
): Record<string, number> {
  if (applying) return tombs;
  const nextIds = new Set(next.map((item) => item.id));
  const out = { ...tombs };
  for (const item of prev) {
    if (!nextIds.has(item.id)) out[item.id] = Date.now();
  }
  return out;
}

function writeHash(house: Household) {
  const next = `#house=${formatHouseCode(house)}`;
  if (location.hash !== next) {
    history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
  }
}

export function useDinnerSync(args: {
  pantry: PantryItem[];
  replacePantry: (items: PantryItem[]) => void;
  media: PantryMedia[];
  replaceMedia: (items: PantryMedia[]) => void;
  recommendedManual: RecommendedIngredient[];
  replaceRecommendedManual: (items: RecommendedIngredient[]) => void;
  dismissed: string[];
  replaceDismissed: (names: string[]) => void;
  saves: SavedRecipe[];
  replaceSaves: (items: SavedRecipe[]) => void;
  scans: PhotoScan[];
  replaceScans: (items: PhotoScan[]) => void;
}) {
  const [house, setHouse] = useState<Household | null>(() => loadJson<Household | null>(HOUSE_KEY, null));
  const [status, setStatus] = useState<SyncStatus>('off');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [meta, setMeta] = useState<SyncMeta>(() => loadJson(SYNC_META_KEY, EMPTY_META));
  const applying = useRef(false);
  const busy = useRef(false);
  const queued = useRef(false);
  const houseRef = useRef<Household | null>(house);
  const argsRef = useRef(args);
  argsRef.current = args;
  houseRef.current = house;
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const prev = useRef({
    pantry: args.pantry,
    media: args.media,
    rec: args.recommendedManual,
    saves: args.saves,
    scans: args.scans,
    dismissed: args.dismissed,
  });

  const houseCode = house ? formatHouseCode(house) : '';
  const shareUrl =
    typeof location !== 'undefined' && house
      ? `${location.origin}${location.pathname}${location.search}#house=${houseCode}`
      : '';

  useEffect(() => {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  }, [meta]);

  useEffect(() => {
    if (house) localStorage.setItem(HOUSE_KEY, JSON.stringify(house));
  }, [house]);

  const buildSnapshot = useCallback((): DinnerSnapshot => {
    const a = argsRef.current;
    const m = metaRef.current;
    return {
      v: 1,
      revisedAt: Date.now(),
      deviceId: deviceId(),
      pantry: a.pantry,
      pantryTombs: m.pantryTombs,
      media: a.media,
      mediaTombs: m.mediaTombs,
      recommendedManual: a.recommendedManual,
      recTombs: m.recTombs,
      dismissed: a.dismissed,
      dismissedAt: m.dismissedAt,
      saves: a.saves,
      savesTombs: m.savesTombs,
      scans: a.scans.filter((s) => s.status !== 'scanning'),
      scansTombs: m.scansTombs,
    };
  }, []);

  const applySnapshot = useCallback((snap: DinnerSnapshot) => {
    const a = argsRef.current;
    applying.current = true;
    a.replacePantry(snap.pantry);
    a.replaceMedia(snap.media);
    a.replaceRecommendedManual(snap.recommendedManual);
    a.replaceDismissed(snap.dismissed);
    a.replaceSaves(snap.saves);
    a.replaceScans(snap.scans as PhotoScan[]);
    setMeta({
      pantryTombs: snap.pantryTombs,
      mediaTombs: snap.mediaTombs,
      recTombs: snap.recTombs ?? {},
      savesTombs: snap.savesTombs,
      scansTombs: snap.scansTombs,
      dismissedAt: snap.dismissedAt,
    });
    queueMicrotask(() => {
      applying.current = false;
    });
  }, []);

  const syncNow = useCallback(async (currentHouse: Household) => {
    if (busy.current) {
      queued.current = true;
      return;
    }
    busy.current = true;
    setStatus('syncing');
    try {
      const local = buildSnapshot();
      const payload = await pullHousePayload(currentHouse.slot);
      let remote: DinnerSnapshot | null = null;
      let merged = local;
      if (payload) {
        remote = await decryptJson<DinnerSnapshot>(payload, currentHouse.secret);
        merged = mergeSnapshots(local, remote);
      }
      const slim = slimSnapshot(merged);
      if (!remote || !snapshotsEqual(slim, local)) {
        applySnapshot(slim);
      }
      if (!remote || !snapshotsEqual(slim, remote)) {
        const cipher = await encryptJson(slim, currentHouse.secret);
        await pushHousePayload(currentHouse.slot, cipher);
      }
      setLastSyncedAt(Date.now());
      setError(null);
      setStatus('synced');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not sync Dinner across devices.');
    } finally {
      busy.current = false;
      if (queued.current) {
        queued.current = false;
        const nextHouse = houseRef.current;
        if (nextHouse) void syncNow(nextHouse);
      }
    }
  }, [applySnapshot, buildSnapshot]);

  useEffect(() => {
    const fromUrl = houseFromHash(location.hash);
    if (fromUrl) {
      setHouse(fromUrl);
      writeHash(fromUrl);
      return;
    }
    const stored = loadJson<Household | null>(HOUSE_KEY, null);
    if (stored) {
      setHouse(stored);
      writeHash(stored);
      return;
    }
    const created = createHousehold();
    setHouse(created);
    writeHash(created);
  }, []);

  useEffect(() => {
    if (!house) return;
    void syncNow(house);
    const onVis = () => {
      if (document.visibilityState === 'visible') void syncNow(house);
    };
    const timer = window.setInterval(() => void syncNow(house), 20_000);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [house, syncNow]);

  useEffect(() => {
    const nextMeta: SyncMeta = {
      pantryTombs: noteDeletes(prev.current.pantry, args.pantry, meta.pantryTombs, applying.current),
      mediaTombs: noteDeletes(prev.current.media, args.media, meta.mediaTombs, applying.current),
      recTombs: noteDeletes(prev.current.rec, args.recommendedManual, meta.recTombs, applying.current),
      savesTombs: noteDeletes(prev.current.saves, args.saves, meta.savesTombs, applying.current),
      scansTombs: noteDeletes(prev.current.scans, args.scans, meta.scansTombs, applying.current),
      dismissedAt:
        !applying.current &&
        JSON.stringify(prev.current.dismissed) !== JSON.stringify(args.dismissed)
          ? Date.now()
          : meta.dismissedAt,
    };
    prev.current = {
      pantry: args.pantry,
      media: args.media,
      rec: args.recommendedManual,
      saves: args.saves,
      scans: args.scans,
      dismissed: args.dismissed,
    };
    if (JSON.stringify(nextMeta) !== JSON.stringify(meta)) setMeta(nextMeta);
  }, [args.pantry, args.media, args.recommendedManual, args.saves, args.scans, args.dismissed, meta]);

  useEffect(() => {
    if (!house || applying.current) return;
    const handle = window.setTimeout(() => void syncNow(house), 1200);
    return () => window.clearTimeout(handle);
  }, [
    house,
    args.pantry,
    args.media,
    args.recommendedManual,
    args.saves,
    args.scans,
    args.dismissed,
    meta,
    syncNow,
  ]);

  const joinCode = useCallback((raw: string) => {
    const parsed = parseHouseCode(raw) ?? houseFromHash(raw);
    if (!parsed) return false;
    setHouse(parsed);
    writeHash(parsed);
    return true;
  }, []);

  return {
    status,
    error,
    houseCode,
    shareUrl,
    lastSyncedAt,
    syncNow: () => (house ? syncNow(house) : Promise.resolve()),
    joinCode,
  };
}
