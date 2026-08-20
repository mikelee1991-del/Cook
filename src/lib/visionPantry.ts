import { groceryCatalog } from '../data/pantrySeed';
import type { CatalogItem, PantrySection } from '../types';
import { ingredientNamesMatch, normalizeName } from './pantryUtils';
import { pantryDraftFromName } from './pantryDraft';

export interface RawVisionPantryItem {
  name?: string;
  aliases?: string[];
  catalogName?: string | null;
  quantity?: string;
  frozen?: boolean;
  section?: PantrySection | string;
  cues?: string;
  confidence?: number;
}

export interface IdentifiedPantryItem {
  name: string;
  catalogName: string | null;
  quantity: string;
  frozen: boolean;
  section: PantrySection;
  cues: string;
  confidence: number;
}

const SECTIONS: PantrySection[] = ['fresh', 'refrigerated', 'frozen', 'dry'];

export function catalogMatchScore(query: string, catalogName: string): number {
  const q = normalizeName(query);
  const c = normalizeName(catalogName);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (ingredientNamesMatch(catalogName, query)) {
    const extra = Math.abs(c.length - q.length);
    return 86 - Math.min(20, extra);
  }
  const qTokens = new Set(q.split(' ').filter(Boolean));
  const cTokens = c.split(' ').filter(Boolean);
  if (!cTokens.length) return 0;
  const overlap = cTokens.filter((t) => qTokens.has(t)).length;
  if (overlap === 0) return 0;
  return Math.round((overlap / Math.max(qTokens.size, cTokens.length)) * 70);
}

/** Best grocery-catalog name for a seen item, or null when nothing is close enough. */
export function bestCatalogMatch(name: string, aliases: string[] = []): CatalogItem | null {
  const queries = [name, ...aliases].map((s) => s.trim()).filter(Boolean);
  let best: { item: CatalogItem; score: number } | null = null;
  for (const item of groceryCatalog) {
    let score = 0;
    for (const query of queries) {
      score = Math.max(score, catalogMatchScore(query, item.name));
    }
    if (!best || score > best.score) best = { item, score };
  }
  if (!best || best.score < 62) return null;
  return best.item;
}

function asSection(value: unknown, frozen: boolean, fallback: PantrySection): PantrySection {
  if (frozen) return 'frozen';
  if (typeof value === 'string' && SECTIONS.includes(value as PantrySection)) {
    return value as PantrySection;
  }
  return fallback;
}

export function resolveIdentifiedItem(raw: RawVisionPantryItem): IdentifiedPantryItem | null {
  const name = (raw.name || '').trim();
  if (!name) return null;
  const aliases = Array.isArray(raw.aliases) ? raw.aliases.filter((a) => typeof a === 'string') : [];
  const hinted =
    typeof raw.catalogName === 'string' && raw.catalogName.trim()
      ? bestCatalogMatch(raw.catalogName, aliases)
      : null;
  const matched = hinted ?? bestCatalogMatch(name, aliases);
  const draft = pantryDraftFromName(matched?.name ?? name);
  const frozen = Boolean(raw.frozen) || draft.section === 'frozen';
  const confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.7;
  return {
    name: matched?.name ?? draft.name,
    catalogName: matched?.name ?? null,
    quantity: (raw.quantity || draft.quantity || '1').trim() || '1',
    frozen,
    section: asSection(raw.section, frozen, draft.section),
    cues: (raw.cues || '').trim(),
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

export function resolveIdentifiedItems(rawItems: RawVisionPantryItem[]): IdentifiedPantryItem[] {
  const out: IdentifiedPantryItem[] = [];
  const seen = new Set<string>();
  for (const raw of rawItems) {
    const item = resolveIdentifiedItem(raw);
    if (!item || item.confidence < 0.35) continue;
    const key = normalizeName(item.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
}

export function mergeIdentifiedItems(groups: IdentifiedPantryItem[][]): IdentifiedPantryItem[] {
  const out: IdentifiedPantryItem[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const item of group) {
      const key = normalizeName(item.name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
}

export const PANTRY_VISION_PROMPT = `You identify grocery items in a home pantry, fridge, freezer, or counter photo.

Look at EVERY visual feature of each distinct product — do not rely on reading labels alone:
- Package form: can, jar, carton, bag, box, bottle, tube, clamshell, produce, vacuum pack
- Brand marks, logos, and artwork even when the type is tiny
- Dominant colors, patterns, and window cutouts showing the food
- Produce species from skin, leaves, stems, bunches vs loose
- Frozen cues: frost, ice crystals, steamer bags, "frozen" art, freezer burn sheen
- Meat vs dairy vs dry cues: styrofoam trays, condensation, grain sacks
- Count or size when obvious (dozen eggs, 15 oz can)

For each DISTINCT product (group identical units), return the grocery name a cook would use.
If the item matches CATALOG, set catalogName to that exact catalog string. Otherwise catalogName is null and name is a short common grocery name (e.g. "All-purpose flour").
Do not invent items you cannot see. Skip shelves, appliances, and empty space.

CATALOG:
{{CATALOG}}

Return JSON:
{"items":[{"name":"","aliases":[],"catalogName":null,"quantity":"","frozen":false,"section":"fresh|refrigerated|frozen|dry","cues":"what you saw","confidence":0.0}]}
`;

export function pantryVisionPrompt(): string {
  const catalog = groceryCatalog.map((c) => `- ${c.name} (${c.section})`).join('\n');
  return PANTRY_VISION_PROMPT.replace('{{CATALOG}}', catalog);
}
