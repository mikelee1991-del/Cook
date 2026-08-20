# Dinner

Interactive dinner planner (Vite + React).

**Always-on app:** [https://mikelee1991-del.github.io/Cook/](https://mikelee1991-del.github.io/Cook/)

Pantry, recommended ingredients, saved recipes, and scans sync automatically across devices that open the same Dinner link (the `#house=…` address). Snapshots are encrypted on the device before they are stored. GitHub Pages cannot accept uploads, so the default mailbox is a public ntfy.sh topic named from the unguessable house id; only ciphertext is stored there.

Shelf and recipe photos are identified with a vision model (Gemini). Paste a free API key from [Google AI Studio](https://aistudio.google.com/apikey) in **Devices** at the bottom of the app — it stays in that browser. Optionally set `VITE_DINNER_VISION_URL` to a Dinner worker (`sync-worker/`) that has `GEMINI_API_KEY` so the key never sits in the browser.

To use your own store instead of ntfy, set `VITE_DINNER_SYNC_URL` to a Dinner sync worker (`sync-worker/`) and rebuild.

## Commands

```bash
npm ci          # install
npm run dev     # local app at http://localhost:5173
npm run validate  # lint + build + smoke checks
npm run preview   # serve production build
```

## Tabs

- **Pantry** — shelf photo upload with AI item matching, spices-only seed, manual add/remove
- **Cook** — filter recipes by ingredients, time, ease, apparatus, flavor
- **Saves** — bulk scan page photos with AI (recipes vs other text) or save links

## Cloud Agent

`.cursor/environment.json` installs with `npm ci` and starts `npm run dev` on port 5173.
