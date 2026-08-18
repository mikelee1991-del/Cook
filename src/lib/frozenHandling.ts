import type { EaseLevel, PantryItem, Recipe } from '../types';
import { EASE_RANK } from './cookFilters';
import {
  getExpirationStatus,
  ingredientNamesMatch,
  normalizeName,
} from './pantryUtils';

export type FrozenMethod = 'cook-from-frozen' | 'rapid-thaw';

export interface FrozenAdjustment {
  method: FrozenMethod;
  ingredient: string;
  pantryName: string;
  extraMinutes: number;
  extraEase: number;
  note: string;
}

export interface FrozenCookTiming {
  minutes: number;
  ease: EaseLevel;
  easeRank: number;
  extraMinutes: number;
  notes: string[];
  adjustments: FrozenAdjustment[];
}

const EASE_BY_RANK: EaseLevel[] = ['easy', 'moderate', 'involved'];

/** Frozen flag, with Frozen-section items treated as frozen unless explicitly unmarked. */
export function isFrozenItem(item: PantryItem): boolean {
  if (item.frozen === false) return false;
  if (item.frozen === true) return true;
  return item.section === 'frozen';
}

function usableItems(pantry: PantryItem[]): PantryItem[] {
  return pantry.filter((p) => getExpirationStatus(p.expiresAt) !== 'expired');
}

/** True when the only matching stock for this ingredient is frozen. */
export function ingredientOnlyFrozen(pantry: PantryItem[], ingredient: string): boolean {
  const matches = usableItems(pantry).filter((p) => ingredientNamesMatch(p.name, ingredient));
  if (!matches.length) return false;
  return matches.every(isFrozenItem);
}

function familyOf(ingredient: string): 'veg' | 'protein' | 'ground' | 'bread' | 'other' {
  const n = normalizeName(ingredient);
  if (
    /\b(pea|spinach|broccoli|corn|carrot|pepper|onion|berry|berries|green bean|edamame|stir fry mix)\b/.test(
      n,
    )
  ) {
    return 'veg';
  }
  if (/\b(bread|tortilla|bun|roll|sourdough)\b/.test(n)) return 'bread';
  if (/\bground\b/.test(n)) return 'ground';
  if (
    /\b(chicken|turkey|salmon|fish|shrimp|thigh|breast|fillet|steak|pork|beef|tofu)\b/.test(n)
  ) {
    return 'protein';
  }
  return 'other';
}

/**
 * Weeknight plan: cook veg and most proteins from frozen; rapid-thaw when the method
 * needs a thawed surface (grill, no-cook, yogurt/dairy-ish extras).
 */
export function frozenMethodFor(ingredient: string, recipe: Recipe): FrozenMethod {
  const family = familyOf(ingredient);
  if (family === 'veg') return 'cook-from-frozen';
  if (family === 'ground') return 'cook-from-frozen';
  if (family === 'protein') {
    if (recipe.apparatus.includes('grill') || recipe.apparatus.includes('no-cook')) {
      return 'rapid-thaw';
    }
    return 'cook-from-frozen';
  }
  if (family === 'bread') {
    if (recipe.apparatus.includes('stove') || recipe.apparatus.includes('oven')) {
      return 'cook-from-frozen';
    }
    return 'rapid-thaw';
  }
  return 'rapid-thaw';
}

function extraFor(method: FrozenMethod, family: ReturnType<typeof familyOf>): FrozenAdjustment['extraMinutes'] {
  if (method === 'cook-from-frozen') {
    if (family === 'veg') return 5;
    if (family === 'ground') return 8;
    if (family === 'protein') return 12;
    if (family === 'bread') return 4;
    return 8;
  }
  // rapid-thaw: cold water / microwave defrost, not overnight
  if (family === 'protein' || family === 'ground') return 15;
  if (family === 'bread') return 8;
  return 10;
}

export function frozenAdjustments(recipe: Recipe, pantry: PantryItem[]): FrozenAdjustment[] {
  const out: FrozenAdjustment[] = [];
  for (const ingredient of recipe.ingredients) {
    if (/\bfrozen\b/i.test(ingredient)) continue;
    if (!ingredientOnlyFrozen(pantry, ingredient)) continue;
    const match = usableItems(pantry).find((p) => ingredientNamesMatch(p.name, ingredient));
    const method = frozenMethodFor(ingredient, recipe);
    const family = familyOf(ingredient);
    const extraMinutes = extraFor(method, family);
    const extraEase = method === 'rapid-thaw' ? 1 : 0;
    out.push({
      method,
      ingredient,
      pantryName: match?.name ?? ingredient,
      extraMinutes,
      extraEase,
      note:
        method === 'cook-from-frozen'
          ? `Cook ${ingredient.toLowerCase()} from frozen (+${extraMinutes} min)`
          : `Rapid-thaw ${ingredient.toLowerCase()} (+${extraMinutes} min)`,
    });
  }
  return out;
}

export function applyFrozenTiming(recipe: Recipe, pantry: PantryItem[]): FrozenCookTiming {
  const adjustments = frozenAdjustments(recipe, pantry);
  const extraMinutes = adjustments.reduce((sum, row) => sum + row.extraMinutes, 0);
  const extraEase = adjustments.reduce((max, row) => Math.max(max, row.extraEase), 0);
  const easeRank = Math.min(2, EASE_RANK[recipe.ease] + extraEase);
  return {
    minutes: recipe.minutes + extraMinutes,
    ease: EASE_BY_RANK[easeRank],
    easeRank,
    extraMinutes,
    notes: adjustments.map((row) => row.note),
    adjustments,
  };
}
