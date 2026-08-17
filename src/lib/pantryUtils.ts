import type { ExpirationStatus, PantryItem, Recipe } from '../types';

export function todayISO(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(dateISO: string): number {
  const today = new Date(todayISO());
  const target = new Date(dateISO);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function getExpirationStatus(expiresAt: string): ExpirationStatus {
  const days = daysUntil(expiresAt);
  if (days < 0) return 'expired';
  if (days <= 2) return 'soon';
  return 'ok';
}

export function formatExpiryLabel(expiresAt: string): string {
  const days = daysUntil(expiresAt);
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/s\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Words that change the ingredient (garlic powder is not garlic). */
const FORM_WORDS = new Set(['powder', 'flake', 'extract', 'paste', 'granule']);

function tokens(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean);
}

function formWordsOf(normalized: string): Set<string> {
  return new Set(tokens(normalized).filter((t) => FORM_WORDS.has(t)));
}

function sameFormWords(a: string, b: string): boolean {
  const left = formWordsOf(a);
  const right = formWordsOf(b);
  if (left.size !== right.size) return false;
  for (const word of left) {
    if (!right.has(word)) return false;
  }
  return true;
}

/** True when pantry item name and recipe ingredient refer to the same thing. */
export function ingredientNamesMatch(pantryName: string, ingredient: string): boolean {
  const hay = normalizeName(pantryName);
  const needle = normalizeName(ingredient);
  if (!hay || !needle) return false;
  if (hay === needle) return true;
  if (!sameFormWords(hay, needle)) return false;
  return hay.includes(needle) || needle.includes(hay);
}

/** Fuzzy-ish pantry match: recipe ingredient vs pantry item names. */
export function pantryHasIngredient(pantry: PantryItem[], ingredient: string): boolean {
  const usable = pantry.filter((p) => getExpirationStatus(p.expiresAt) !== 'expired');
  return usable.some((p) => ingredientNamesMatch(p.name, ingredient));
}

export function matchRecipeToPantry(recipe: Recipe, pantry: PantryItem[]) {
  const have = recipe.ingredients.filter((i) => pantryHasIngredient(pantry, i));
  const missing = recipe.ingredients.filter((i) => !pantryHasIngredient(pantry, i));
  const optionalHave = (recipe.optionalIngredients ?? []).filter((i) =>
    pantryHasIngredient(pantry, i),
  );
  return {
    have,
    missing,
    optionalHave,
    coverage: have.length / Math.max(recipe.ingredients.length, 1),
    hasAll: missing.length === 0,
  };
}

export function uid(prefix = 'item'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}
