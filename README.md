# Supper

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

Pantry and saves state are stored in `localStorage` (`supper-pantry-v2`, `supper-saves-v1`). Use **Reset to basic spices** on the Pantry tab to restore the spice list.

Ralph’s / Vons / Whole Foods items are only added from real authenticated fetches or exports you provide — never guessed.
