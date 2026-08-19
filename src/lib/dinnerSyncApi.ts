import { customSyncApiBase } from './syncConfig';

const NTFY_BASE = 'https://ntfy.sh';

interface NtfyMessage {
  event?: string;
  message?: string;
  attachment?: { url?: string };
}

export function ntfyTopic(slot: string): string {
  const clean = slot.replace(/[^A-Za-z0-9_-]/g, '');
  return `dnr${clean}`.slice(0, 64);
}

export function latestNtfyMessage(ndjson: string): NtfyMessage | null {
  const lines = ndjson
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const msg = JSON.parse(lines[i]) as NtfyMessage;
      if (msg.event && msg.event !== 'message') continue;
      if (msg.attachment?.url || (typeof msg.message === 'string' && msg.message.startsWith('v1.'))) {
        return msg;
      }
    } catch {
      /* skip malformed lines */
    }
  }
  return null;
}

async function pullFromWorker(base: string, slot: string): Promise<string | null> {
  const res = await fetch(`${base}/house/${slot}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Sync read failed (${res.status})`);
  const data = (await res.json()) as { payload?: string | null };
  return data.payload ?? null;
}

async function pushToWorker(base: string, slot: string, payload: string): Promise<void> {
  const res = await fetch(`${base}/house/${slot}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (res.status === 413) throw new Error('Dinner data is too large to sync (try removing shelf videos).');
  if (!res.ok) throw new Error(`Sync write failed (${res.status})`);
}

async function pullFromNtfy(slot: string): Promise<string | null> {
  const res = await fetch(`${NTFY_BASE}/${ntfyTopic(slot)}/json?poll=1&since=all`);
  if (!res.ok) throw new Error(`Sync read failed (${res.status})`);
  const msg = latestNtfyMessage(await res.text());
  if (!msg) return null;
  if (msg.attachment?.url) {
    const file = await fetch(msg.attachment.url);
    if (!file.ok) throw new Error(`Sync attachment failed (${file.status})`);
    const payload = await file.text();
    return payload.startsWith('v1.') ? payload : null;
  }
  return typeof msg.message === 'string' && msg.message.startsWith('v1.') ? msg.message : null;
}

async function pushToNtfy(slot: string, payload: string): Promise<void> {
  const res = await fetch(`${NTFY_BASE}/${ntfyTopic(slot)}`, {
    method: 'POST',
    headers: {
      Filename: 'dinner.snap',
      'Content-Type': 'text/plain',
    },
    body: payload,
  });
  if (res.status === 413) throw new Error('Dinner data is too large to sync (try removing shelf videos).');
  if (!res.ok) throw new Error(`Sync write failed (${res.status})`);
}

export async function pullHousePayload(slot: string): Promise<string | null> {
  const custom = customSyncApiBase();
  if (custom) return pullFromWorker(custom, slot);
  return pullFromNtfy(slot);
}

export async function pushHousePayload(slot: string, payload: string): Promise<void> {
  const custom = customSyncApiBase();
  if (custom) return pushToWorker(custom, slot, payload);
  return pushToNtfy(slot, payload);
}
