import { useMemo, useState } from 'react';
import type { CookFilters, PantryItem, Recipe, RecipeSource } from '../types';
import { recipes } from '../data/recipes';
import { applyFrozenTiming } from '../lib/frozenHandling';
import { matchRecipeToPantry } from '../lib/pantryUtils';
import {
  AVAILABLE_APPARATUS,
  EASE_SLIDER_MAX,
  TIME_SLIDER_MAX,
  recipePassesCookFilters,
} from '../lib/cookFilters';

const defaultFilters: CookFilters = {
  requireAllIngredients: false,
  maxMinutes: TIME_SLIDER_MAX,
  maxEase: EASE_SLIDER_MAX,
  apparatus: AVAILABLE_APPARATUS.map((item) => item.id),
  flavors: [],
  sources: ['nyt', 'nyt-saved', 'original', 'other'],
};

export function useCookSuggestions(pantry: PantryItem[]) {
  const [filters, setFilters] = useState<CookFilters>(defaultFilters);

  const suggestions = useMemo(() => {
    return recipes
      .map((recipe) => {
        const match = matchRecipeToPantry(recipe, pantry);
        const timing = applyFrozenTiming(recipe, pantry);
        return { recipe, match, timing };
      })
      .filter(({ recipe, match, timing }) =>
        recipePassesCookFilters(recipe, match.hasAll, filters, {
          minutes: timing.minutes,
          easeRank: timing.easeRank,
        }),
      )
      .sort((a, b) => {
        if (b.match.coverage !== a.match.coverage) return b.match.coverage - a.match.coverage;
        return a.timing.minutes - b.timing.minutes;
      });
  }, [pantry, filters]);

  return { filters, setFilters, suggestions, allRecipes: recipes as Recipe[] };
}

export const SOURCE_OPTIONS: { label: string; value: RecipeSource }[] = [
  { label: 'NYT Cooking', value: 'nyt' },
  { label: 'Your NYT saves', value: 'nyt-saved' },
  { label: 'Dinner kitchen', value: 'original' },
  { label: 'Other', value: 'other' },
];
