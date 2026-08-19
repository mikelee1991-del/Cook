import { formatRecipeClipBody } from './recipeFormat';
import { dropLeadingOrphanCopy, stripScanChrome } from './ocrText';

export type ClipKind = 'recipe' | 'other';

export interface SortedClip {
  id: string;
  kind: ClipKind;
  title: string;
  body: string;
  /** 0–1 heuristic confidence that kind is correct */
  confidence: number;
  sourceImageIndex: number;
}

const RECIPE_HINTS =
  /\b(ingredients?|ingredlents|lngredients|directions?|directlons|instructions?|instructlons|method|preparation|preheat|prebeat|bake|roast|simmer|whisk|tablespoons?|teaspoons?|tbsp|tsp|cups?|serves?|servings?|minutes?|oven|°[cf]|degrees)\b/i;

const MEASURE =
  /\b(\d+\/\d+|\d+(\.\d+)?)\s?(cups?|c\.|c|tbsp|tsp|tbs\.?|tablespoons?|teaspoons?|oz|ounces?|lb|lbs\.?|pounds?|g|kg|ml|l|cloves?|cans?|sticks?|gallon|packages?|bottle)\b/i;

const STEP_LINE = /^\s*(\d+[).]|[lI][).]|step\s*\d+|•|-)\s+/i;

const SECTION_HEADER =
  /^(ingredients?|ingredlents|lngredients|directions?|directlons|instructions?|instructlons|method|preparation|notes?|serves?)\b/i;

const COMPONENT_HEAD =
  /^(dipping sauce|coating|frosting|marinade|sauce|garnish|filling|for the\b)/i;

function clipId(prefix: string, n: number): string {
  return `${prefix}-${n}-${Math.random().toString(36).slice(2, 7)}`;
}

function scoreRecipeLikelihood(text: string): number {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return 0.1;

  let score = 0;
  if (RECIPE_HINTS.test(text)) score += 0.35;
  const measureHits = lines.filter((l) => MEASURE.test(l)).length;
  score += Math.min(0.35, measureHits * 0.07);
  if (measureHits >= 2) score += 0.12;
  const stepHits = lines.filter((l) => STEP_LINE.test(l)).length;
  score += Math.min(0.2, stepHits * 0.05);
  if (
    /\b(ingredients?|ingredlents|lngredients)\b/i.test(text) &&
    /\b(directions?|directlons|instructions?|instructlons|method)\b/i.test(text)
  ) {
    score += 0.2;
  }
  return Math.max(0, Math.min(1, score));
}

function titleFromBlock(text: string): string {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const heading = lines.find(
    (l) =>
      l.length > 2 &&
      l.length < 80 &&
      !MEASURE.test(l) &&
      !STEP_LINE.test(l) &&
      !SECTION_HEADER.test(l),
  );
  return heading || lines[0]?.slice(0, 72) || 'Untitled clip';
}

/**
 * Split OCR text into candidate blocks, then classify each as recipe vs other.
 * Multiple recipes on one page become separate recipe clips.
 */
export function sortPageText(ocrText: string, sourceImageIndex: number): SortedClip[] {
  const cleaned = dropLeadingOrphanCopy(stripScanChrome(ocrText.replace(/\r/g, ''))).trim();
  if (!cleaned) return [];

  const rawBlocks = coalesceRecipeFragments(splitIntoBlocks(cleaned));
  const clips: SortedClip[] = [];

  rawBlocks.forEach((block, i) => {
    const body = block.trim();
    if (body.length < 12) return;
    const confidence = scoreRecipeLikelihood(body);
    const kind: ClipKind = confidence >= 0.38 ? 'recipe' : 'other';
    if (kind === 'recipe') {
      const readable = formatRecipeClipBody(body);
      clips.push({
        id: clipId(`img${sourceImageIndex}`, i),
        kind,
        title: readable.title,
        body: readable.body,
        confidence,
        sourceImageIndex,
      });
      return;
    }
    clips.push({
      id: clipId(`img${sourceImageIndex}`, i),
      kind,
      title: titleFromBlock(body),
      body: body.replace(/\n{3,}/g, '\n\n').trim(),
      confidence,
      sourceImageIndex,
    });
  });

  return absorbStrayIngredients(mergeTinyOthers(clips)).map((clip) => {
    if (clip.kind !== 'recipe') return clip;
    const readable = formatRecipeClipBody(clip.body, clip.title);
    return { ...clip, title: readable.title, body: readable.body };
  });
}

