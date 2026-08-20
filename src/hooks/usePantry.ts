import { useCallback, useEffect, useState } from 'react';
import { createInitialPantry } from '../data/pantrySeed';
import type { CatalogItem, PantryItem, Store, PantrySection } from '../types';
import { todayISO, uid } from '../lib/pantryUtils';

import { PANTRY_KEY } from '../lib/appStorage';

function loadPantry(): PantryItem[] {
  try {
    const raw = localStorage.getItem(PANTRY_KEY);
    if (!raw) return createInitialPantry();
    const parsed = JSON.parse(raw) as PantryItem[];
    if (!Array.isArray(parsed)) return createInitialPantry();
    return parsed.map((item) => ({
      ...item,
      frozen: item.frozen ?? item.section === 'frozen',
    }));
  } catch {
    return createInitialPantry();
  }
}

export function usePantry() {
  const [items, setItems] = useState<PantryItem[]>(() => loadPantry());

  useEffect(() => {
    localStorage.setItem(PANTRY_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback(
    (input: {
      name: string;
      store: Store;
      section: PantrySection;
      quantity: string;
      expiresAt: string;
      frozen?: boolean;
      fromCatalog?: CatalogItem;
      fromMediaScan?: boolean;
    }) => {
      const frozen = input.frozen ?? input.section === 'frozen';
      const item: PantryItem = {
        id: uid('pantry'),
        name: input.name.trim(),
        store: input.store,
        section: frozen ? 'frozen' : input.section,
        quantity: input.quantity.trim() || '1',
        purchasedAt: todayISO(),
        expiresAt: input.expiresAt,
        fromPurchaseHistory: false,
        fromMediaScan: Boolean(input.fromMediaScan),
        frozen,
        updatedAt: Date.now(),
      };
      setItems((prev) => [item, ...prev]);
      return item;
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<PantryItem>) => {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
    );
  }, []);

  const replaceAll = useCallback((next: PantryItem[]) => {
    setItems(next);
  }, []);

  const resetPantry = useCallback(() => {
    const fresh = createInitialPantry();
    setItems(fresh);
  }, []);

  return { items, addItem, removeItem, updateItem, resetPantry, replaceAll };
}
