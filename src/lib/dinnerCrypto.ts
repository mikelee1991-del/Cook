const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export function bytesToB64url(bytes: Uint8Array): string {
  return toB64(bytes);
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u8.byteLength);
  new Uint8Array(out).set(u8);
  return out;
}

async function importKey(secretB64: string): Promise<CryptoKey> {
  const raw = fromB64(secretB64);
  return crypto.subtle.importKey('raw', toArrayBuffer(raw), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptJson(value: unknown, secretB64: string): Promise<string> {
  const key = await importKey(secretB64);
  const iv = randomBytes(12);
  const plain = enc.encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, plain);
  return `v1.${toB64(iv)}.${toB64(ct)}`;
}

export async function decryptJson<T>(payload: string, secretB64: string): Promise<T> {
  const parts = payload.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('Unknown snapshot format');
  const key = await importKey(secretB64);
  const iv = fromB64(parts[1]);
  const ct = fromB64(parts[2]);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(ct));
  return JSON.parse(dec.decode(plain)) as T;
}