function splitIntoBlocks(text: string): string[] {
  // First split on blank lines
  let blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  // Further split when a new "Ingredients" section appears mid-block (multi-recipe pages)
  const expanded: string[] = [];
  for (const block of blocks) {
    const parts = block.split(
      /(?=\n(?=[A-Z][^\n]{0,60}\n+\s*ingredients?\b))/i,
    );
    if (parts.length > 1) {
      expanded.push(...parts.map((p) => p.trim()).filter(Boolean));
    } else {
      // Also split on repeated Ingredients headers
      const byIngredients = block.split(/(?=\bingredients?\b)/i);
      if (byIngredients.length > 2) {
        // keep preamble with first ingredients; each later ingredients starts new block
        const [first, ...rest] = byIngredients;
        const chunks: string[] = [];
        let current = first;
        for (const piece of rest) {
          if (/\bingredients?\b/i.test(piece) && current.trim().length > 40) {
            chunks.push(current.trim());
            current = piece;
          } else {
            current += piece;
          }
        }
        if (current.trim()) chunks.push(current.trim());
        expanded.push(...chunks.filter(Boolean));
      } else {
        expanded.push(block);
      }
    }
  }

  blocks = expanded;

  if (blocks.length === 1 && blocks[0].split(/\n/).length > 12) {
    blocks = splitByTitleLines(blocks[0]);
  }

  return blocks.flatMap((block) =>
    block.split(/\n/).length > 14 ? splitByTitleLines(block) : [block],
  );
}

const QUANTITY_LINE = /^\s*\d+([/.]\d+)?\s+[A-Za-z]/;

function looksLikeNewRecipe(block: string): boolean {
  const lines = block
    .trim()
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return false;
  if (COMPONENT_HEAD.test(lines[0])) return false;
  if (/^[A-Z][A-Za-z].{1,50}$/.test(lines[0]) && SECTION_HEADER.test(lines[1])) return true;
  if (/^[A-Z][A-Za-z].{1,50}$/.test(lines[0]) && /\bingredients?\b/i.test(block) && MEASURE.test(block)) {
    return true;
  }
  // Second recipe on a page often has no Ingredients header — just a title then quantities.
  if (
    isHeadingLine(lines[0]) &&
    QUANTITY_LINE.test(lines[1]) &&
    lines.filter((l) => MEASURE.test(l) || QUANTITY_LINE.test(l)).length >= 2
  ) {
    return true;
  }
  return false;
}

function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 4 || t.length > 72) return false;
  if (MEASURE.test(t) || STEP_LINE.test(t) || SECTION_HEADER.test(t) || COMPONENT_HEAD.test(t)) {
    return false;
  }
  const letters = t.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 4) return false;
  const caps = letters.replace(/[^A-Z]/g, '').length;
  return caps / letters.length >= 0.45 || /^[A-Z][a-z].+[a-z]$/.test(t);
}

function isRecipeFragment(block: string): boolean {
  const t = block.trim();
  if (!t || looksLikeNewRecipe(t)) return false;
  if (MEASURE.test(t) || STEP_LINE.test(t) || QUANTITY_LINE.test(t)) return true;
  if (SECTION_HEADER.test(t)) return true;
  return RECIPE_HINTS.test(t) && t.length < 90 && t.split('\n').length <= 4;
}

function looksLikeRecipeStart(block: string): boolean {
  return RECIPE_HINTS.test(block) || MEASURE.test(block) || QUANTITY_LINE.test(block);
}

function isContinuationLine(block: string): boolean {
  const t = block.trim();
  if (!t || looksLikeNewRecipe(t) || t.length > 90 || t.split('\n').length > 3) return false;
  if (/^[A-Z][A-Za-z][A-Za-z ',-]{2,40}$/.test(t) && !/,/.test(t)) return false;
  return true;
}

/** Tesseract often emits each ingredient as its own blank-line block. Glue those back. */
function coalesceRecipeFragments(blocks: string[]): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    const prev = out[out.length - 1];
    const prevShort = Boolean(prev && prev.length < 2200 && prev.split('\n').length < 55);
    const glue =
      prev &&
      prevShort &&
      !looksLikeNewRecipe(block) &&
      (isRecipeFragment(block) || (looksLikeRecipeStart(prev) && isContinuationLine(block)));
    if (glue) {
      out[out.length - 1] = `${prev}\n${block}`;
    } else {
      out.push(block);
    }
  }
  return out;
}

