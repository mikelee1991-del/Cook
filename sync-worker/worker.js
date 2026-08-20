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
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
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
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({ ok: true, service: 'dinner-sync' });
    }

    if (url.pathname === '/vision' && request.method === 'POST') {
      return visionProxy(request, env);
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

const VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

async function visionProxy(request, env) {
  const key = env?.GEMINI_API_KEY;
  if (!key) return json({ error: 'Vision is not configured on this worker' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
  const images = Array.isArray(body?.images) ? body.images : [];
  if (!prompt || !images.length) return json({ error: 'Missing prompt or images' }, 400);

  const requested = typeof body?.model === 'string' && body.model.trim() ? body.model.trim() : VISION_MODELS[0];
  const models = [requested, ...VISION_MODELS.filter((m) => m !== requested)];
  let lastError = 'Vision request failed';

  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                ...images.map((img) => ({
                  inline_data: {
                    mime_type: img?.mimeType || 'image/jpeg',
                    data: img?.data,
                  },
                })),
              ],
            },
          ],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('\n');
      return json({ text, candidates: data.candidates });
    }
    lastError = data.error?.message || `Vision request failed (${res.status})`;
    if (res.status !== 404) return json({ error: lastError }, res.status);
  }
  return json({ error: lastError }, 502);
}
