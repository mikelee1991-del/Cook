# Supper

Interactive dinner planner with three tabs:

- **Pantry** — search, add, and remove groceries; seeded Ralph’s / Vons / Whole Foods purchase-history style items; dry-goods staples; expiration warnings with dispose & delete
- **Cook** — recipe suggestions (NYT Cooking links, saved starters, and kitchen originals) filterable by full ingredient match, time, ease, apparatus, and flavor
- **Saves** — upload one or more recipe photos, or save favorite recipe links from the internet

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

Pantry and saves state are stored in `localStorage` (`supper-pantry-v1`, `supper-saves-v1`). Use **Reset seed data** on the Pantry tab to restore the starter inventory.

Live grocery purchase APIs and NYT Cooking saved-recipe access are not connected in this environment; replace seeds with a real export when available.
