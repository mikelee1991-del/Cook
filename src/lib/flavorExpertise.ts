import type { FlavorProfile, PantryItem, Recipe } from '../types';
import { getExpirationStatus, normalizeName, pantryHasIngredient } from './pantryUtils';

/**
 * Flavor expertise for Dinner: rank recipes and grocery picks by taste
 * architecture — not by string-matching ingredient names alone.
 */

export type FlavorNote =
  | 'acid'
  | 'aromatic'
  | 'bitter'
  | 'dairy'
  | 'fat'
  | 'fresh-veg'
  | 'heat'
  | 'herb'
  | 'rich'
  | 'smoke'
  | 'sweet'
  | 'umami';

/** How strongly each dish profile wants each note. */
const PROFILE_NOTE_WEIGHT: Record<FlavorProfile, Partial<Record<FlavorNote, number>>> = {
  light: { acid: 1.2, herb: 1, 'fresh-veg': 1.3, fat: 0.4 },
  heavy: { rich: 1.4, umami: 1.2, fat: 1.1, smoke: 0.8 },
  fresh: { 'fresh-veg': 1.4, herb: 1.2, acid: 1, aromatic: 0.7 },
  comfort: { rich: 1.3, dairy: 1, umami: 1.1, sweet: 0.6 },
  spicy: { heat: 1.6, aromatic: 1, acid: 0.7, umami: 0.5 },
  bright: { acid: 1.5, herb: 0.9, aromatic: 0.8, 'fresh-veg': 0.7 },
  savory: { umami: 1.5, aromatic: 1, rich: 0.9, smoke: 0.6 },
  herbaceous: { herb: 1.6, aromatic: 1.1, 'fresh-veg': 0.9, acid: 0.5 },
};

/** Profiles that reinforce each other. */
const PROFILE_AFFINITY: Record<FlavorProfile, FlavorProfile[]> = {
  light: ['fresh', 'bright', 'herbaceous'],
  heavy: ['comfort', 'savory'],
  fresh: ['light', 'bright', 'herbaceous'],
  comfort: ['heavy', 'savory'],
  spicy: ['savory', 'bright'],
  bright: ['fresh', 'light', 'spicy'],
  savory: ['comfort', 'heavy', 'spicy', 'herbaceous'],
  herbaceous: ['fresh', 'light', 'savory', 'bright'],
};

interface IngredientFlavorRule {
  match: RegExp;
  notes: FlavorNote[];
  profiles?: FlavorProfile[];
}

/** First match wins — cook’s judgment, not a thesaurus. */
const INGREDIENT_FLAVORS: IngredientFlavorRule[] = [
  { match: /\b(lemon|lime|vinegar|caper|pickle|sumac|yuzu)\b/, notes: ['acid'], profiles: ['bright', 'light'] },
  {
    match: /\b(chili|chilli|jalape|cayenne|harissa|gochujang|pepper flake|hot sauce|sriracha|red pepper)\b/,
    notes: ['heat', 'aromatic'],
    profiles: ['spicy'],
  },
  {
    match: /\b(basil|cilantro|parsley|mint|dill|tarragon|chive)\b/,
    notes: ['herb', 'fresh-veg'],
    profiles: ['herbaceous', 'fresh'],
  },
  {
    match: /\b(oregano|thyme|rosemary|sage|bay|marjoram)\b/,
    notes: ['herb', 'aromatic'],
    profiles: ['herbaceous', 'savory'],
  },
  {
    match: /\b(cumin|coriander|paprika|turmeric|curry|garam|fennel seed|mustard seed)\b/,
    notes: ['aromatic'],
    profiles: ['savory', 'spicy'],
  },
  {
    match: /\b(garlic|ginger|shallot|scallion|green onion|leek)\b/,
    notes: ['aromatic', 'umami'],
    profiles: ['savory'],
  },
  {
    match: /\b(onion|yellow onion|red onion)\b/,
    notes: ['aromatic', 'sweet'],
    profiles: ['savory', 'comfort'],
  },
  {
    match: /\b(parmesan|pecorino|miso|anchovy|soy sauce|fish sauce|worcestershire|tomato paste|mushroom)\b/,
    notes: ['umami'],
    profiles: ['savory', 'heavy'],
  },
  {
    match: /\b(cheddar|mozzarella|feta|goat cheese|cream cheese)\b/,
    notes: ['dairy', 'rich'],
    profiles: ['comfort'],
  },
  {
    match: /\b(butter|cream|heavy cream|coconut milk|ghee|lard)\b/,
    notes: ['fat', 'rich', 'dairy'],
    profiles: ['comfort', 'heavy'],
  },
  { match: /\b(olive oil|sesame oil|avocado oil)\b/, notes: ['fat'], profiles: ['savory', 'fresh'] },
  {
    match: /\b(yogurt|greek yogurt|sour cream|buttermilk)\b/,
    notes: ['dairy', 'acid'],
    profiles: ['light', 'bright'],
  },
  {
    match: /\b(bacon|prosciutto|chorizo|sausage|pancetta|smoked)\b/,
    notes: ['smoke', 'umami', 'rich'],
    profiles: ['savory', 'heavy'],
  },
  {
    match: /\b(chicken|turkey|pork|beef|lamb|ground)\b/,
    notes: ['umami', 'rich'],
    profiles: ['savory', 'comfort'],
  },
  {
    match: /\b(salmon|tuna|cod|shrimp|fish|fillet)\b/,
    notes: ['umami'],
    profiles: ['light', 'savory'],
  },
  {
    match: /\b(chickpea|black bean|lentil|tofu|tempeh|white bean)\b/,
    notes: ['umami'],
    profiles: ['savory', 'comfort'],
  },
  {
    match: /\b(arugula|spinach|kale|lettuce|salad green)\b/,
    notes: ['bitter', 'fresh-veg'],
    profiles: ['fresh', 'light'],
  },
  {
    match: /\b(broccoli|asparagus|green bean|pea|zucchini|cucumber)\b/,
    notes: ['fresh-veg'],
    profiles: ['fresh', 'light'],
  },
  {
    match: /\b(tomato|cherry tomato|bell pepper|carrot|celery)\b/,
    notes: ['fresh-veg', 'sweet'],
    profiles: ['fresh', 'savory'],
  },
  {
    match: /\b(potato|sweet potato|rice|pasta|bread|tortilla|noodle|penne)\b/,
    notes: ['rich', 'sweet'],
    profiles: ['comfort'],
  },
  { match: /\b(honey|maple|brown sugar|sugar|date)\b/, notes: ['sweet'], profiles: ['comfort'] },
  { match: /\b(egg)\b/, notes: ['rich', 'fat'], profiles: ['comfort', 'savory'] },
];

