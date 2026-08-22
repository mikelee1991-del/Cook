/**
 * Behavioral checks for pantry matching and stock-based recommendations.
 * Run with: npx tsx scripts/test-recommend.ts
 */
import assert from 'node:assert/strict';
import { createBasicSpices } from '../src/data/pantrySeed.ts';
import { recipes } from '../src/data/recipes.ts';
import { pantryDraftFromName } from '../src/lib/pantryDraft.ts';
import { canBeFrozen, canToggleFrozen } from '../src/lib/frozenHandling.ts';
import {
  ingredientNamesMatch,
  matchRecipeToPantry,
  pantryHasIngredient,
} from '../src/lib/pantryUtils.ts';
import { recommendFromStock } from '../src/lib/recommendIngredients.ts';
import {
  flavorNotesForIngredient,
  flavorProfilesForIngredient,
  flavorReasonForIngredient,
  ingredientFlavorBoost,
  recipeFlavorFit,
} from '../src/lib/flavorExpertise.ts';
import type { PantryItem } from '../src/types.ts';

function spicePantry(): PantryItem[] {
  return createBasicSpices();
}

function withItems(names: string[]): PantryItem[] {
  const extra: PantryItem[] = names.map((name, i) => ({
    id: `test-${i}`,
    name,
    store: 'Other',
    section: 'fresh',
    quantity: '1',
    purchasedAt: '2026-01-01',
    expiresAt: '2099-01-01',
  }));
  return [...spicePantry(), ...extra];
}

console.log('→ ingredient matching');
assert.equal(ingredientNamesMatch('Garlic powder', 'Garlic'), false, 'powder is not fresh garlic');
assert.equal(ingredientNamesMatch('Onion powder', 'Yellow onion'), false, 'powder is not onion');
assert.equal(ingredientNamesMatch('Garlic powder', 'Garlic powder'), true);
assert.equal(ingredientNamesMatch('Chicken thighs', 'Chicken thigh'), true);
assert.equal(ingredientNamesMatch('Kosher salt', 'Kosher salt'), true);
assert.equal(ingredientNamesMatch('Olive oil', 'Sesame oil'), false);
assert.equal(ingredientNamesMatch('Red pepper flakes', 'Black pepper'), false);
assert.equal(pantryHasIngredient(spicePantry(), 'Garlic'), false);
assert.equal(pantryHasIngredient(spicePantry(), 'Garlic powder'), true);

console.log('→ default spices do not treat garlic as in stock');
const lemonChicken = recipes.find((r) => r.id === 'nyt-lemon-garlic-chicken');
assert.ok(lemonChicken);
const lemonMatch = matchRecipeToPantry(lemonChicken, spicePantry());
assert.ok(!lemonMatch.have.includes('Garlic'));
assert.ok(lemonMatch.missing.includes('Garlic'));

console.log('→ recommendations from spice stock');
const spiceRecs = recommendFromStock(spicePantry());
assert.ok(spiceRecs.length > 0, 'spice pantry should still suggest useful extras');
assert.ok(spiceRecs.length >= 16, `expected a fuller list, got ${spiceRecs.length}`);
const spiceNames = spiceRecs.map((r) => r.name);
assert.ok(spiceNames.includes('Olive oil'), `expected olive oil, got ${spiceNames.join(', ')}`);
assert.ok(spiceNames.includes('Garlic'), `expected fresh garlic, got ${spiceNames.join(', ')}`);
assert.ok(!spiceNames.includes('Garlic powder'));
assert.ok(
  spiceRecs.every((r) => !pantryHasIngredient(spicePantry(), r.name)),
  'never recommend what is already in stock',
);

console.log('→ dismissed names are excluded');
const dismissed = recommendFromStock(spicePantry(), ['olive oil', 'garlic']);
assert.ok(!dismissed.some((r) => r.name === 'Olive oil'));
assert.ok(!dismissed.some((r) => r.name === 'Garlic'));

