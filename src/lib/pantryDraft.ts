import { groceryCatalog } from '../data/pantrySeed';
import { isDryPantryStaple } from './frozenHandling';
import type { PantrySection, Store } from '../types';
import { ingredientNamesMatch, normalizeName } from './pantryUtils';

/** Defaults for adding a recommended ingredient into the pantry. */
export function pantryDraftFromName(name: string): {
  name: string;
  store: Store;
  section: PantrySection;
  quantity: string;
  expiresAt: string;
  frozen: boolean;
} {
  const trimmed = name.trim();
  const hit =
    groceryCatalog.find((c) => normalizeName(c.name) === normalizeName(trimmed)) ??
    groceryCatalog.find((c) => ingredientNamesMatch(c.name, trimmed));
  const days = hit?.defaultDaysToExpire ?? 14;
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const section = hit?.section ?? (isDryPantryStaple(trimmed) ? 'dry' : 'fresh');
  return {
    name: hit?.name ?? trimmed,
    store: 'Other',
    section,
    quantity: hit?.quantity || '1',
    expiresAt: d.toISOString().slice(0, 10),
    frozen: section === 'frozen',
  };
}
