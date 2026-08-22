import { recipes } from './recipes';
import type { Recipe } from '../types';

/** Stand-in for a personal NYT Cooking saves export until a real sync exists. */
export const nytSavedRecipes: Recipe[] = recipes.filter((recipe) => recipe.source === 'nyt-saved');
