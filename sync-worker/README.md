# Dinner sync + vision worker

Cloudflare Worker that stores encrypted household snapshots and proxies Gemini vision calls so **one API key** serves all Dinner users.

## Deploy (GitHub Actions)

Repository secrets:

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Wrangler deploy |
| `GEMINI_API_KEY` | Global photo scans (never shipped to GitHub Pages) |

Repository variable:

| Variable | Example |
|----------|---------|
| `DINNER_WORKER_URL` | `https://dinner-house-sync.<subdomain>.workers.dev` |

After the first deploy, set `DINNER_WORKER_URL` and redeploy GitHub Pages so the app calls `/vision` on this worker.

## Manual deploy

```bash
cd sync-worker
npx wrangler deploy
printf '%s' "$GEMINI_API_KEY" | npx wrangler secret put GEMINI_API_KEY
curl "https://dinner-house-sync.<subdomain>.workers.dev/health"
```

## Endpoints

- `GET /health` — worker status
- `POST /vision` — Gemini vision proxy (JSON body: `prompt`, `images`, optional `model`)
- `GET/PUT /house/:id` — encrypted sync blob (optional; app defaults to ntfy.sh)
