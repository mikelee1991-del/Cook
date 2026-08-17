import { recipes } from '../data/recipes';
import type { PantryItem } from '../types';
import { matchRecipeToPantry, normalizeName } from './pantryUtils';

export interface AutoRecommendation {
  name: string;
  reason: string;
  score: number;
}

/**
 * Suggest ingredients to pick up based on near-complete recipes from current stock.
 * Never invents pantry items — only missing pieces for recipes you almost have.
 */
export function recommendFromStock(
  pantry: PantryItem[],
  dismissedNames: string[] = [],
  limit = 12,
): AutoRecommendation[] {
  const dismissed = new Set(dismissedNames.map(normalizeName));
  const scores = new Map<string, { name: string; score: number; recipes: string[] }>();

  for (const recipe of recipes) {
    const match = matchRecipeToPantry(recipe, pantry);
    if (match.coverage < 0.45 || match.missing.length === 0 || match.missing.length > 4) {
      continue;
    }
    // Prefer recipes that need few extras
    const weight = match.coverage * (5 - match.missing.length);
    for (const missing of match.missing) {
      const key = normalizeName(missing);
      if (!key || dismissed.has(key)) continue;
      if (normalizeName(missing).length < 2) continue;
      const existing = scores.get(key);
      if (existing) {
        existing.score += weight;
        if (!existing.recipes.includes(recipe.title)) {
          existing.recipes.push(recipe.title);
        }
      } else {
        scores.set(key, {
          name: missing,
          score: weight,
          recipes: [recipe.title],
        });
      }
    }
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((row) => ({
      name: row.name,
      score: row.score,
      reason:
        row.recipes.length === 1
          ? `Unlocks “${row.recipes[0]}”`
          : `Helps ${row.recipes.length} recipes (e.g. “${row.recipes[0]}”)`,
    }));
}