console.log('→ adding stock removes that ingredient from suggestions');
const withOil = recommendFromStock(withItems(['Olive oil', 'Garlic', 'Lemons']));
assert.ok(!withOil.some((r) => r.name === 'Olive oil'));
assert.ok(!withOil.some((r) => r.name === 'Garlic'));
assert.ok(!withOil.some((r) => r.name === 'Lemons'));

console.log('→ pantry draft uses catalog defaults');
const draft = pantryDraftFromName('Lemons');
assert.equal(draft.name, 'Lemons');
assert.equal(draft.section, 'fresh');
assert.match(draft.expiresAt, /^\d{4}-\d{2}-\d{2}$/);

console.log('→ frozen toggle only for freezable sections');
assert.equal(canBeFrozen('fresh'), true);
assert.equal(canBeFrozen('refrigerated'), true);
assert.equal(canBeFrozen('frozen'), false);
assert.equal(canBeFrozen('dry'), false);
assert.equal(canBeFrozen('fresh', 'All-purpose flour'), false);
assert.equal(canBeFrozen('fresh', 'Chicken thighs'), true);
assert.equal(canBeFrozen('refrigerated', 'Flour tortillas'), true);

console.log('→ dry staples default to dry section');
const flourDraft = pantryDraftFromName('All-purpose flour');
assert.equal(flourDraft.section, 'dry');
assert.equal(pantryDraftFromName('Chicken thighs').section, 'refrigerated');

console.log('→ pantry rows skip freeze for staples');
assert.equal(canToggleFrozen({ name: 'Kosher salt', section: 'dry', isStaple: true }), false);
assert.equal(canToggleFrozen({ name: 'All-purpose flour', section: 'dry' }), false);
assert.equal(canToggleFrozen({ name: 'Chicken thighs', section: 'refrigerated' }), true);

console.log('→ flavor expertise ranks by taste, not name alone');
assert.ok(flavorNotesForIngredient('Lemons').includes('acid'));
assert.ok(flavorProfilesForIngredient('Lemons').includes('bright'));
assert.ok(flavorNotesForIngredient('Parmesan').includes('umami'));
assert.ok(flavorNotesForIngredient('Red pepper flakes').includes('heat'));

const brightPantry = withItems(['Chicken thighs', 'Olive oil', 'Garlic']);
const lemonBoost = ingredientFlavorBoost('Lemons', lemonChicken!, brightPantry, ['bright']);
const blandBoost = ingredientFlavorBoost('Pasta penne', lemonChicken!, brightPantry, ['bright']);
assert.ok(
  lemonBoost > blandBoost,
  `lemon should outrank pasta for bright lemon-garlic chicken (${lemonBoost} vs ${blandBoost})`,
);

const lemonWhy = flavorReasonForIngredient('Lemons', lemonChicken!);
assert.ok(lemonWhy && /bright|brightness/i.test(lemonWhy), lemonWhy);

const flavorRecs = recommendFromStock(brightPantry, [], 24, ['bright']);
assert.ok(flavorRecs.length > 0);
assert.ok(
  flavorRecs.some((r) => /lemon/i.test(r.name) || /bright|brightness/i.test(r.reason)),
  `expected a brightness-minded pick, got ${flavorRecs
    .slice(0, 5)
    .map((r) => `${r.name}: ${r.reason}`)
    .join(' | ')}`,
);

const fitBright = recipeFlavorFit(lemonChicken!, brightPantry, ['bright']);
const heavyDish = recipes.find((r) => r.flavors.includes('heavy'));
assert.ok(heavyDish);
const fitHeavyOnBrightFilter = recipeFlavorFit(heavyDish, brightPantry, ['bright']);
assert.ok(
  fitBright >= fitHeavyOnBrightFilter,
  `bright filter should favor lemon-garlic over ${heavyDish.title}`,
);

console.log('test-recommend: ok');
