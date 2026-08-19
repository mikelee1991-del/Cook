import { useCallback, useEffect, useState } from 'react';
import type { SortedClip } from '../lib/recipeSort';
import { PHOTO_SCANS_KEY } from '../lib/appStorage';
import { scanImagesForRecipesDetailed } from '../lib/scanImages';
import { uid } from '../lib/pantryUtils';

export type ScanStatus = 'scanning' | 'done' | 'error';

export interface PhotoScan {
  id: string;
  images: string[];
  status: ScanStatus;
  clips: SortedClip[];
  progress: string;
  error?: string;
  warnings?: string[];
  createdAt: string;
}

/** Original Files/Blobs for rescan in this session (too large for localStorage). */
const originalSources = new Map<string, Array<string | Blob>>();

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
    originalSources.delete(id);
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
    originalSources.set(id, sources);
    try {
      const { clips, warnings } = await scanImagesForRecipesDetailed(sources, (progress) => {
        setScans((prev) => prev.map((s) => (s.id === id ? { ...s, progress } : s)));
      });
      const warningText = warnings.map((w) => `Page ${w.page}: ${w.message}`);
      setScans((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: 'done',
                clips,
                error: clips.length ? undefined : warningText[0],
                warnings: warningText,
                progress: 'Done',
              }
            : s,
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
                progress: originalSources.has(id)
                  ? 'Starting…'
                  : 'Starting from stored preview…',
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
      const sources = originalSources.get(id) ?? scan.images;
      setScans((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: 'scanning', clips: [], error: undefined, warnings: [], progress: 'Starting…' }
            : s,
        ),
      );
      return runOcr(id, sources);
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
