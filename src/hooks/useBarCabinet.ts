import { useCallback, useEffect, useState } from 'react';
import type { BarBottle, BarMedia, BottleConfidence } from '../types';
import { uid } from '../lib/pantryUtils';

const MEDIA_KEY = 'dinner-bar-media-v1';
const BOTTLES_KEY = 'dinner-bar-bottles-v1';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function useBarCabinet() {
  const [media, setMedia] = useState<BarMedia[]>(() => loadJson(MEDIA_KEY, []));
  const [bottles, setBottles] = useState<BarBottle[]>(() => loadJson(BOTTLES_KEY, []));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(MEDIA_KEY, JSON.stringify(media));
      setError(null);
    } catch {
      setError('Storage is full — remove some cabinet photos/videos and try again.');
    }
  }, [media]);

  useEffect(() => {
    try {
      localStorage.setItem(BOTTLES_KEY, JSON.stringify(bottles));
    } catch {
      setError('Storage is full — remove some bottles or media.');
    }
  }, [bottles]);

  const addMedia = useCallback((items: Omit<BarMedia, 'id' | 'createdAt'>[]) => {
    const stamped = items.map((item) => ({
      ...item,
      id: uid('bar-media'),
      createdAt: new Date().toISOString(),
    }));
    setMedia((prev) => [...stamped, ...prev]);
    return stamped;
  }, []);

  const removeMedia = useCallback((id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const addBottle = useCallback(
    (input: {
      name: string;
      category?: string;
      notes?: string;
      source?: 'vision' | 'manual';
      confidence?: BottleConfidence;
    }) => {
      const name = input.name.trim();
      if (!name) return null;
      const bottle: BarBottle = {
        id: uid('bottle'),
        name,
        category: (input.category ?? '').trim(),
        notes: (input.notes ?? '').trim(),
        source: input.source ?? 'manual',
        confidence: input.confidence ?? 'clear',
        createdAt: new Date().toISOString(),
      };
      setBottles((prev) => {
        const exists = prev.some(
          (b) => b.name.toLowerCase() === bottle.name.toLowerCase(),
        );
        if (exists) return prev;
        return [bottle, ...prev];
      });
      return bottle;
    },
    [],
  );

  const addBottles = useCallback(
    (
      list: {
        name: string;
        category?: string;
        notes?: string;
        source?: 'vision' | 'manual';
        confidence?: BottleConfidence;
      }[],
    ) => {
      list.forEach((item) =>
        addBottle({
          ...item,
          source: item.source ?? 'vision',
        }),
      );
    },
    [addBottle],
  );

  const removeBottle = useCallback((id: string) => {
    setBottles((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const updateBottle = useCallback((id: string, patch: Partial<BarBottle>) => {
    setBottles((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const clearAll = useCallback(() => {
    setMedia([]);
    setBottles([]);
  }, []);

  return {
    media,
    bottles,
    error,
    addMedia,
    removeMedia,
    addBottle,
    addBottles,
    removeBottle,
    updateBottle,
    clearAll,
  };
}
