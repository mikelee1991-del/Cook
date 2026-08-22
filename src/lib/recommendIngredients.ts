import { recipes } from '../data/recipes';
import type { PantryItem } from '../types';
import {
  flavorReasonForIngredient,
  ingredientFlavorBoost,
  recipeFlavorFit,
} from './flavorExpertise';
import { matchRecipeToPantry, normalizeName } from './pantryUtils';

export interface AutoRecommendation {
  name: string;
  reason: string;
  score: number;
}

/**
 * Suggest ingredients to pick up — ranked by flavor fit with your pantry
 * and the dishes they unlock. Pantry-only (no Cook flavor-chip filter).
 */
export function recommendFromStock(
  pantry: PantryItem[],
  dismissedNames: string[] = [],
  limit = 24,
): AutoRecommendation[] {
  const dismissed = new Set(dismissedNames.map(normalizeName));
  const scores = new Map<
    string,
    { name: string; score: number; recipes: string[]; flavorReasons: string[] }
  >();

  for (const recipe of recipes) {
    const match = matchRecipeToPantry(recipe, pantry);
    // At least one pantry hit, and not a whole grocery run (max 7 extras).
    if (match.have.length < 1 || match.missing.length === 0 || match.missing.length > 7) {
      continue;
    }

    const flavorFit = recipeFlavorFit(recipe, pantry);
    const recipeWeight = (match.coverage * 0.55 + flavorFit * 0.85) * (8 - match.missing.length);

    for (const missing of match.missing) {
      const key = normalizeName(missing);
      if (!key || dismissed.has(key) || key.length < 2) continue;

      const boost = ingredientFlavorBoost(missing, recipe, pantry);
      const weight = recipeWeight * boost;
      const flavorWhy = flavorReasonForIngredient(missing, recipe);
      const existing = scores.get(key);
      if (existing) {
        existing.score += weight;
        if (!existing.recipes.includes(recipe.title)) existing.recipes.push(recipe.title);
        if (flavorWhy && !existing.flavorReasons.includes(flavorWhy)) {
          existing.flavorReasons.push(flavorWhy);
        }
      } else {
        scores.set(key, {
          name: missing,
          score: weight,
          recipes: [recipe.title],
          flavorReasons: flavorWhy ? [flavorWhy] : [],
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
      reason: row.flavorReasons[0]
        ? row.flavorReasons[0]
        : row.recipes.length === 1
          ? `Unlocks “${row.recipes[0]}”`
          : `Helps ${row.recipes.length} recipes (e.g. “${row.recipes[0]}”)`,
    }));
}
