/**
 * Turn messy OCR recipe text into something you can actually cook from:
 * title, Ingredients list, Directions list — with sane spacing.
 */

const SECTION_ING =
  /^(ingredients?|ingredlents|lngredients|1ngredients)\b[:\s.-]*$/i;
const SECTION_DIR =
  /^(directions?|directlons|instructions?|instructlons|method|preparation|steps?)\b[:\s.-]*$/i;
const SECTION_NOTES = /^(notes?|tips?|yield)\b[:\s.-]*$/i;
const SECTION_SERVES = /^(serves?|servings?)\b[:\s.-]*\d/i;
const SECTION_ANY =
  /^(ingredients?|ingredlents|lngredients|1ngredients|directions?|directlons|instructions?|instructlons|method|preparation|steps?|notes?|tips?|yield)\b[:\s.-]*$/i;

const MEASURE =
  /\b(\d+\/\d+|\d+(\.\d+)?)\s?(cups?|c\.|c|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lb|lbs|pounds?|g|kg|ml|l|cloves?|cans?|sticks?|pinch(?:es)?|dash(?:es)?)\b/i;

const QUANTITY_START =
  /^\s*(\d+([/.]\d+)?|\d+\s+\d+\/\d+|[¼½¾⅓⅔⅛]|(?:one|two|three|a)\s+(?:\d+\/\d+\s+)?(?:cups?|c\.|tbsp|tsp|oz|lb|lbs|cloves?|cans?|sticks?|pinch|dash))\b/i;

const STEP_PREFIX = /^\s*(\d+[).]|[lI][).]|step\s*\d+|•|-|\*)\s+/i;

const ACTION_VERB =
  /^(preheat|prebeat|mix|whisk|stir|bake|roast|simmer|boil|heat|cook|combine|add|pour|place|season|serve|toss|fold|chop|slice|dice|mince|drain|bring|reduce|cover|uncover|transfer|remove|let|set|spread|brush|grill|saute|sauté|fry|broil|blend|process|marinate|rest|cool|chill|refrigerate|freeze|thaw|garnish|top|repeat|continue|meanwhile|while)\b/i;

export interface ReadableRecipe {
  title: string;
  body: string;
  ingredients: string[];
  directions: string[];
}

function normalizeLine(line: string): string {
  return line
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^\s*[\u2022•·∙▪◦○●]\s*/, '')
    .trim();
}

function stripStepPrefix(line: string): string {
  return line.replace(STEP_PREFIX, '').trim();
}

function isSectionHeader(line: string): 'ingredients' | 'directions' | 'notes' | null {
  const t = normalizeLine(line);
  if (SECTION_ING.test(t)) return 'ingredients';
  if (SECTION_DIR.test(t)) return 'directions';
  if (SECTION_NOTES.test(t) || SECTION_SERVES.test(t) || /^(serves?|servings?)\b[:\s.-]*$/i.test(t)) {
    return 'notes';
  }
  return null;
}

/** Header alone, or "Ingredients: 1 cup flour" on one OCR line. */
function matchSectionStart(
  line: string,
): { section: 'ingredients' | 'directions' | 'notes'; rest: string } | null {
  const t = normalizeLine(line);
  if (/^serve[sd]?\b/i.test(t) && !/^(serves?|servings?)\b[:\s.-]*\d/i.test(t) && !/^(serves?|servings?)\b[:\s.-]*$/i.test(t)) {
    return null;
  }
  const m = t.match(
    /^(ingredients?|ingredlents|lngredients|1ngredients|directions?|directlons|instructions?|instructlons|method|preparation|steps?|notes?|tips?|serves?|yield|servings?)\b[:\s.-]*(.*)$/i,
  );
  if (!m) return null;
  const label = m[1].toLowerCase();
  const rest = (m[2] || '').trim();
  let section: 'ingredients' | 'directions' | 'notes';
  if (/^ingred|^1ngred/i.test(label)) section = 'ingredients';
  else if (/^(notes?|tips?|serves?|yield|servings?)$/i.test(label)) section = 'notes';
  else section = 'directions';
  if (section === 'notes' && /^(serves?|servings?)$/i.test(label) && rest && !/^\d/.test(rest)) {
    return null;
  }
  if (section === 'notes' && rest && !MEASURE.test(rest) && rest.split(/\s+/).length > 6) {
    return null;
  }
  return { section, rest };
}

function looksLikeIngredient(line: string): boolean {
  const t = stripStepPrefix(normalizeLine(line));
  if (!t || SECTION_ANY.test(t)) return false;
  if (ACTION_VERB.test(t) && t.length > 28) return false;
  if (MEASURE.test(t) || QUANTITY_START.test(t)) return true;
  // Bare produce / pantry names on their own line (common in handwritten cards)
  if (
    /^[A-Za-z][A-Za-z .,'()-]{1,40}$/.test(t) &&
    t.split(/\s+/).length <= 5 &&
    !/[.!?]$/.test(t) &&
    !/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}$/.test(t) // reject Title Case recipe titles
  ) {
    return true;
  }
  return false;
}

