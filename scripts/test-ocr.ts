/**
 * OCR helpers + human-readable recipe formatting.
 * Run with: npx tsx scripts/test-ocr.ts
 */
import assert from 'node:assert/strict';
import {
  cleanupOcrText,
  dropLeadingOrphanCopy,
  findColumnGutter,
  ocrTextLooksStrong,
  ocrTextLooksWeak,
  pageDensityFromInk,
  pageLooksDark,
  scoreOcrResult,
  stripScanChrome,
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

console.log('→ example: rotated cider card (quantity then name, Preparation + Instructions)');
const cider = formatReadableRecipe(
  cleanupOcrText(`Spiced Apple Cider
Ingredients
12 SERVINGS
1 gallon
apple cider, preferably fresh (the darker the better)
1 tablespoon whole allspice
1 teaspoon freshly grated nutmeg
4 cloves whole cloves
3 cinnamon sticks
1 vanilla bean, split lengthwise
Brandy, Calvados (apple brandy), or bourbon (optional)
Preparation
Instructions
1. Combine cider, allspice, nutmeg, cloves, and cinnamon sticks in a large pot. Scrape in seeds from vanilla bean; add bean. Bring spiced cider just to a simmer over medium heat. Reduce heat to medium-low and cook just below a simmer until flavors meld, about 1 hour.
2. Strain cider through a sieve into another pot or heatproof punch bowl; discard solids in sieve. Add brandy to taste, if using. Ladle hot spiced cider into cups.`),
);
assert.match(cider.title, /Spiced Apple Cider/);
assert.ok(cider.ingredients.some((i) => /1 gallon apple cider/.test(i)), JSON.stringify(cider.ingredients));
assert.ok(cider.ingredients.some((i) => /optional/i.test(i)), JSON.stringify(cider.ingredients));
assert.ok(cider.directions.some((d) => /Combine cider/.test(d)), JSON.stringify(cider.directions));
assert.ok(cider.directions.some((d) => /Strain cider/.test(d)), JSON.stringify(cider.directions));
assert.match(cider.body, /12 SERVINGS|servings/i);

console.log('→ example: crab card with colored subhead and intro blurb');
const crab = sortPageText(
  `Red King Crab with Thai Chile Lime Dipping Sauce
Arctic Seafoods
While red king crab is delicious served simply with lemon and melted butter, Thai Chile Lime Dipping Sauce is a flavorful, healthy alternative.
DIPPING SAUCE
4 medium garlic cloves, minced
4 Tbsp fresh lime juice
1 tsp fish sauce
1 Tbsp light brown sugar
2 to 4 red Thai chiles, finely minced (or 1 tsp red pepper flakes)
2 Tbsp green onion, finely chopped
2 Tbsp cilantro, finely chopped
1 to 2 lb precooked red king crab legs
Prepare the dipping sauce: Combine sauce ingredients in a small bowl and stir until sugar is dissolved. Serve with red king crab.
Makes 2 servings.`,
  0,
).filter((c) => c.kind === 'recipe');
assert.equal(crab.length, 1, JSON.stringify(crab.map((c) => c.title)));
assert.match(crab[0].title, /Red King Crab/);
assert.match(crab[0].body, /lime juice/);
assert.match(crab[0].body, /king crab legs/);
assert.doesNotMatch(crab[0].title, /DIPPING SAUCE/);

console.log('→ example: handwritten two-column banana bread card');
const banana = formatReadableRecipe(
  stripScanChrome(`Recipe For
Banana Nut Bread
1 1/2 cups flour 3/4 cup oil
3/4 tsp. soda 3 tbs. buttermilk
1/4 tsp. salt 2-3 bananas (about 1 cup)
1 cup sugar 1/2 cup chopped nuts
2 eggs, lightly beaten
Preheat oven to 325° F. Grease and flour loaf pan. Sift together flour, soda + salt. Add sugar, eggs, oil + buttermilk; stir to blend. Fold in bananas + nuts. Pour into pan. Bake for about 1 hour.
© HALLMARK CARDS, INC.`),
);
assert.equal(banana.title, 'Banana Nut Bread');
assert.ok(banana.ingredients.some((i) => /flour/.test(i)), JSON.stringify(banana.ingredients));
assert.ok(banana.ingredients.some((i) => /oil/.test(i)), JSON.stringify(banana.ingredients));
assert.ok(banana.directions.some((d) => /Preheat oven/.test(d)), JSON.stringify(banana.directions));
assert.doesNotMatch(banana.body, /HALLMARK/i);

console.log('→ example: ingredients-only cursive card still counts as a recipe');
const mushrooms = sortPageText(
  `Bourbon Mushrooms
1/4 cup butter
1/4 cup olive oil
2 lbs. assorted mushrooms
3/4 tsp salt
1/4 tsp pepper
1/2 cup Bourbon or chicken broth
3 garlic cloves, minced
2 Tbs chopped parsley
1 Tbs fresh chopped thyme`,
  0,
).filter((c) => c.kind === 'recipe');
assert.ok(mushrooms.length >= 1, JSON.stringify(mushrooms));
assert.match(mushrooms[0].title, /Bourbon Mushrooms/);
assert.match(mushrooms[0].body, /butter/);
assert.match(mushrooms[0].body, /thyme/);

console.log('→ example: leftover previous recipe is dropped; salsa keeps its title');
const salsaPage = dropLeadingOrphanCopy(`Remove the beef from the marinade and cook 3-4 minutes, turn, then cook more or until rare. Allow the meat to rest for 5-10 minutes and then slice across the grain. Serve with remaining salsa.

Fresh tomato salsa
2 pounds vine ripened tomatoes
2 jalapeno chiles
1/2 medium red onion, very finely chopped then soaked in cold water
1/2 cup fresh cilantro sprigs, roughly chopped
1 clove garlic, minced to a paste
2 teaspoons fresh lime juice
Salt and pepper to taste
Extra virgin olive oil to taste
Quarter and seed tomatoes. Cut tomatoes into 1/4 inch dice. Wearing rubber gloves, seed and finely chop the jalapeno peppers. Combine onion, garlic, cilantro and lime juice with the tomatoes and stir.`);
assert.match(salsaPage, /^Fresh tomato salsa/m);
assert.doesNotMatch(salsaPage, /Remove the beef/);
const salsa = formatReadableRecipe(salsaPage);
assert.match(salsa.title, /Fresh tomato salsa/i);
assert.ok(salsa.ingredients.some((i) => /tomatoes/.test(i)));
assert.ok(salsa.directions.length >= 1, JSON.stringify(salsa.directions));

console.log('→ example: two-column hotdish graphic');
const hotdish = formatReadableRecipe(
  stripScanChrome(`TIM WALZ'S HOTDISH
Ingredients
1 Package brats
1 Bottle beer
1 Onion
1 Teaspoon garlic powder
1 Cup chopped celery
1 Can cream of cheddar soup
1 Can cream of mushroom soup
1/2 Cup milk
1 Cup sharp cheddar cheese
1 Package tater tots
Directions
Bring a pot of water to a boil.
Add beer, onions, and garlic powder.
Submerge brats into the pot, reduce heat to medium, and cook for 10 minutes.
Remove and let cool.
Butter the casserole dish.
Combine remaining ingredients (minus the tots!) into a separate bowl.
Chop up the brats into bite-sized pieces and add to the other ingredients.
Pour the mixture into the casserole dish, top with tater tots, and bake for one hour at 350°.
Sprinkle with cheese for the last 10 to 15 minutes of baking.
ENJOY AND SHARE WITH TIM ON SOCIAL MEDIA!
X: @Tim_Walz | Instagram: @timwalz
HARRIS VICTORY FUND
PAID FOR BY HARRIS VICTORY FUND`),
);
assert.match(hotdish.title, /HOTDISH/i);
assert.ok(hotdish.ingredients.some((i) => /brats/i.test(i)), JSON.stringify(hotdish.ingredients));
assert.ok(hotdish.ingredients.some((i) => /tater tots/i.test(i)), JSON.stringify(hotdish.ingredients));
assert.ok(hotdish.directions.some((d) => /Bring a pot/.test(d)), JSON.stringify(hotdish.directions));
assert.ok(hotdish.directions.some((d) => /tater tots/i.test(d)), JSON.stringify(hotdish.directions));
assert.doesNotMatch(hotdish.body, /PAID FOR/i);

console.log('→ example: two recipes on one page after leftover pork copy');
const twoOnPage = sortPageText(
  dropLeadingOrphanCopy(`Return the pork to the oven and continue to cook until an internal temperature of 135 degrees is reached. Loosely tent the roast with foil, and allow it to rest 10 minutes before carving into 1/2 inch slices.

Fennel and Fruit Compote
1 fennel bulb
1 cup chopped dried prunes (or other dried fruits)
1/2 cup Marsala (optional)
2 tablespoons unsalted butter
2 tablespoons extra virgin olive oil
3/4 cup onion, finely chopped
1 tablespoon spice rub (above), to taste
Trim stalks off of fennel bulb, remove bruised outer leaves, and rinse. Cut bulb in half or quarters and remove core. Chop finely.
In a saucepan, reconstitute dried fruit by adding fruit and Marsala (optional) to pan and just enough water to cover. Bring to a boil and simmer on stovetop for a few minutes until tender.

DIABLO SKIRT STEAK
3 tablespoons extra virgin olive oil
3 tablespoons cider vinegar
2 teaspoons fresh oregano, chopped
1 1/2 tablespoon sugar
1 1/2 teaspoon salt
2 lbs. skirt or hanger steak
Fresh tomato salsa (recipe follows)
In a small bowl whisk together the olive oil, cider vinegar, oregano, sugar, and salt. Transfer to a plastic bag; add the steak and marinate 30 minutes or up to 4 hours.
Roberta L. Dowling © 2003
updated 03/21/12
page 3`),
  0,
).filter((c) => c.kind === 'recipe');
assert.ok(twoOnPage.length >= 2, JSON.stringify(twoOnPage.map((c) => c.title)));
assert.ok(twoOnPage.some((c) => /Fennel/.test(c.title)), JSON.stringify(twoOnPage.map((c) => c.title)));
assert.ok(twoOnPage.some((c) => /DIABLO|Skirt/i.test(c.title)), JSON.stringify(twoOnPage.map((c) => c.title)));
assert.ok(!twoOnPage.some((c) => /Return the pork/.test(c.body)));

console.log('→ example: ginger snaps with coating subhead and Step labels');
const snaps = formatReadableRecipe(
  `GWEN WALZ'S GINGER SNAP COOKIES
Her great grandmother's recipe. Perfect for a cold fall evening.
Yield: 4 dozen small cookies
Ingredients
2 cup unbleached all-purpose flour
1/4 tsp salt
2 tsp baking soda
1 tsp ground ginger
1 tsp ground cloves (I skip this!)
1 tsp ground cinnamon
3/4 cup vegetable shortening
1 cup sugar
1 large egg
1/4 cup molasses
Coating:
1/4 cup white sugar
1 tsp ground cinnamon
Directions
Step 1
Preheat oven to 350°F. Line baking sheets with parchment.
Step 2
In a separate bowl, combine flour, salt, baking soda, and spices.
Step 3
In a stand mixer, cream shortening and sugar until fluffy. Beat in egg, then molasses.
Step 4
Slowly beat in the flour and spice mixture. Dough will be tacky but stiff.
Step 5
Scoop 1" dough into balls and drop in cinnamon sugar mixture.
Step 6
Bake for about 10-12 minutes, rotating trays halfway.
Step 7
Allow to cool. Store in an airtight container.`,
);
assert.match(snaps.title, /GINGER SNAP/i);
assert.ok(snaps.ingredients.some((i) => /molasses/.test(i)));
assert.ok(snaps.ingredients.some((i) => /white sugar/.test(i)));
assert.ok(snaps.directions.some((d) => /Preheat oven/.test(d)), JSON.stringify(snaps.directions));
assert.ok(snaps.directions.length >= 5, JSON.stringify(snaps.directions));

console.log('→ example: photo card with ingredients left / directions right');
const dressing = formatReadableRecipe(
  `Kamala's Cornbread Dressing Recipe
Ingredients
2 - 8 oz packages of cornbread mix
1 lb spicy pork sausage
2 onions, chopped
2 apples, cored and chopped
4 celery stalks, diced
3/4 cup chicken broth
1/4 cup unsalted butter, melted
1/4 cup fresh parsley, chopped
2 tsp sage
1/2 tsp thyme
1/2 tsp rosemary
salt and pepper to taste
Directions
Step 1 Bake your cornbread according to the instructions on the package.
Step 2 Take the sausage out of its casing, crumble it, and brown it in a little oil.
Step 3 Sauté the vegetables and apples in the remaining oil in the same pan.
Step 4 Mix that with the sausage, cornbread crumbs, melted butter, herbs, and chicken broth.
Step 5 Put the mixture in a baking dish and bake at 375°F for about 40 minutes.`,
);
assert.match(dressing.title, /Cornbread Dressing/i);
assert.ok(dressing.ingredients.some((i) => /sausage/.test(i)));
assert.ok(dressing.directions.some((d) => /Bake your cornbread/.test(d)), JSON.stringify(dressing.directions));
assert.equal(dressing.directions.length, 5, JSON.stringify(dressing.directions));

console.log('test-ocr: ok');
