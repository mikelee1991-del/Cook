/** Pull a JSON object or array out of a model response (fences / leading prose). */
export function parseModelJson<T>(raw: string): T {
  const text = raw.trim();
  if (!text) throw new Error('Vision returned empty text');

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();

  const attempts = [candidate];
  const objectStart = candidate.indexOf('{');
  const objectEnd = candidate.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    attempts.push(candidate.slice(objectStart, objectEnd + 1));
  }
  const arrayStart = candidate.indexOf('[');
  const arrayEnd = candidate.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    attempts.push(candidate.slice(arrayStart, arrayEnd + 1));
  }

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt) as T;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Vision returned invalid JSON');
}
