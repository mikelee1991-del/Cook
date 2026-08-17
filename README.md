# Dinner

Interactive dinner planner with three tabs:

- **Pantry** — upload shelf photos/videos for identification, search/add/remove groceries; only basic spices are preloaded (nothing guessed)
- **Cook** — recipe suggestions filterable by ingredient match, time, ease, apparatus, and flavor
- **Saves** — upload recipe photos or save favorite recipe links

## Develop

```bash
npm install
npm run dev
```

## Pantry shelf scan

1. Upload photos/videos in the Pantry tab **Scan shelves** section (and/or drop files into `data/pantry-shelves/`).
2. Attach the same media in your Cursor agent chat so labels can be read.
3. Only clearly visible items are added — confirm or remove anything wrong.

## Build

```bash
npm run build
npm run preview
```

Local state keys: `dinner-pantry-v1`, `dinner-pantry-media-v1`, `dinner-saves-v1`.
