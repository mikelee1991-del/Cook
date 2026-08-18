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
  TIME_SLIDER_MAX,
  formatEaseFilter,
  formatTimeFilter,
  recipePassesCookFilters,
} from '../src/lib/cookFilters.ts';
import type { CookFilters, Recipe } from '../src/types.ts';

const allIds = AVAILABLE_APPARATUS.map((a) => a.id);

function filters(patch: Partial<CookFilters> = {}): CookFilters {
  return {
    requireAllIngredients: false,
    maxMinutes: TIME_SLIDER_MAX,
    maxEase: EASE_SLIDER_MAX,
    apparatus: allIds,
    flavors: [],
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

console.log('test-cook: ok');
