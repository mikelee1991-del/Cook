/**
 * Cook filter behavior: sliders and no Instant Pot / air fryer.
 * Run with: npx tsx scripts/test-cook.ts
 */
import assert from 'node:assert/strict';
import { recipes } from '../src/data/recipes.ts';
import {
  AVAILABLE_APPARATUS,
  EASE_RANK,
  EASE_SLIDER_MAX,
  MEAL_TYPE_OPTIONS,
  TIME_SLIDER_MAX,
  formatEaseFilter,
  formatMealTypes,
  formatTimeFilter,
  recipePassesCookFilters,
} from '../src/lib/cookFilters.ts';
import type { CookFilters, PantryItem, Recipe } from '../src/types.ts';
import { applyFrozenTiming, frozenMethodFor } from '../src/lib/frozenHandling.ts';

const allIds = AVAILABLE_APPARATUS.map((a) => a.id);

function filters(patch: Partial<CookFilters> = {}): CookFilters {
  return {
    requireAllIngredients: false,
    maxMinutes: TIME_SLIDER_MAX,
    maxEase: EASE_SLIDER_MAX,
    apparatus: allIds,
    flavors: [],
    mealTypes: MEAL_TYPE_OPTIONS.map((item) => item.value),
    sources: ['nyt', 'nyt-saved', 'original', 'other'],
    ...patch,
  };
}

function recipe(id: string): Recipe {
  const hit = recipes.find((r) => r.id === id);
  assert.ok(hit, id);
  return hit;
}

console.log('→ no instant pot or air fryer');
assert.equal(
  recipes.some((r) => r.apparatus.some((a) => a === 'instant-pot' || a === 'air-fryer')),
  false,
);
assert.equal(
  AVAILABLE_APPARATUS.some((a) => a.id === 'instant-pot' || a.id === 'air-fryer'),
  false,
);
assert.ok(recipes.some((r) => r.id === 'orig-broiled-salmon'));
assert.ok(recipes.some((r) => r.id === 'orig-stovetop-turkey-rice'));

console.log('→ time slider is a ceiling, max means any');
const grilled = recipe('orig-grilled-chicken');
assert.equal(recipePassesCookFilters(grilled, false, filters({ maxMinutes: 30 })), false);
assert.equal(recipePassesCookFilters(grilled, false, filters({ maxMinutes: 45 })), true);
assert.equal(recipePassesCookFilters(grilled, false, filters({ maxMinutes: TIME_SLIDER_MAX })), true);
assert.equal(formatTimeFilter(30), 'Up to 30 min');
assert.equal(formatTimeFilter(TIME_SLIDER_MAX), 'Any time');

console.log('→ effort slider is a ceiling, not a single bucket');
const salmon = recipe('orig-broiled-salmon');
const turkey = recipe('orig-stovetop-turkey-rice');
assert.equal(EASE_RANK.easy, 0);
assert.equal(recipePassesCookFilters(salmon, false, filters({ maxEase: 0 })), true);
assert.equal(recipePassesCookFilters(turkey, false, filters({ maxEase: 0 })), false);
assert.equal(recipePassesCookFilters(turkey, false, filters({ maxEase: 1 })), true);
assert.equal(formatEaseFilter(0), 'Up to Easy');
assert.equal(formatEaseFilter(EASE_SLIDER_MAX), 'Any effort');

console.log('→ apparatus is owned gear, not a single appliance');
assert.equal(recipePassesCookFilters(grilled, false, filters({ apparatus: ['stove'] })), false);
assert.equal(recipePassesCookFilters(grilled, false, filters({ apparatus: ['grill'] })), true);

console.log('→ meal type chips filter breakfast, lunch, dinner, and sides');
const spinachEggs = recipe('nyt-spinach-eggs');
const panzanella = recipe('nyt-saved-garlic-bread-salad');
assert.ok(spinachEggs.mealTypes.includes('breakfast'));
assert.ok(panzanella.mealTypes.includes('side'));
assert.equal(
  recipePassesCookFilters(spinachEggs, false, filters({ mealTypes: ['breakfast'] })),
  true,
);
assert.equal(
  recipePassesCookFilters(panzanella, false, filters({ mealTypes: ['breakfast'] })),
  false,
);
assert.equal(
  recipePassesCookFilters(panzanella, false, filters({ mealTypes: ['side'] })),
  true,
);
assert.equal(formatMealTypes(['breakfast', 'lunch']), 'Breakfast · Lunch');

console.log('→ frozen stock adds cook-from-frozen or rapid-thaw, not overnight');

function item(name: string, frozen: boolean): PantryItem {
  return {
    id: name,
    name,
    store: 'Other',
    section: frozen ? 'frozen' : 'refrigerated',
    quantity: '1',
    purchasedAt: '2026-01-01',
    expiresAt: '2099-01-01',
    frozen,
  };
}

assert.equal(frozenMethodFor('Salmon fillet', salmon), 'cook-from-frozen');
assert.equal(frozenMethodFor('Chicken thighs', grilled), 'rapid-thaw');
assert.equal(frozenMethodFor('Frozen peas', turkey), 'cook-from-frozen');

const salmonFrozen = applyFrozenTiming(salmon, [item('Salmon fillet', true)]);
assert.equal(salmonFrozen.minutes, 32);
assert.equal(salmonFrozen.ease, 'easy');
assert.match(salmonFrozen.notes.join(' '), /from frozen/);

const salmonFresh = applyFrozenTiming(salmon, [item('Salmon fillet', false)]);
assert.equal(salmonFresh.minutes, 20);

const grillFrozen = applyFrozenTiming(grilled, [item('Chicken thighs', true)]);
assert.equal(grillFrozen.minutes, 55);
assert.equal(grillFrozen.ease, 'involved');
assert.match(grillFrozen.notes.join(' '), /Rapid-thaw/);

assert.equal(
  recipePassesCookFilters(salmon, false, filters({ maxMinutes: 25 }), {
    minutes: salmonFrozen.minutes,
    easeRank: salmonFrozen.easeRank,
  }),
  false,
);

const peasNamed = applyFrozenTiming(turkey, [item('Frozen peas', true)]);
assert.equal(peasNamed.minutes, turkey.minutes, 'recipe already calls for frozen peas');

console.log('test-cook: ok');
