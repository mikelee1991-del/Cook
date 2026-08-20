/**
 * Vision JSON parsing, catalog matching, and structured recipe clips.
 * Run with: npx tsx scripts/test-vision.ts
 */
import assert from 'node:assert/strict';
import { parseModelJson } from '../src/lib/visionJson.ts';
import {
  bestCatalogMatch,
  catalogMatchScore,
  resolveIdentifiedItem,
  resolveIdentifiedItems,
} from '../src/lib/visionPantry.ts';
import { clipsFromVisionPage } from '../src/lib/visionRecipes.ts';
import { formatStructuredRecipe } from '../src/lib/recipeFormat.ts';

console.log('→ parse JSON from fenced model output');
const parsed = parseModelJson<{ items: { name: string }[] }>(
  'Here you go:\n```json\n{"items":[{"name":"Eggs"}]}\n```\n',
);
assert.equal(parsed.items[0].name, 'Eggs');
assert.equal(parseModelJson<{ ok: boolean }>('{"ok":true}').ok, true);

console.log('→ catalog match uses packaging-style aliases');
assert.equal(bestCatalogMatch('chickpeas', ['garbanzo beans'])?.name, 'Canned chickpeas');
assert.equal(bestCatalogMatch('Yellow onions')?.name, 'Yellow onion');
assert.equal(bestCatalogMatch('AP flour'), null);
assert.ok(catalogMatchScore('chicken thighs', 'Chicken thighs') >= 90);
assert.ok(catalogMatchScore('garlic powder', 'Garlic') < 62, 'powder is not fresh garlic');

console.log('→ identified items resolve to pantry names');
const peas = resolveIdentifiedItem({
  name: 'Birds Eye peas',
  aliases: ['frozen peas'],
  catalogName: 'Frozen peas',
  frozen: true,
  quantity: '1 bag',
  cues: 'green bag, frost, peas artwork',
  confidence: 0.92,
});
assert.ok(peas);
assert.equal(peas.name, 'Frozen peas');
assert.equal(peas.frozen, true);
assert.equal(peas.section, 'frozen');

const flour = resolveIdentifiedItem({
  name: 'All-purpose flour',
  aliases: ['AP flour'],
  quantity: '5 lb',
  cues: 'white paper sack, wheat logo',
  confidence: 0.88,
});
assert.ok(flour);
assert.equal(flour.name, 'All-purpose flour');
assert.equal(flour.section, 'dry');

const skipped = resolveIdentifiedItems([
  { name: 'Mystery blob', confidence: 0.1 },
  { name: 'Eggs', confidence: 0.9 },
  { name: 'eggs', confidence: 0.8 },
]);
assert.equal(skipped.length, 1);
assert.equal(skipped[0].name, 'Eggs');

console.log('→ vision recipes become cookable clips');
const structured = formatStructuredRecipe({
  title: 'Lemon Garlic Chicken',
  ingredients: ['4 chicken thighs', '2 lemons', '4 cloves garlic'],
  directions: ['Preheat oven to 425.', 'Roast 35 minutes.'],
});
assert.match(structured.body, /Ingredients/);
assert.match(structured.body, /Directions/);
assert.doesNotMatch(structured.body, /lngredients/);

const clips = clipsFromVisionPage(
  {
    recipes: [
      {
        title: 'Salsa',
        ingredients: ['4 tomatoes', '1 onion'],
        directions: ['Chop and mix.'],
      },
    ],
    other: [{ title: 'Shopping', text: 'Need more cilantro' }],
  },
  0,
);
assert.equal(clips.filter((c) => c.kind === 'recipe').length, 1);
assert.equal(clips[0].title, 'Salsa');
assert.match(clips[0].body, /4 tomatoes/);
assert.ok(clips.some((c) => c.kind === 'other' && /cilantro/.test(c.body)));

console.log('test-vision: ok');
