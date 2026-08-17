# Dinner

Interactive dinner planner with four tabs:

- **Pantry** — search, add, and remove groceries; only basic spices are preloaded (no guessed purchase history)
- **Cook** — recipe suggestions filterable by ingredient match, time, ease, apparatus, and flavor
- **Bar** — upload bar-cabinet photos/videos; bottle list is filled from label analysis or manual entry (never guessed)
- **Saves** — upload recipe photos or save favorite recipe links

## Develop

```bash
npm install
npm run dev
```

## Bar cabinet analysis

1. Upload photos/videos in the **Bar** tab (and/or drop files into `data/bar-cabinet/`).
2. Attach the same media in your Cursor agent chat so labels can be read.
3. Only bottles that are clearly visible are added; confirm or remove anything marked unclear.

## Build

```bash
npm run build
npm run preview
```

Local state keys: `dinner-pantry-v1`, `dinner-saves-v1`, `dinner-bar-media-v1`, `dinner-bar-bottles-v1`.
