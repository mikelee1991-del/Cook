import { useCallback, useEffect, useState } from 'react';
import type { SortedClip } from '../lib/recipeSort';
import { PHOTO_SCANS_KEY } from '../lib/appStorage';
import { scanImagesForRecipes } from '../lib/scanImages';
import { uid } from '../lib/pantryUtils';

export type ScanStatus = 'scanning' | 'done' | 'error';

export interface PhotoScan {
  id: string;
  images: string[];
  status: ScanStatus;
  clips: SortedClip[];
  progress: string;
  error?: string;
  createdAt: string;
}

function loadScans(): PhotoScan[] {
  try {
    const raw = localStorage.getItem(PHOTO_SCANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PhotoScan[];
    // Drop in-progress scans from a previous session
    return Array.isArray(parsed)
      ? parsed.filter((s) => s.status !== 'scanning')
      : [];
  } catch {
    return [];
  }
}

export function usePhotoScans() {
  const [scans, setScans] = useState<PhotoScan[]>(() => loadScans());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const toSave = scans.filter((s) => s.status !== 'scanning');
      localStorage.setItem(PHOTO_SCANS_KEY, JSON.stringify(toSave));
      setError(null);
    } catch {
      setError('Storage is full — remove some scanned pages.');
    }
  }, [scans]);

  const removeScan = useCallback((id: string) => {
    setScans((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const removeClip = useCallback((scanId: string, clipId: string) => {
    setScans((prev) =>
      prev.map((s) =>
        s.id === scanId ? { ...s, clips: s.clips.filter((c) => c.id !== clipId) } : s,
      ),
    );
  }, []);

  const setClipKind = useCallback(
    (scanId: string, clipId: string, kind: SortedClip['kind']) => {
      setScans((prev) =>
        prev.map((s) =>
          s.id === scanId
            ? {
                ...s,
                clips: s.clips.map((c) => (c.id === clipId ? { ...c, kind } : c)),
              }
            : s,
        ),
      );
    },
    [],
  );

  const updateClip = useCallback(
    (scanId: string, clipId: string, patch: Partial<Pick<SortedClip, 'title' | 'body'>>) => {
      setScans((prev) =>
        prev.map((s) =>
          s.id === scanId
            ? {
                ...s,
                clips: s.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
              }
            : s,
        ),
      );
    },
    [],
  );

  const runOcr = useCallback(async (id: string, sources: Array<string | Blob>) => {
    try {
      const clips = await scanImagesForRecipes(sources, (progress) => {
        setScans((prev) => prev.map((s) => (s.id === id ? { ...s, progress } : s)));
      });
      setScans((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status: 'done', clips, error: undefined, progress: 'Done' } : s,
        ),
      );
      return id;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not read text from these photos.';
      setScans((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status: 'error', error: message, progress: 'Failed' } : s,
        ),
      );
      return id;
    }
  }, []);

  const runScan = useCallback(
    async (displayImages: string[], ocrSources?: Array<string | Blob>) => {
      if (!displayImages.length) return null;
      const id = uid('scan');
      const createdAt = new Date().toISOString();
      const draft: PhotoScan = {
        id,
        images: displayImages,
        status: 'scanning',
        clips: [],
        progress: 'Starting…',
        createdAt,
      };
      setScans((prev) => [draft, ...prev]);
      return runOcr(id, ocrSources?.length ? ocrSources : displayImages);
    },
    [runOcr],
  );

  const rescan = useCallback(
    async (id: string) => {
      const scan = scans.find((s) => s.id === id);
      if (!scan?.images.length) return null;
      setScans((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: 'scanning', clips: [], error: undefined, progress: 'Starting…' }
            : s,
        ),
      );
      return runOcr(id, scan.images);
    },
    [runOcr, scans],
  );

  return {
    scans,
    error,
    runScan,
    rescan,
    removeScan,
    removeClip,
    setClipKind,
    updateClip,
  };
}
