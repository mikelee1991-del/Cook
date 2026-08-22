import type {
  CookFilters,
  CookingApparatus,
  EaseLevel,
  FlavorProfile,
  MealType,
  Recipe,
} from '../types';

export const TIME_SLIDER_MIN = 15;
export const TIME_SLIDER_MAX = 90;
export const TIME_SLIDER_STEP = 5;

export const EASE_RANK: Record<EaseLevel, number> = {
  easy: 0,
  moderate: 1,
  involved: 2,
};

export const EASE_SLIDER_MAX = 2;

export const EASE_SLIDER_LABELS = ['Easy', 'Moderate', 'Involved'] as const;

export const AVAILABLE_APPARATUS: { id: CookingApparatus; label: string }[] = [
  { id: 'stove', label: 'Stove' },
  { id: 'oven', label: 'Oven' },
  { id: 'sheet-pan', label: 'Sheet pan' },
  { id: 'grill', label: 'Grill' },
  { id: 'no-cook', label: 'No cook' },
];

export const FLAVOR_OPTIONS: { value: FlavorProfile; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'heavy', label: 'Heavy' },
  { value: 'fresh', label: 'Fresh' },
  { value: 'comfort', label: 'Comfort' },
  { value: 'spicy', label: 'Spicy' },
  { value: 'bright', label: 'Bright' },
  { value: 'savory', label: 'Savory' },
  { value: 'herbaceous', label: 'Herbaceous' },
];

export const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'side', label: 'Side' },
];

export function formatMealTypes(mealTypes: MealType[]): string {
  if (!mealTypes.length) return 'Meal';
  const labels = new Map(MEAL_TYPE_OPTIONS.map((o) => [o.value, o.label]));
  return mealTypes.map((type) => labels.get(type) ?? type).join(' · ');
}

export function formatTimeFilter(maxMinutes: number): string {
  if (maxMinutes >= TIME_SLIDER_MAX) return 'Any time';
  return `Up to ${maxMinutes} min`;
}

export function formatEaseFilter(maxEase: number): string {
  if (maxEase >= EASE_SLIDER_MAX) return 'Any effort';
  return `Up to ${EASE_SLIDER_LABELS[maxEase]}`;
}

export function recipePassesCookFilters(
  recipe: Recipe,
  hasAllIngredients: boolean,
  filters: CookFilters,
  timing?: { minutes: number; easeRank: number },
): boolean {
  if (!filters.sources.includes(recipe.source)) return false;
  if (filters.requireAllIngredients && !hasAllIngredients) return false;
  const minutes = timing?.minutes ?? recipe.minutes;
  const easeRank = timing?.easeRank ?? EASE_RANK[recipe.ease];
  if (filters.maxMinutes < TIME_SLIDER_MAX && minutes > filters.maxMinutes) {
    return false;
  }
  if (easeRank > filters.maxEase) return false;
  if (!recipe.apparatus.some((item) => filters.apparatus.includes(item))) return false;
  if (filters.flavors.length > 0 && !recipe.flavors.some((f) => filters.flavors.includes(f))) {
    return false;
  }
  if (
    filters.mealTypes.length > 0 &&
    !recipe.mealTypes.some((mealType) => filters.mealTypes.includes(mealType))
  ) {
    return false;
  }
  return true;
}
