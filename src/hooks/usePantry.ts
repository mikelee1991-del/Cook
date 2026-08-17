import { useCallback, useEffect, useState } from 'react';
import { createInitialPantry } from '../data/pantrySeed';
import type { CatalogItem, PantryItem, Store, PantrySection } from '../types';
import { todayISO, uid } from '../lib/pantryUtils';

const STORAGE_KEY = 'supper-pantry-v2';

function loadPantry(): PantryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialPantry();
    const parsed = JSON.parse(raw) as PantryItem[];
    if (!Array.isArray(parsed)) return createInitialPantry();
    return parsed;
  } catch {
    return createInitialPantry();
  }
}

export function usePantry() {
  const [items, setItems] = useState<PantryItem[]>(() => loadPantry());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback(
    (input: {
      name: string;
      store: Store;
      section: PantrySection;
      quantity: string;
      expiresAt: string;
      fromCatalog?: CatalogItem;
    }) => {
      const item: PantryItem = {
        id: uid('pantry'),
        name: input.name.trim(),
        store: input.store,
        section: input.section,
        quantity: input.quantity.trim() || '1',
        purchasedAt: todayISO(),
        expiresAt: input.expiresAt,
        fromPurchaseHistory: false,
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
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const resetPantry = useCallback(() => {
    const fresh = createInitialPantry();
    setItems(fresh);
  }, []);

  return { items, addItem, removeItem, updateItem, resetPantry };
}
