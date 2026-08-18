# Dinner

Interactive dinner planner (Vite + React).

**Always-on app:** [https://mikelee1991-del.github.io/Cook/](https://mikelee1991-del.github.io/Cook/)

Data stays in the browser on that origin (it does not sync from a preview tunnel).

## Commands

```bash
npm ci          # install
npm run dev     # local app at http://localhost:5173
npm run validate  # lint + build + smoke checks
npm run preview   # serve production build
```

## Tabs

- **Pantry** — shelf photo/video upload, spices-only seed, manual add/remove
- **Cook** — filter recipes by ingredients, time, ease, apparatus, flavor
- **Saves** — bulk scan page photos (auto-sort recipes vs other text) or save links

## Cloud Agent

`.cursor/environment.json` installs with `npm ci` and starts `npm run dev` on port 5173.
