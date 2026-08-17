# Dinner

Interactive dinner planner with three tabs:

- **Pantry** — search, add, and remove groceries; only basic spices are preloaded (no guessed purchase history); expiration warnings with dispose & delete
- **Cook** — recipe suggestions filterable by ingredient match, time, ease, apparatus, and flavor
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

Pantry and saves state are stored in `localStorage` (`dinner-pantry-v1`, `dinner-saves-v1`). Use **Reset to basic spices** on the Pantry tab to restore the spice list.

Ralph’s / Vons / Whole Foods credentials are only used to import real purchase history. Store of origin is for import help, not a primary pantry field.
