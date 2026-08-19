/**
 * OCR helpers for recipe-page scans.
 * Run with: npx tsx scripts/test-ocr.ts
 */
import assert from 'node:assert/strict';
import {
  cleanupOcrText,
  findColumnGutter,
  ocrTextLooksStrong,
  ocrTextLooksWeak,
  pageDensityFromInk,
  pageLooksDark,
  scoreOcrResult,
} from '../src/lib/ocrText.ts';
import { isHeicLike, isLikelyImageFile, isLikelyVideoFile } from '../src/lib/imageFiles.ts';
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

console.log('→ handwritten / sparse pages are not split down the middle');
const sparseCenter = Array.from({ length: 200 }, (_, x) => {
  if (x < 35) return 18;
  if (x > 165) return 16;
  return 1;
});
assert.equal(findColumnGutter(sparseCenter), null);

console.log('→ layout density');
assert.equal(pageDensityFromInk(0.02, 0.1), 'sparse');
assert.equal(pageDensityFromInk(0.09, 0.4), 'print');
assert.equal(pageLooksDark(70), true);
assert.equal(pageLooksDark(180), false);

console.log('→ cleanup');
assert.match(cleanupOcrText('2 tosp butter\n1  /  2 cup sugar'), /2 tbsp butter/);
assert.match(cleanupOcrText('2 tosp butter\n1  /  2 cup sugar'), /1\/2 cup/);
assert.equal(cleanupOcrText('sea-\nsalt'), 'seasalt');
assert.match(cleanupOcrText('lngredients\nl/2 cup flour\nlnstructions'), /Ingredients/);
assert.match(cleanupOcrText('lngredients\nl/2 cup flour'), /1\/2 cup flour/);
assert.match(cleanupOcrText('l tbsp olive oil'), /1 tbsp olive oil/);
assert.match(cleanupOcrText('prebeat oven'), /Preheat oven/);

console.log('→ scoring prefers recipe-like text over junk');
const recipeScore = scoreOcrResult(
  'Ingredients\n2 cups flour\n1 tsp salt\nDirections\nMix and bake at 350 for 30 minutes until golden.',
  72,
);
const junkScore = scoreOcrResult('§§ ~~ || ## asdf qwer', 80);
assert.ok(recipeScore > junkScore + 20, `${recipeScore} vs ${junkScore}`);
assert.equal(ocrTextLooksWeak('asdf', 90), true);
assert.equal(
  ocrTextLooksWeak(
    'Ingredients\n2 cups flour\n1 tsp salt\nDirections\nMix and bake at 350 for 30 minutes until golden.',
    72,
  ),
  false,
);
assert.equal(
  ocrTextLooksStrong(
    'Ingredients\n2 cups flour\n1 tsp salt\nDirections\nMix and bake at 350 for 30 minutes until golden.',
    72,
  ),
  true,
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

console.log('→ handwritten-style OCR still classifies as a recipe');
const hand = sortPageText(
  `Tomato soup

lngredients
2 c tomatoes
l tbsp olive oil
1 tsp salt

Directlons
Simmer 20 minutes. Serve warm.`,
  0,
);
assert.ok(hand.some((c) => c.kind === 'recipe'), JSON.stringify(hand));

console.log('→ file sniffing accepts blank MIME + extension');
assert.equal(isLikelyImageFile({ name: 'card.HEIC', type: '' }), true);
assert.equal(isLikelyImageFile({ name: 'notes.JPG', type: '' }), true);
assert.equal(isLikelyImageFile({ name: 'clip.mp4', type: '' }), false);
assert.equal(isLikelyVideoFile({ name: 'shelf.MOV', type: '' }), true);
assert.equal(isHeicLike({ name: 'IMG_1234.heic', type: '' }), true);
assert.equal(isLikelyImageFile({ name: 'photo', type: 'image/jpeg' }), true);

console.log('test-ocr: ok');
