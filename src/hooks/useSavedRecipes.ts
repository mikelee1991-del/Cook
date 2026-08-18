import { useCallback, useEffect, useState } from 'react';
import type { SavedRecipe } from '../types';
import { SAVES_KEY } from '../lib/appStorage';
import { uid } from '../lib/pantryUtils';

function loadSaves(): SavedRecipe[] {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedRecipe[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useSavedRecipes() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>(() => loadSaves());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SAVES_KEY, JSON.stringify(recipes));
      setError(null);
    } catch {
      setError(
        'Storage is full — remove some photo recipes or save fewer/smaller images.',
      );
    }
  }, [recipes]);

  const addPhotoRecipe = useCallback(
    (input: { title: string; notes: string; images: string[] }) => {
      if (!input.images.length) return null;
      const recipe: SavedRecipe = {
        id: uid('save'),
        title: input.title.trim() || 'Untitled recipe photos',
        notes: input.notes.trim(),
        kind: 'photos',
        images: input.images,
        createdAt: new Date().toISOString(),
      };
      setRecipes((prev) => [recipe, ...prev]);
      return recipe;
    },
    [],
  );

  const addLinkRecipe = useCallback((input: { title: string; url: string; notes: string }) => {
    const url = input.url.trim();
    if (!url) return null;
    let normalized = url;
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = `https://${normalized}`;
    }
    const recipe: SavedRecipe = {
      id: uid('save'),
      title: input.title.trim() || hostnameTitle(normalized),
      notes: input.notes.trim(),
      kind: 'link',
      url: normalized,
      images: [],
      createdAt: new Date().toISOString(),
    };
    setRecipes((prev) => [recipe, ...prev]);
    return recipe;
  }, []);

  const removeRecipe = useCallback((id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const addImagesToRecipe = useCallback((id: string, images: string[]) => {
    if (!images.length) return;
    setRecipes((prev) =>
      prev.map((r) =>
        r.id === id && r.kind === 'photos'
          ? { ...r, images: [...r.images, ...images] }
          : r,
      ),
    );
  }, []);

  return {
    recipes,
    error,
    addPhotoRecipe,
    addLinkRecipe,
    removeRecipe,
    addImagesToRecipe,
  };
}

function hostnameTitle(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Favorite link';
  }
}