function splitByTitleLines(text: string): string[] {
  const lines = text.split(/\n/);
  const chunks: string[] = [];
  let current: string[] = [];

  const isTitleLine = (line: string) => {
    if (COMPONENT_HEAD.test(line.trim())) return false;
    return isHeadingLine(line);
  };

  for (const line of lines) {
    if (isTitleLine(line) && current.length > 6) {
      const soFar = current.join('\n');
      const hadCookSteps =
        /\b(directions?|instructions?|method|preparation|step\s*\d)\b/i.test(soFar) ||
        current.filter((l) => STEP_LINE.test(l)).length >= 1 ||
        current.join(' ').length > 280;
      if (hadCookSteps) {
        chunks.push(current.join('\n').trim());
        current = [line];
        continue;
      }
    }
    current.push(line);
  }
  if (current.length) chunks.push(current.join('\n').trim());
  return chunks.filter((c) => c.length > 12);
}

function strayIngredientClip(clip: SortedClip): boolean {
  if (clip.body.length >= 140) return false;
  const lines = clip.body.split(/\n/).filter((l) => l.trim());
  if (lines.length > 3) return false;
  return MEASURE.test(clip.body) || QUANTITY_LINE.test(clip.body) || STEP_LINE.test(clip.body);
}

function isOrphanTitle(clip: SortedClip): boolean {
  if (clip.kind === 'recipe') return false;
  const lines = clip.body
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length !== 1) return false;
  const t = lines[0];
  if (t.length < 3 || t.length > 72) return false;
  if (MEASURE.test(t) || STEP_LINE.test(t) || SECTION_HEADER.test(t) || QUANTITY_LINE.test(t)) {
    return false;
  }
  return true;
}

/** Pull leftover ingredient/step lines into the neighboring recipe on the same page. */
function absorbStrayIngredients(clips: SortedClip[]): SortedClip[] {
  const out: SortedClip[] = [];
  for (const clip of clips) {
    const prev = out[out.length - 1];
    if (
      prev &&
      isOrphanTitle(prev) &&
      clip.kind === 'recipe' &&
      clip.sourceImageIndex === prev.sourceImageIndex
    ) {
      const title = prev.body.trim().split(/\n/)[0].trim();
      const readable = formatRecipeClipBody(clip.body, title);
      out[out.length - 1] = {
        ...clip,
        title: readable.title,
        body: readable.body,
      };
      continue;
    }
    if (
      prev?.kind === 'recipe' &&
      clip.kind === 'other' &&
      clip.sourceImageIndex === prev.sourceImageIndex &&
      strayIngredientClip(clip)
    ) {
      const readable = formatRecipeClipBody(`${prev.body}\n${clip.body}`, prev.title);
      prev.body = readable.body;
      prev.title = readable.title;
      continue;
    }
    if (
      clip.kind === 'recipe' &&
      prev?.kind === 'other' &&
      prev.sourceImageIndex === clip.sourceImageIndex &&
      strayIngredientClip(prev)
    ) {
      const readable = formatRecipeClipBody(`${prev.body}\n${clip.body}`, clip.title);
      out[out.length - 1] = {
        ...clip,
        title: readable.title,
        body: readable.body,
      };
      continue;
    }
    out.push(clip);
  }
  return out;
}

function mergeTinyOthers(clips: SortedClip[]): SortedClip[] {
  const out: SortedClip[] = [];
  for (const clip of clips) {
    const prev = out[out.length - 1];
    if (
      clip.kind === 'other' &&
      prev?.kind === 'other' &&
      clip.sourceImageIndex === prev.sourceImageIndex &&
      clip.body.length < 80
    ) {
      prev.body = `${prev.body}\n\n${clip.body}`.trim();
      prev.title = prev.title || clip.title;
      continue;
    }
    out.push(clip);
  }
  return out;
}

/** Sort clips for display: recipes first (by confidence), then other text. */
export function orderClipsForDisplay(clips: SortedClip[]): SortedClip[] {
  return [...clips].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'recipe' ? -1 : 1;
    return b.confidence - a.confidence;
  });
}
