#!/usr/bin/env node
/**
 * One-command check for Dinner: lint, build, smoke, and basic UI copy.
 * Keep this small — no extra frameworks.
 */
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function run(label, command, args) {
  console.log(`\n→ ${label}`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`FAIL: ${label}`);
    process.exit(result.status ?? 1);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

run('lint', 'npm', ['run', 'lint']);
run('recommend tests', 'npm', ['run', 'test:recommend']);
run('cook tests', 'npm', ['run', 'test:cook']);
run('ocr tests', 'npm', ['run', 'test:ocr']);
run('build', 'npm', ['run', 'build']);

console.log('\n→ smoke dist');
assert.ok(fs.existsSync('dist/index.html'), 'dist/index.html missing');
const html = read('dist/index.html');
assert.match(html, /id="root"/, 'root mount missing');
assert.match(html, /Dinner/, 'brand title missing from index.html');
assert.match(html, /\.\/assets\//, 'production assets should use relative paths for GitHub Pages');

const assets = fs.readdirSync('dist/assets');
assert.ok(assets.some((f) => f.endsWith('.js')), 'no JS bundle');
assert.ok(assets.some((f) => f.endsWith('.css')), 'no CSS bundle');

console.log('\n→ readability / command-path copy');
const app = read('src/App.tsx');
assert.match(app, /brand">Dinner</, 'hero brand should be Dinner');
assert.doesNotMatch(app, /Supper/, 'Supper branding should be gone');
assert.match(app, /Pantry|Cook|Saves/, 'primary tabs present');
assert.match(app, /Hard reset/, 'footer hard reset control');
assert.match(read('src/lib/appStorage.ts'), /APP_STORAGE_KEYS/, 'central app storage keys');

const pantry = read('src/components/PantryTab.tsx');
assert.match(pantry, /Scan shelves/, 'pantry scan section label');
assert.match(pantry, /BulkUploadZone/, 'bulk upload wired in pantry');
assert.match(pantry, /RecommendedIngredients/, 'recommended list wired in pantry');

const rec = read('src/lib/recommendIngredients.ts');
assert.match(rec, /recommendFromStock/, 'recommendation engine present');
assert.match(read('src/lib/pantryUtils.ts'), /ingredientNamesMatch/, 'form-aware pantry match');
assert.match(read('src/components/RecommendedIngredients.tsx'), /Add to pantry/, 'add-to-pantry on list');

const saves = read('src/components/SavesTab.tsx');
assert.match(saves, /Scan pages in bulk|Scan & sort/, 'saves scan path present');
assert.match(saves, /BulkUploadZone/, 'bulk upload wired in saves');

const cook = read('src/components/CookTab.tsx');
assert.match(cook, /type="range"/, 'cook filters should use sliders');
assert.doesNotMatch(cook, /Instant Pot|Air fryer|air-fryer|instant-pot/, 'cook UI should not offer Instant Pot or air fryer');
assert.match(read('src/lib/frozenHandling.ts'), /cook-from-frozen/, 'frozen cook timing');
assert.match(read('src/components/PantryTab.tsx'), /Unfreeze|Freeze/, 'pantry freeze toggle');

assert.match(read('src/lib/scanImages.ts'), /prepareOcrPage/, 'OCR preprocess wired');
assert.match(read('src/lib/ocrPreprocess.ts'), /grayscaleContrast/, 'contrast stretch for recipe photos');
assert.match(read('src/lib/ocrPreprocess.ts'), /adaptiveBinarize/, 'handwriting / uneven-light binarize');
assert.match(read('src/lib/scanImages.ts'), /SPARSE_TEXT/, 'handwriting page segmentation');
assert.match(read('src/lib/ocrText.ts'), /pageDensityFromInk/, 'sparse vs print layout');
assert.match(read('src/lib/imageFiles.ts'), /isLikelyImageFile/, 'blank MIME image sniffing');
assert.match(read('src/components/SavesTab.tsx'), /Scan again/, 'rescan existing photos');
assert.match(read('src/components/SavesTab.tsx'), /handwritten/, 'saves copy mentions handwriting');

const pkg = JSON.parse(read('package.json'));
for (const script of [
  'dev',
  'build',
  'lint',
  'preview',
  'validate',
  'test:recommend',
  'test:cook',
  'test:ocr',
]) {
  assert.ok(pkg.scripts?.[script], `package.json missing script: ${script}`);
}

console.log('\nvalidate: ok');