function looksLikeDirection(line: string): boolean {
  const t = stripStepPrefix(normalizeLine(line));
  if (!t || SECTION_ANY.test(t)) return false;
  if (STEP_PREFIX.test(line)) return true;
  if (ACTION_VERB.test(t)) return true;
  if (t.length > 55 && /[.!?]$/.test(t)) return true;
  if (/\b(minutes?|mins?|seconds?|until|oven|degrees?|°)\b/i.test(t) && t.split(/\s+/).length >= 4) {
    return true;
  }
  return false;
}

function isLikelyTitle(line: string): boolean {
  const t = normalizeLine(line);
  if (!t || t.length < 3 || t.length > 72) return false;
  if (SECTION_ANY.test(t) || MEASURE.test(t) || STEP_PREFIX.test(t) || QUANTITY_START.test(t)) {
    return false;
  }
  if (ACTION_VERB.test(t) && t.split(/\s+/).length > 6) return false;
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return false;
  return true;
}

function shouldJoinContinuation(prev: string, next: string): boolean {
  const a = normalizeLine(prev);
  const b = normalizeLine(next);
  if (!a || !b) return false;
  if (SECTION_ANY.test(b) || STEP_PREFIX.test(next) || QUANTITY_START.test(b)) return false;
  if (/^[lI1]\s?(tsp|tbsp|cups?|oz|lb)\b/i.test(b)) return false;
  if (MEASURE.test(b) && QUANTITY_START.test(b)) return false;
  if (ACTION_VERB.test(b)) return false;
  if (/[,;:&]$/.test(a)) return true;
  // Broken OCR measure line: "2 cups" + "flour"
  if (
    a.split(/\s+/).length <= 3 &&
    (MEASURE.test(a) || QUANTITY_START.test(a)) &&
    !MEASURE.test(b) &&
    !QUANTITY_START.test(b) &&
    !/\b(tsp|tbsp|cups?|oz|lb|lbs)\b/i.test(b) &&
    b.length < 36 &&
    b.split(/\s+/).length <= 4
  ) {
    return true;
  }
  // Mid-sentence wrap only when the next line clearly continues a clause.
  if (/^[a-z]/.test(b) && (/[,;:]$/.test(a) || /\b(and|or|with|in|of|to|for|until)$/i.test(a))) {
    return true;
  }
  return false;
}

function coalesceLines(rawLines: string[]): string[] {
  const lines = rawLines.map(normalizeLine).filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    // Split a jammed single-line recipe: "Ingredients … Directions …"
    const inline = splitInlineSections(line);
    for (const piece of inline) {
      const prev = out[out.length - 1];
      if (prev && shouldJoinContinuation(prev, piece)) {
        out[out.length - 1] = `${prev} ${piece}`.replace(/\s+/g, ' ').trim();
      } else {
        out.push(piece);
      }
    }
  }
  return out;
}

/** Pull "Ingredients … Directions …" out of one OCR line when headers are inline. */
function splitInlineSections(line: string): string[] {
  if (!/\bingredients?\b/i.test(line) || !/\b(directions?|instructions?|method)\b/i.test(line)) {
    return [line];
  }
  if (SECTION_ANY.test(line)) return [line];
  const parts = line.split(
    /\s(?=(?:ingredients?|directions?|instructions?|method)\b)/i,
  );
  return parts.map(normalizeLine).filter(Boolean);
}

function extractTitle(lines: string[]): { title: string; rest: string[] } {
  if (!lines.length) return { title: 'Untitled recipe', rest: [] };
  const first = lines[0];
  if (isLikelyTitle(first) && !isSectionHeader(first)) {
    return { title: first, rest: lines.slice(1) };
  }
  return { title: 'Untitled recipe', rest: lines };
}

type Bucket = 'lead' | 'ingredients' | 'directions' | 'notes';

