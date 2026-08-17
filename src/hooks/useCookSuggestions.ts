import { useMemo, useState } from 'react';
import type {
  CookingApparatus,
  CookFilters,
  EaseLevel,
  FlavorProfile,
  PantryItem,
  Recipe,
  RecipeSource,
} from '../types';
import { recipes } from '../data/recipes';
import { matchRecipeToPantry } from '../lib/pantryUtils';

const defaultFilters: CookFilters = {
  requireAllIngredients: false,
  maxMinutes: null,
  ease: 'any',
  apparatus: 'any',
  flavor: 'any',
  sources: ['nyt', 'nyt-saved', 'original', 'other'],
};

export function useCookSuggestions(pantry: PantryItem[]) {
  const [filters, setFilters] = useState<CookFilters>(defaultFilters);

  const suggestions = useMemo(() => {
    const scored = recipes
      .filter((r) => filters.sources.includes(r.source))
      .map((recipe) => {
        const match = matchRecipeToPantry(recipe, pantry);
        return { recipe, match };
      })
      .filter(({ recipe, match }) => {
        if (filters.requireAllIngredients && !match.hasAll) return false;
        if (filters.maxMinutes != null && recipe.minutes > filters.maxMinutes) return false;
        if (filters.ease !== 'any' && recipe.ease !== filters.ease) return false;
        if (filters.apparatus !== 'any' && !recipe.apparatus.includes(filters.apparatus)) {
          return false;
        }
        if (filters.flavor !== 'any' && !recipe.flavors.includes(filters.flavor)) return false;
        return true;
      })
      .sort((a, b) => {
        if (b.match.coverage !== a.match.coverage) return b.match.coverage - a.match.coverage;
        return a.recipe.minutes - b.recipe.minutes;
      });

    return scored;
  }, [pantry, filters]);

  return { filters, setFilters, suggestions, allRecipes: recipes as Recipe[] };
}

export const TIME_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Any time', value: null },
  { label: '≤ 20 min', value: 20 },
  { label: '≤ 30 min', value: 30 },
  { label: '≤ 45 min', value: 45 },
  { label: '≤ 60 min', value: 60 },
];

export const EASE_OPTIONS: { label: string; value: EaseLevel | 'any' }[] = [
  { label: 'Any ease', value: 'any' },
  { label: 'Easy', value: 'easy' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'Involved', value: 'involved' },
];

export const APPARATUS_OPTIONS: { label: string; value: CookingApparatus | 'any' }[] = [
  { label: 'Any apparatus', value: 'any' },
  { label: 'Oven', value: 'oven' },
  { label: 'Stove', value: 'stove' },
  { label: 'Grill', value: 'grill' },
  { label: 'Sheet pan', value: 'sheet-pan' },
  { label: 'Air fryer', value: 'air-fryer' },
  { label: 'Instant Pot', value: 'instant-pot' },
  { label: 'No cook', value: 'no-cook' },
];

export const FLAVOR_OPTIONS: { label: string; value: FlavorProfile | 'any' }[] = [
  { label: 'Any flavor', value: 'any' },
  { label: 'Light', value: 'light' },
  { label: 'Heavy', value: 'heavy' },
  { label: 'Fresh', value: 'fresh' },
  { label: 'Comfort', value: 'comfort' },
  { label: 'Spicy', value: 'spicy' },
  { label: 'Bright', value: 'bright' },
  { label: 'Savory', value: 'savory' },
  { label: 'Herbaceous', value: 'herbaceous' },
];

export const SOURCE_OPTIONS: { label: string; value: RecipeSource }[] = [
  { label: 'NYT Cooking', value: 'nyt' },
  { label: 'Your NYT saves', value: 'nyt-saved' },
  { label: 'Dinner kitchen', value: 'original' },
  { label: 'Other', value: 'other' },
];
