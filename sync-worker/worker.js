/**
 * Optional self-hosted store for encrypted household blobs.
 * The GitHub Pages app uses ntfy.sh by default (see dinnerSyncApi.ts).
 * CORS open: only ciphertext is stored; the house id is unguessable.
 */
const mem = new Map();
const MAX_BYTES = 1_800_000;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function houseId(pathname) {
  const m = pathname.match(/^\/house\/([A-Za-z0-9_-]{16,96})$/);
  return m ? m[1] : null;
}

export default {
  async fetch(request, _env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({ ok: true, service: 'dinner-sync' });
    }

    const id = houseId(url.pathname);
    if (!id) return json({ error: 'Unknown path' }, 404);

    const cache = caches.default;
    const cacheKey = new Request(`https://dinner-house.sync/house/${id}`);

    if (request.method === 'GET') {
      const cachedMem = mem.get(id);
      if (cachedMem) return json({ payload: cachedMem });
      const hit = await cache.match(cacheKey);
      if (hit) {
        const payload = await hit.text();
        mem.set(id, payload);
        return json({ payload });
      }
      return json({ payload: null });
    }

    if (request.method === 'PUT') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }
      const payload = body?.payload;
      if (typeof payload !== 'string') return json({ error: 'Missing payload' }, 400);
      if (payload.length > MAX_BYTES) return json({ error: 'Too large' }, 413);
      mem.set(id, payload);
      ctx.waitUntil(
        cache.put(
          cacheKey,
          new Response(payload, {
            headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=2592000' },
          }),
        ),
      );
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  },
};
