/**
 * Behavioral checks for pantry matching and stock-based recommendations.
 * Run with: npx tsx scripts/test-recommend.ts
 */
import assert from 'node:assert/strict';
import { createBasicSpices } from '../src/data/pantrySeed.ts';
import { recipes } from '../src/data/recipes.ts';
import { pantryDraftFromName } from '../src/lib/pantryDraft.ts';
import { canBeFrozen } from '../src/lib/frozenHandling.ts';
import {
  ingredientNamesMatch,
  matchRecipeToPantry,
  pantryHasIngredient,
} from '../src/lib/pantryUtils.ts';
import { recommendFromStock } from '../src/lib/recommendIngredients.ts';
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

console.log('test-recommend: ok');