function partitionLines(lines: string[]): {
  lead: string[];
  ingredients: string[];
  directions: string[];
  notes: string[];
} {
  const lead: string[] = [];
  const ingredients: string[] = [];
  const directions: string[] = [];
  const notes: string[] = [];
  let bucket: Bucket = 'lead';
  let sawSection = false;

  for (const line of lines) {
    const sectionStart = matchSectionStart(line);
    if (sectionStart) {
      bucket = sectionStart.section;
      sawSection = true;
      if (sectionStart.rest) {
        if (bucket === 'ingredients') ingredients.push(...splitCrowdedIngredients(sectionStart.rest));
        else if (bucket === 'directions') directions.push(...splitCrowdedDirections(sectionStart.rest));
        else notes.push(sectionStart.rest);
      }
      continue;
    }

    if (!sawSection) {
      if (looksLikeDirection(line) && !looksLikeIngredient(line)) {
        bucket = 'directions';
        sawSection = true;
        directions.push(...splitCrowdedDirections(line));
        continue;
      }
      if (looksLikeIngredient(line)) {
        bucket = 'ingredients';
        sawSection = true;
        ingredients.push(...splitCrowdedIngredients(line));
        continue;
      }
      lead.push(line);
      continue;
    }

    if (bucket === 'ingredients') {
      if (looksLikeDirection(line) && !looksLikeIngredient(line) && ingredients.length >= 1) {
        bucket = 'directions';
        directions.push(...splitCrowdedDirections(line));
      } else {
        ingredients.push(...splitCrowdedIngredients(line));
      }
      continue;
    }

    if (bucket === 'directions') {
      directions.push(...splitCrowdedDirections(line));
      continue;
    }

    if (bucket === 'notes') {
      notes.push(line);
      continue;
    }

    lead.push(line);
  }

  // Lead leftovers that look like ingredients (no header recipes)
  if (!ingredients.length && lead.length) {
    const moved: string[] = [];
    const kept: string[] = [];
    for (const line of lead) {
      if (looksLikeIngredient(line)) moved.push(stripStepPrefix(line));
      else kept.push(line);
    }
    if (moved.length) {
      ingredients.push(...moved);
      lead.length = 0;
      lead.push(...kept);
    }
  }

  return { lead, ingredients, directions, notes };
}

function splitCrowdedIngredients(line: string): string[] {
  const t = stripStepPrefix(normalizeLine(line));
  if (!t) return [];
  const parts = t.split(
    /\s+(?=\d+(?:[/.]\d+)?\s?(?:cups?|c\.|tbsp|tsp|oz|ounces?|lb|lbs|g|kg|ml)\b)/i,
  );
  return parts.map((part) => normalizeLine(part)).filter(Boolean);
}

function splitCrowdedDirections(line: string): string[] {
  const t = stripStepPrefix(normalizeLine(line));
  if (!t) return [];
  if (STEP_PREFIX.test(line)) return [t];
  // "Bring to a boil. Simmer 18 minutes." → two steps
  if (/[.!?]\s+[A-Z]/.test(t)) {
    return t
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(normalizeLine)
      .filter(Boolean);
  }
  return [t];
}

function formatIngredient(line: string): string {
  const t = stripStepPrefix(normalizeLine(line)).replace(/^[-*•]\s*/, '');
  return t ? `- ${t}` : '';
}

function formatDirection(line: string, index: number): string {
  const t = stripStepPrefix(normalizeLine(line));
  return t ? `${index}. ${t}` : '';
}

/** Build a readable recipe body from raw OCR (or already-cleaned) text. */
export function formatReadableRecipe(raw: string): ReadableRecipe {
  const collapsed = raw.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!collapsed) {
    return { title: 'Untitled recipe', body: '', ingredients: [], directions: [] };
  }

  const lines = coalesceLines(collapsed.split(/\n/));
  const { title, rest } = extractTitle(lines);
  const parts = partitionLines(rest);

  const ingredientLines = parts.ingredients.map(formatIngredient).filter(Boolean);
  const directionLines = parts.directions
    .map((line, i) => formatDirection(line, i + 1))
    .filter(Boolean);
  const noteLines = parts.notes.map(normalizeLine).filter(Boolean);
  const leadLines = parts.lead.map(normalizeLine).filter(Boolean);

  const sections: string[] = [];
  if (leadLines.length) sections.push(leadLines.join('\n'));
  if (ingredientLines.length) {
    sections.push(['Ingredients', ...ingredientLines].join('\n'));
  }
  if (directionLines.length) {
    sections.push(['Directions', ...directionLines].join('\n'));
  }
  if (noteLines.length) {
    sections.push(['Notes', ...noteLines.map((n) => `- ${n.replace(/^[-*•]\s*/, '')}`)].join('\n'));
  }

  // Fallback: if we couldn't find structure, tidy spacing and keep the text.
  let body = sections.join('\n\n').trim();
  if (!body) {
    body = lines
      .filter((l) => normalizeLine(l) !== title)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  if (!body) body = collapsed;

  return {
    title,
    body,
    ingredients: parts.ingredients.map((l) => stripStepPrefix(normalizeLine(l))).filter(Boolean),
    directions: parts.directions.map((l) => stripStepPrefix(normalizeLine(l))).filter(Boolean),
  };
}

/** Format OCR text for display/save when we already know the clip title. */
export function formatRecipeClipBody(raw: string, preferredTitle?: string): { title: string; body: string } {
  const formatted = formatReadableRecipe(raw);
  const title =
    preferredTitle && preferredTitle.trim() && preferredTitle !== 'Untitled clip'
      ? preferredTitle.trim()
      : formatted.title;
  // Drop a duplicate title line if the body starts with it.
  let body = formatted.body;
  const titleLine = new RegExp(`^${escapeRegExp(title)}\\s*\\n+`, 'i');
  body = body.replace(titleLine, '').trim();
  return { title, body };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