function ruleFor(name: string): IngredientFlavorRule | undefined {
  const n = normalizeName(name);
  return INGREDIENT_FLAVORS.find((rule) => rule.match.test(n));
}

export function flavorNotesForIngredient(name: string): FlavorNote[] {
  return [...(ruleFor(name)?.notes ?? [])];
}

export function flavorProfilesForIngredient(name: string): FlavorProfile[] {
  return [...(ruleFor(name)?.profiles ?? [])];
}

function noteVectorFromNames(names: string[]): Map<FlavorNote, number> {
  const vec = new Map<FlavorNote, number>();
  for (const name of names) {
    for (const note of flavorNotesForIngredient(name)) {
      vec.set(note, (vec.get(note) ?? 0) + 1);
    }
  }
  return vec;
}

function profileDemand(profiles: FlavorProfile[]): Map<FlavorNote, number> {
  const demand = new Map<FlavorNote, number>();
  for (const profile of profiles) {
    const weights = PROFILE_NOTE_WEIGHT[profile] ?? {};
    for (const [note, weight] of Object.entries(weights) as [FlavorNote, number][]) {
      demand.set(note, (demand.get(note) ?? 0) + weight);
    }
  }
  return demand;
}

function cosineLike(a: Map<FlavorNote, number>, b: Map<FlavorNote, number>): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const av = a.get(key) ?? 0;
    const bv = b.get(key) ?? 0;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function profileOverlap(a: FlavorProfile[], b: FlavorProfile[]): number {
  if (!a.length || !b.length) return 0;
  let score = 0;
  for (const left of a) {
    if (b.includes(left)) score += 1;
    for (const right of b) {
      if (PROFILE_AFFINITY[left]?.includes(right)) score += 0.35;
    }
  }
  return score / Math.max(a.length, b.length);
}

/** Pantry names that still count for cooking (not expired). */
export function usablePantryNames(pantry: PantryItem[]): string[] {
  return pantry
    .filter((item) => getExpirationStatus(item.expiresAt) !== 'expired')
    .map((item) => item.name);
}

/** Recipe ingredients (required + optional) that match pantry stock. */
export function recipeIngredientsOnHand(recipe: Recipe, pantry: PantryItem[]): string[] {
  const onHand: string[] = [];
  for (const ingredient of recipe.ingredients) {
    if (pantryHasIngredient(pantry, ingredient)) onHand.push(ingredient);
  }
  for (const ingredient of recipe.optionalIngredients ?? []) {
    if (pantryHasIngredient(pantry, ingredient)) onHand.push(ingredient);
  }
  return onHand;
}

