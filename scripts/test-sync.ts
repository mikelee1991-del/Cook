/**
 * Cross-device snapshot merge + household codes.
 * Run with: npx tsx scripts/test-sync.ts
 */
import assert from 'node:assert/strict';
import { decryptJson, encryptJson } from '../src/lib/dinnerCrypto.ts';
import {
  createHousehold,
  formatHouseCode,
  houseFromHash,
  parseHouseCode,
} from '../src/lib/dinnerHouse.ts';
import {
  emptySnapshot,
  mergeById,
  mergeSnapshots,
  mergeTombs,
  slimSnapshot,
  snapshotsEqual,
} from '../src/lib/dinnerSnapshot.ts';
import { latestNtfyMessage, ntfyTopic, pullHousePayload, pushHousePayload } from '../src/lib/dinnerSyncApi.ts';
import type { PantryItem } from '../src/types.ts';

function item(id: string, name: string, updatedAt: number): PantryItem {
  return {
    id,
    name,
    store: 'Other',
    section: 'dry',
    quantity: '1',
    purchasedAt: '2026-01-01',
    expiresAt: '2026-12-01',
    updatedAt,
  };
}

console.log('→ household codes');
const house = createHousehold();
const code = formatHouseCode(house);
assert.equal(parseHouseCode(code)?.slot, house.slot);
assert.equal(parseHouseCode(`#house=${code}`)?.secret, house.secret);
assert.equal(houseFromHash(`#house=${code}`)?.slot, house.slot);
assert.equal(parseHouseCode('nope'), null);

console.log('→ last-write-wins by id');
const merged = mergeById(
  [item('a', 'old', 1), item('b', 'keep', 5)],
  [item('a', 'new', 9), item('c', 'phone', 4)],
  {},
);
assert.equal(merged.find((p) => p.id === 'a')?.name, 'new');
assert.ok(merged.some((p) => p.id === 'b'));
assert.ok(merged.some((p) => p.id === 'c'));

console.log('→ tombstones win over older items');
const afterDelete = mergeById([item('gone', 'salt', 2)], [item('gone', 'salt', 2)], { gone: 10 });
assert.equal(afterDelete.length, 0);
assert.equal(mergeTombs({ a: 1 }, { a: 4, b: 2 }).a, 4);

console.log('→ two devices merge pantry + saves');
const laptop = emptySnapshot('laptop', 100);
laptop.pantry = [item('flour', 'Flour', 100)];
laptop.saves = [
  {
    id: 's1',
    title: 'Soup',
    notes: 'from laptop',
    kind: 'link',
    url: 'https://example.com/soup',
    images: [],
    createdAt: '2026-01-01',
    updatedAt: 100,
  },
];
const phone = emptySnapshot('phone', 200);
phone.pantry = [item('eggs', 'Eggs', 200)];
phone.saves = [
  {
    id: 's2',
    title: 'Tacos',
    notes: 'from phone',
    kind: 'link',
    url: 'https://example.com/tacos',
    images: [],
    createdAt: '2026-01-02',
    updatedAt: 200,
  },
];
const both = mergeSnapshots(laptop, phone);
assert.ok(both.pantry.some((p) => p.id === 'flour'));
assert.ok(both.pantry.some((p) => p.id === 'eggs'));
assert.ok(both.saves.some((s) => s.id === 's1'));
assert.ok(both.saves.some((s) => s.id === 's2'));

console.log('→ encrypt roundtrip');
const secret = house.secret;
const cipher = await encryptJson({ hello: 'dinner' }, secret);
const plain = await decryptJson<{ hello: string }>(cipher, secret);
assert.equal(plain.hello, 'dinner');

console.log('→ slim drops data-url media when huge');
const fat = emptySnapshot('dev', 1);
fat.media = [
  {
    id: 'm1',
    kind: 'image',
    src: `data:image/jpeg;base64,${'A'.repeat(2_000_000)}`,
    name: 'shelf.jpg',
    createdAt: '2026-01-01',
    updatedAt: 1,
  },
];
const slim = slimSnapshot(fat);
assert.equal(slim.media[0]?.src, '');

console.log('→ snapshotsEqual ignores device clock');
const a = emptySnapshot('a', 1);
const b = emptySnapshot('b', 99);
assert.equal(snapshotsEqual(a, b), true);

console.log('→ ntfy topic + last ciphertext message');
assert.match(ntfyTopic(house.slot), /^dnr[A-Za-z0-9_-]{16,61}$/);
const ndjson = [
  '{"event":"open"}',
  '{"event":"message","message":"You received a file: dinner.snap","attachment":{"url":"https://ntfy.sh/file/x.txt"}}',
].join('\n');
assert.equal(latestNtfyMessage(ndjson)?.attachment?.url, 'https://ntfy.sh/file/x.txt');
assert.equal(latestNtfyMessage('{"event":"message","message":"v1.iv.ct"}\n')?.message, 'v1.iv.ct');
assert.equal(latestNtfyMessage(''), null);

console.log('→ live encrypted mailbox roundtrip');
const liveSlot = `t${house.slot}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
const livePayload = await encryptJson({ pantry: ['eggs'] }, house.secret);
await pushHousePayload(liveSlot, livePayload);
let pulled: string | null = null;
for (let i = 0; i < 8 && pulled !== livePayload; i++) {
  if (i > 0) await new Promise((r) => setTimeout(r, 350));
  pulled = await pullHousePayload(liveSlot);
}
assert.equal(pulled, livePayload);
assert.deepEqual(await decryptJson<{ pantry: string[] }>(pulled, house.secret), { pantry: ['eggs'] });

console.log('test-sync: ok');
