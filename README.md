# Dinner

Interactive dinner planner (Vite + React).

**Always-on app:** [https://mikelee1991-del.github.io/Cook/](https://mikelee1991-del.github.io/Cook/)

Pantry, recommended ingredients, saved recipes, and scans sync automatically across devices that open the same Dinner link (the `#house=…` address). Snapshots are encrypted on the device before they are stored. GitHub Pages cannot accept uploads, so the default mailbox is a public ntfy.sh topic named from the unguessable house id; only ciphertext is stored there.

Shelf and recipe photos use Gemini vision. For **everyone** on the live site (no per-browser key):

1. Create a free key at [Google AI Studio](https://aistudio.google.com/apikey) (requires your Google account — agents cannot do this for you).
2. In GitHub → **Settings → Secrets and variables → Actions**, add:
   - Secret `GEMINI_API_KEY` — your Gemini key (stays on the Cloudflare worker, never in the Pages bundle)
   - Secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` — if not already set (for worker deploy)
   - Variable `DINNER_WORKER_URL` — worker base URL after deploy, e.g. `https://dinner-house-sync.<your-subdomain>.workers.dev`
3. Run the **Deploy Dinner sync worker** workflow (or push a change under `sync-worker/`).
4. Redeploy GitHub Pages (push to `main`) so the build picks up `DINNER_WORKER_URL`.

Until that is set up, you can paste a personal key in **Devices** at the bottom of the app (stored only in that browser).

To use your own sync store instead of ntfy, set `VITE_DINNER_SYNC_URL` to the same worker URL and rebuild.

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
