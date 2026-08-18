/**
 * OCR helpers for recipe-page scans.
 * Run with: npx tsx scripts/test-ocr.ts
 */
import assert from 'node:assert/strict';
import { cleanupOcrText, findColumnGutter, ocrTextLooksWeak } from '../src/lib/ocrText.ts';
import { sortPageText } from '../src/lib/recipeSort.ts';

console.log('→ column gutter');
const single = Array.from({ length: 200 }, () => 40);
assert.equal(findColumnGutter(single), null);

const twoCol = Array.from({ length: 200 }, (_, x) => {
  if (x >= 90 && x <= 110) return 2;
  if (x < 80 || x > 120) return 50;
  return 12;
});
const gutter = findColumnGutter(twoCol);
assert.ok(gutter != null && gutter > 85 && gutter < 115, `gutter ${gutter}`);

console.log('→ cleanup');
assert.match(cleanupOcrText('2 tosp butter\n1  /  2 cup sugar'), /2 tbsp butter/);
assert.match(cleanupOcrText('2 tosp butter\n1  /  2 cup sugar'), /1\/2 cup/);
assert.equal(cleanupOcrText('sea-\nsalt'), 'seasalt');

console.log('→ weak text');
assert.equal(ocrTextLooksWeak('asdf', 90), true);
assert.equal(
  ocrTextLooksWeak(
    'Ingredients\n2 cups flour\n1 tsp salt\nDirections\nMix and bake at 350 for 30 minutes until golden.',
    72,
  ),
  false,
);

console.log('→ split ingredient lines still count as a recipe');
const clips = sortPageText(
  `Lemon Garlic Chicken

4 chicken thighs

2 tbsp olive oil

1 tsp kosher salt

1. Preheat oven to 425 F.

3. Roast 35 minutes until crisp.`,
  0,
);
assert.ok(clips.some((c) => c.kind === 'recipe'), JSON.stringify(clips.map((c) => c.kind)));
assert.match(clips.find((c) => c.kind === 'recipe')?.body || '', /chicken thighs/);

console.log('test-ocr: ok');
