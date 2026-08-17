export type Store =
  | "Ralph's"
  | 'Vons'
  | 'Whole Foods'
  | 'Trader Joe\'s'
  | 'Costco'
  | 'Other'
  | 'Staple';

export type PantrySection = 'fresh' | 'refrigerated' | 'frozen' | 'dry';

export type CookingApparatus =
  | 'oven'
  | 'stove'
  | 'grill'
  | 'instant-pot'
  | 'air-fryer'
  | 'no-cook'
  | 'sheet-pan';

export type EaseLevel = 'easy' | 'moderate' | 'involved';

export type FlavorProfile =
  | 'light'
  | 'heavy'
  | 'fresh'
  | 'comfort'
  | 'spicy'
  | 'bright'
  | 'savory'
  | 'herbaceous';

export type RecipeSource = 'nyt' | 'nyt-saved' | 'original' | 'other';

export interface PantryItem {
  id: string;
  name: string;
  store: Store;
  section: PantrySection;
  quantity: string;
  purchasedAt: string; // ISO date
  expiresAt: string; // ISO date
  fromPurchaseHistory?: boolean;
  isStaple?: boolean;
}

export interface CatalogItem {
  name: string;
  store: Store;
  section: PantrySection;
  defaultDaysToExpire: number;
  quantity?: string;
}

export interface Recipe {
  id: string;
  title: string;
  source: RecipeSource;
  sourceLabel: string;
  url?: string;
  description: string;
  ingredients: string[];
  optionalIngredients?: string[];
  minutes: number;
  ease: EaseLevel;
  apparatus: CookingApparatus[];
  flavors: FlavorProfile[];
  servings: number;
}

export interface CookFilters {
  requireAllIngredients: boolean;
  maxMinutes: number | null;
  ease: EaseLevel | 'any';
  apparatus: CookingApparatus | 'any';
  flavor: FlavorProfile | 'any';
  sources: RecipeSource[];
}

export type ExpirationStatus = 'ok' | 'soon' | 'expired';
