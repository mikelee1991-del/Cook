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
run('build', 'npm', ['run', 'build']);

console.log('\n→ smoke dist');
assert.ok(fs.existsSync('dist/index.html'), 'dist/index.html missing');
const html = read('dist/index.html');
assert.match(html, /id="root"/, 'root mount missing');
assert.match(html, /Dinner/, 'brand title missing from index.html');

const assets = fs.readdirSync('dist/assets');
assert.ok(assets.some((f) => f.endsWith('.js')), 'no JS bundle');
assert.ok(assets.some((f) => f.endsWith('.css')), 'no CSS bundle');

console.log('\n→ readability / command-path copy');
const app = read('src/App.tsx');
assert.match(app, /brand">Dinner</, 'hero brand should be Dinner');
assert.doesNotMatch(app, /Supper/, 'Supper branding should be gone');
assert.match(app, /Pantry|Cook|Saves/, 'primary tabs present');

const pantry = read('src/components/PantryTab.tsx');
assert.match(pantry, /Scan shelves/, 'pantry scan section label');
assert.match(pantry, /BulkUploadZone/, 'bulk upload wired in pantry');
assert.match(pantry, /RecommendedIngredients/, 'recommended list wired in pantry');

const rec = read('src/lib/recommendIngredients.ts');
assert.match(rec, /recommendFromStock/, 'recommendation engine present');

const saves = read('src/components/SavesTab.tsx');
assert.match(saves, /Scan pages in bulk|Scan & sort/, 'saves scan path present');
assert.match(saves, /BulkUploadZone/, 'bulk upload wired in saves');

const pkg = JSON.parse(read('package.json'));
for (const script of ['dev', 'build', 'lint', 'preview', 'validate']) {
  assert.ok(pkg.scripts?.[script], `package.json missing script: ${script}`);
}

console.log('\nvalidate: ok');
