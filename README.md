# Dinner

Interactive dinner planner with three tabs:

- **Pantry** — upload shelf photos/videos for identification, search/add/remove groceries; only basic spices are preloaded
- **Cook** — recipe suggestions filterable by ingredient match, time, ease, apparatus, and flavor
- **Saves** — scan page photos (auto-sorts multiple recipes vs other text), or save favorite links

## Develop

```bash
npm install
npm run dev
```

## Photo page scanning

On **Saves → Scan photos**, upload any page image. OCR runs in the browser and sorts text into:

- **Recipe** clips (ingredients / directions patterns; multiple recipes on one page are split)
- **Other text** (notes, ads, misc)

Reclassify, discard, or **Keep as saved recipe** for each clip.

## Build

```bash
npm run build
npm run preview
```
