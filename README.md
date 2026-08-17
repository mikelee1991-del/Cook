# Supper

Interactive dinner planner with two tabs:

- **Pantry** — search, add, and remove groceries; seeded Ralph’s / Vons / Whole Foods purchase-history style items; dry-goods staples; expiration warnings with dispose & delete
- **Cook** — recipe suggestions (NYT Cooking links, saved starters, and kitchen originals) filterable by full ingredient match, time, ease, apparatus, and flavor

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Pantry state is stored in `localStorage` (`supper-pantry-v1`). Use **Reset seed data** on the Pantry tab to restore the starter inventory.

Live grocery purchase APIs and NYT Cooking saved-recipe access are not connected in this environment; replace seeds with a real export when available.
