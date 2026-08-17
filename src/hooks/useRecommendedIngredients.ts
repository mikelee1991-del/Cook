import { useCallback, useEffect, useMemo, useState } from 'react';
import { recommendFromStock } from '../lib/recommendIngredients';
import { normalizeName, pantryHasIngredient, uid } from '../lib/pantryUtils';
import type { PantryItem, RecommendedIngredient } from '../types';

const MANUAL_KEY = 'dinner-recommended-manual-v1';
const DISMISSED_KEY = 'dinner-recommended-dismissed-v1';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function hasName(items: RecommendedIngredient[], name: string, exceptId?: string): boolean {
  const key = normalizeName(name);
  return items.some((p) => p.id !== exceptId && normalizeName(p.name) === key);
}

export function useRecommendedIngredients(pantry: PantryItem[]) {
  const [manual, setManual] = useState<RecommendedIngredient[]>(() =>
    loadJson(MANUAL_KEY, []),
  );
  const [dismissed, setDismissed] = useState<string[]>(() => loadJson(DISMISSED_KEY, []));

  useEffect(() => {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(manual));
  }, [manual]);

  useEffect(() => {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  }, [dismissed]);

  const auto = useMemo(() => {
    const manualNames = new Set(manual.map((m) => normalizeName(m.name)));
    return recommendFromStock(pantry, dismissed)
      .filter((r) => !manualNames.has(normalizeName(r.name)))
      .map(
        (r): RecommendedIngredient => ({
          id: `auto-${normalizeName(r.name).replace(/\s+/g, '-')}`,
          name: r.name,
          note: '',
          reason: r.reason,
          source: 'auto',
          createdAt: new Date().toISOString(),
        }),
      );
  }, [pantry, dismissed, manual]);

  const items = useMemo(
    () =>
      [...manual, ...auto].map((item) => ({
        ...item,
        inPantry: pantryHasIngredient(pantry, item.name),
      })),
    [manual, auto, pantry],
  );

  const addManual = useCallback((name: string, note = '') => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    let added: RecommendedIngredient | null = null;
    setManual((prev) => {
      if (hasName(prev, trimmed)) return prev;
      added = {
        id: uid('rec'),
        name: trimmed,
        note: note.trim(),
        reason: '',
        source: 'manual',
        createdAt: new Date().toISOString(),
      };
      return [added, ...prev];
    });
    setDismissed((prev) => prev.filter((n) => n !== normalizeName(trimmed)));
    return added;
  }, []);

  const updateItem = useCallback(
    (item: RecommendedIngredient, patch: { name?: string; note?: string }) => {
      const nextName = (patch.name ?? item.name).trim() || item.name;
      const nextNote = patch.note ?? item.note;

      if (item.source === 'manual') {
        setManual((prev) => {
          if (hasName(prev, nextName, item.id)) return prev;
          return prev.map((p) =>
            p.id === item.id ? { ...p, name: nextName, note: nextNote } : p,
          );
        });
        return;
      }

      // Editing an auto row promotes it to a manual entry and dismisses the auto version
      const promoted: RecommendedIngredient = {
        id: uid('rec'),
        name: nextName,
        note: nextNote,
        reason: item.reason,
        source: 'manual',
        createdAt: new Date().toISOString(),
      };
      setDismissed((prev) => {
        const key = normalizeName(item.name);
        return prev.includes(key) ? prev : [...prev, key];
      });
      setManual((prev) => {
        if (hasName(prev, nextName)) return prev;
        return [promoted, ...prev];
      });
    },
    [],
  );

  const removeItem = useCallback((item: RecommendedIngredient) => {
    if (item.source === 'manual') {
      setManual((prev) => prev.filter((p) => p.id !== item.id));
      return;
    }
    setDismissed((prev) => {
      const key = normalizeName(item.name);
      return prev.includes(key) ? prev : [...prev, key];
    });
  }, []);

  const clearDismissed = useCallback(() => setDismissed([]), []);

  return {
    items,
    addManual,
    updateItem,
    removeItem,
    clearDismissed,
    dismissedCount: dismissed.length,
  };
}