/** Flavor signature of what you already have on hand. */
export function pantryFlavorSignature(pantry: PantryItem[]): {
  notes: Map<FlavorNote, number>;
  profiles: FlavorProfile[];
} {
  const names = usablePantryNames(pantry);
  const notes = noteVectorFromNames(names);
  const profileScores = new Map<FlavorProfile, number>();
  for (const name of names) {
    for (const profile of flavorProfilesForIngredient(name)) {
      profileScores.set(profile, (profileScores.get(profile) ?? 0) + 1);
    }
  }
  const profiles = [...profileScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([profile]) => profile);
  return { notes, profiles };
}

/**
 * How well a recipe’s intended flavors are covered by pantry items that
 * actually match its ingredients. Optional filter chips steer the mood.
 */
export function recipeFlavorFit(
  recipe: Recipe,
  pantry: PantryItem[],
  preferredFlavors: FlavorProfile[] = [],
): number {
  const recipeDemand = profileDemand(recipe.flavors);
  const onHand = recipeIngredientsOnHand(recipe, pantry);
  const haveNotes = noteVectorFromNames(onHand);
  const noteFit = cosineLike(haveNotes, recipeDemand);

  const filterFit = preferredFlavors.length
    ? profileOverlap(recipe.flavors, preferredFlavors)
    : 0;

  const pantryTieBreak = profileOverlap(recipe.flavors, pantryFlavorSignature(pantry).profiles) * 0.05;

  return noteFit * 0.72 + filterFit * 0.28 + pantryTieBreak;
}

/**
 * How much a missing ingredient advances the recipe’s flavor goals given
 * what is already on hand for that dish.
 */
export function ingredientFlavorBoost(
  ingredient: string,
  recipe: Recipe,
  pantry: PantryItem[],
  preferredFlavors: FlavorProfile[] = [],
): number {
  const notes = flavorNotesForIngredient(ingredient);
  const profiles = flavorProfilesForIngredient(ingredient);
  if (!notes.length && !profiles.length) return 0.15;

  const targetProfiles =
    preferredFlavors.length > 0
      ? [...new Set([...recipe.flavors.filter((f) => preferredFlavors.includes(f)), ...preferredFlavors])]
      : recipe.flavors;
  const demand = profileDemand(targetProfiles.length ? targetProfiles : recipe.flavors);
  const ingredientNotes = new Map<FlavorNote, number>();
  for (const note of notes) ingredientNotes.set(note, 1);

  const onHandNotes = noteVectorFromNames(recipeIngredientsOnHand(recipe, pantry));
  let gapFill = 0;
  for (const [note, want] of demand) {
    const have = onHandNotes.get(note) ?? 0;
    const brings = ingredientNotes.get(note) ?? 0;
    if (want > 0 && brings > 0 && have < want) {
      gapFill += (want - have) * brings;
    }
  }

  const profileHit = profileOverlap(profiles, recipe.flavors);
  const filterHit = preferredFlavors.length ? profileOverlap(profiles, preferredFlavors) : 0;

  return Math.min(2.5, 0.35 + gapFill * 0.55 + profileHit * 0.8 + filterHit * 0.5);
}

/** Short cook-facing hint for why a recipe ranks where it does. */
export function recipeFlavorFitHint(
  recipe: Recipe,
  flavorFit: number,
  preferredFlavors: FlavorProfile[] = [],
): string {
  const active =
    preferredFlavors.length > 0
      ? recipe.flavors.filter((f) => preferredFlavors.includes(f))
      : recipe.flavors;
  const label = active.slice(0, 2).join(' · ') || recipe.flavors.slice(0, 2).join(' · ');
  if (flavorFit >= 0.55) return `Strong ${label} taste match`;
  if (flavorFit >= 0.3) return `${label} flavor fit`;
  return `Builds toward ${label || 'this dish'}`;
}

/** Short cook-facing reason fragment for grocery row copy. */
export function flavorReasonForIngredient(ingredient: string, recipe: Recipe): string | null {
  const notes = flavorNotesForIngredient(ingredient);
  const profiles = flavorProfilesForIngredient(ingredient);
  const shared = profiles.filter((p) => recipe.flavors.includes(p));
  if (shared.length) return `brings ${shared[0]} flavor for “${recipe.title}”`;
  if (notes.includes('acid') && recipe.flavors.some((f) => f === 'bright' || f === 'light')) {
    return `adds brightness to “${recipe.title}”`;
  }
  if (notes.includes('heat') && recipe.flavors.includes('spicy')) {
    return `builds heat for “${recipe.title}”`;
  }
  if (notes.includes('herb') && recipe.flavors.includes('herbaceous')) {
    return `finishes “${recipe.title}” with herbs`;
  }
  if (notes.includes('umami') && recipe.flavors.includes('savory')) {
    return `deepens savoriness in “${recipe.title}”`;
  }
  return null;
}
