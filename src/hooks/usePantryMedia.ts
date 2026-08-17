import { useCallback, useEffect, useState } from 'react';
import type { PantryMedia } from '../types';
import { uid } from '../lib/pantryUtils';

const MEDIA_KEY = 'dinner-pantry-media-v1';

function loadMedia(): PantryMedia[] {
  try {
    const raw = localStorage.getItem(MEDIA_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PantryMedia[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function usePantryMedia() {
  const [media, setMedia] = useState<PantryMedia[]>(() => loadMedia());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(MEDIA_KEY, JSON.stringify(media));
      setError(null);
    } catch {
      setError('Storage is full — remove some pantry photos/videos and try again.');
    }
  }, [media]);

  const addMedia = useCallback((items: Omit<PantryMedia, 'id' | 'createdAt'>[]) => {
    const stamped = items.map((item) => ({
      ...item,
      id: uid('pantry-media'),
      createdAt: new Date().toISOString(),
    }));
    setMedia((prev) => [...stamped, ...prev]);
    return stamped;
  }, []);

  const removeMedia = useCallback((id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearMedia = useCallback(() => setMedia([]), []);

  return { media, error, addMedia, removeMedia, clearMedia };
}
