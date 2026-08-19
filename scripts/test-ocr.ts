/**
 * OCR helpers + human-readable recipe formatting.
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
import { formatReadableRecipe } from '../src/lib/recipeFormat.ts';
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

console.log('→ quantity lines without units still glue into one recipe');
const splitIng = sortPageText(
  `Sheet-Pan Lemon Chicken

Ingredients

4 chicken thighs

2 tbsp olive oil

garlic, and lemon.

Directions

1. Preheat oven to 425 F.

4. Roast 35 minutes until crisp.`,
  0,
);
const recipes = splitIng.filter((c) => c.kind === 'recipe');
assert.equal(recipes.length, 1, JSON.stringify(splitIng.map((c) => ({ k: c.kind, t: c.title }))));
assert.match(recipes[0].body, /chicken thighs/);
assert.match(recipes[0].body, /Roast 35/);

console.log('→ notebook rule lines are dropped');
assert.doesNotMatch(cleanupOcrText('Tomato soup\n—.—\nIngredients\n2 c tomatoes'), /—\.—/);

console.log('→ two recipes on one page stay separate');
const two = sortPageText(
  `Lemon Chicken
Ingredients
2 tbsp oil
Directions
Bake 20 minutes.

Pasta Salad
Ingredients
1 cup pasta
Directions
Toss and chill.`,
  0,
);
const twoRecipes = two.filter((c) => c.kind === 'recipe');
assert.ok(twoRecipes.length >= 2, JSON.stringify(two.map((c) => c.title)));
assert.ok(twoRecipes.some((c) => /Lemon Chicken/.test(c.title) || /Lemon Chicken/.test(c.body)));
assert.ok(twoRecipes.some((c) => /Pasta Salad/.test(c.title) || /Pasta Salad/.test(c.body)));

console.log('→ readable format: shredded OCR becomes Ingredients + Directions');
const shredded = formatReadableRecipe(
  `Sheet-Pan Lemon Chicken

Ingredients

4 chicken thighs

2 tbsp olive oil

1 tsp kosher salt

garlic, and lemon.

Directions

1. Preheat oven to 425 F.

2. Toss chicken with oil, salt,

garlic, and lemon.

4. Roast 35 minutes until crisp.`,
);
assert.equal(shredded.title, 'Sheet-Pan Lemon Chicken');
assert.match(shredded.body, /^Ingredients\n/m);
assert.match(shredded.body, /^Directions\n/m);
assert.match(shredded.body, /^- 4 chicken thighs$/m);
assert.match(shredded.body, /^- 2 tbsp olive oil$/m);
assert.match(shredded.body, /^1\. Preheat oven to 425 F\.$/m);
assert.match(shredded.body, /Toss chicken with oil, salt, garlic, and lemon/);
assert.match(shredded.body, /^2\. /m);
assert.doesNotMatch(shredded.body, /\n{3,}/);
assert.ok(!shredded.body.startsWith('Sheet-Pan'), shredded.body.slice(0, 40));

console.log('→ readable format: no headers still structures cooking verbs');
const noHeaders = formatReadableRecipe(
  `Garlic Butter Pasta
8 oz spaghetti
2 tbsp butter
3 cloves garlic
1. Boil pasta until al dente.
2. Melt butter and saute garlic.
3. Toss pasta and serve.`,
);
assert.equal(noHeaders.title, 'Garlic Butter Pasta');
assert.ok(noHeaders.ingredients.some((i) => /spaghetti/.test(i)));
assert.ok(noHeaders.directions.some((d) => /Boil pasta/.test(d)));
assert.match(noHeaders.body, /Ingredients/);
assert.match(noHeaders.body, /Directions/);

console.log('→ readable format: joins broken measure lines');
const broken = formatReadableRecipe(
  `Banana Bread
Ingredients
2 cups
flour
1 tsp baking soda
Directions
Mix wet and dry.
Bake 50 minutes.`,
);
assert.ok(
  broken.ingredients.some((i) => /2 cups flour/.test(i)),
  JSON.stringify(broken.ingredients),
);

console.log('→ readable format: OCR glyph soup still formats');
const glyphs = formatReadableRecipe(
  cleanupOcrText(`lngredients
l/2 cup sugar
l tbsp butter
Directlons
prebeat oven to 350.
Whisk and bake.`),
);
assert.match(glyphs.body, /Ingredients/);
assert.match(glyphs.body, /1\/2 cup sugar/);
assert.match(glyphs.body, /1 tbsp butter/);
assert.match(glyphs.body, /Directions/);
assert.match(glyphs.body, /Preheat oven/);

console.log('→ sortPageText emits readable recipe bodies');
const readableClip = sortPageText(
  `Sheet-Pan Lemon Chicken
Ingredients
4 chicken thighs
2 tbsp olive oil
Directions
1. Preheat oven to 425 F.
2. Roast 35 minutes until crisp.`,
  0,
).find((c) => c.kind === 'recipe');
assert.ok(readableClip);
assert.equal(readableClip.title, 'Sheet-Pan Lemon Chicken');
assert.match(readableClip.body, /^- 4 chicken thighs$/m);
assert.match(readableClip.body, /^1\. Preheat oven/m);
assert.doesNotMatch(readableClip.body, /^Sheet-Pan Lemon Chicken/m);

console.log('→ multi-recipe page keeps readable bodies separate');
const multi = sortPageText(
  `Lemon Chicken
Ingredients
2 tbsp oil
1 tsp salt
Directions
Bake 20 minutes.

Pasta Salad
Ingredients
1 cup pasta
1/2 cup olives
Directions
Toss and chill.`,
  0,
).filter((c) => c.kind === 'recipe');
assert.ok(multi.length >= 2, JSON.stringify(multi.map((c) => c.title)));
for (const recipe of multi) {
  assert.match(recipe.body, /Ingredients/);
  assert.match(recipe.body, /Directions/);
  assert.match(recipe.body, /^- /m);
  assert.match(recipe.body, /^\d+\. /m);
}

console.log('→ handwritten note formats without blank-line spam');
const note = formatReadableRecipe(
  `Tomato soup

2 c tomatoes

l tbsp olive oil

Simmer 20 minutes until soft.

Serve warm with bread.`,
);
assert.ok(note.ingredients.length >= 1, JSON.stringify(note));
assert.ok(note.directions.length >= 1, JSON.stringify(note));
assert.doesNotMatch(note.body, /\n{3,}/);

console.log('→ screenshot-style all-caps headers');
const caps = formatReadableRecipe(
  `WEEKNIGHT CHILI
INGREDIENTS
1 lb ground turkey
1 can tomatoes
DIRECTIONS
Brown turkey.
Simmer 25 minutes.`,
);
assert.match(caps.body, /Ingredients/);
assert.match(caps.body, /Directions/);
assert.match(caps.body, /- 1 lb ground turkey/);

console.log('→ handwritten card keeps separate ingredients and method steps');
const card = formatReadableRecipe(
  `HANDWRITTEN CARD
ingredients
2 chicken breasts
salt and pepper
olive oil
method
season chicken
sear both sides
bake 15 min`,
);
assert.equal(card.title, 'HANDWRITTEN CARD');
assert.ok(card.ingredients.some((i) => /chicken breasts/.test(i)), JSON.stringify(card.ingredients));
assert.ok(card.ingredients.some((i) => /salt and pepper/.test(i)), JSON.stringify(card.ingredients));
assert.ok(card.directions.some((d) => /season chicken/i.test(d)), JSON.stringify(card.directions));
assert.ok(card.directions.length >= 2, JSON.stringify(card.directions));

console.log('→ inline Ingredients/Directions on one jammed OCR line');
const jammed = formatReadableRecipe(
  `Two Col Dump
Ingredients 1 cup rice 2 cups water Directions Bring to a boil. Simmer 18 minutes.`,
);
assert.equal(jammed.title, 'Two Col Dump');
assert.ok(jammed.ingredients.some((i) => /rice/.test(i)), JSON.stringify(jammed.ingredients));
assert.ok(jammed.ingredients.some((i) => /water/.test(i)), JSON.stringify(jammed.ingredients));
assert.ok(jammed.directions.length >= 1, JSON.stringify(jammed.directions));

console.log('→ orphan title before Ingredients joins the recipe clip');
const orphan = sortPageText(
  `Classic Pancakes

Ingredients
1 1/2 cups flour
1 cup milk
Directions
Cook until golden.

Pasta Salad
Ingredients
1 cup pasta
Directions
Toss.`,
  0,
).filter((c) => c.kind === 'recipe');
assert.ok(orphan.some((c) => c.title === 'Classic Pancakes'), JSON.stringify(orphan.map((c) => c.title)));
assert.ok(orphan.some((c) => /Pasta Salad/.test(c.title)), JSON.stringify(orphan.map((c) => c.title)));

console.log('→ empty / junk input stays safe');
assert.equal(formatReadableRecipe('').body, '');
assert.ok(formatReadableRecipe('asdf').body.length >= 4);

console.log('test-ocr: ok');
