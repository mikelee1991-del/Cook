import { bytesToB64url, randomBytes } from './dinnerCrypto';

export const HOUSE_PREFIX = 'd1';

export interface Household {
  slot: string;
  secret: string;
}

export function createHousehold(): Household {
  return {
    slot: bytesToB64url(randomBytes(18)),
    secret: bytesToB64url(randomBytes(32)),
  };
}

export function formatHouseCode(house: Household): string {
  return `${HOUSE_PREFIX}.${house.slot}.${house.secret}`;
}

export function parseHouseCode(raw: string): Household | null {
  const t = raw
    .trim()
    .replace(/^#/, '')
    .replace(/^house=/i, '');
  const parts = t.split('.');
  if (parts.length !== 3 || parts[0] !== HOUSE_PREFIX) return null;
  if (parts[1].length < 16 || parts[2].length < 32) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]+$/.test(parts[2])) return null;
  return { slot: parts[1], secret: parts[2] };
}

export function houseFromHash(hash: string): Household | null {
  const q = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!q) return null;
  try {
    const named = new URLSearchParams(q).get('house');
    if (named) return parseHouseCode(named);
  } catch {
    /* ignore */
  }
  return parseHouseCode(q);
}
