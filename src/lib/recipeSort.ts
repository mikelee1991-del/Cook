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
  /\b(ingredients?|directions?|instructions?|method|preparation|preheat|bake|roast|simmer|whisk|tablespoons?|teaspoons?|cups?|serves?|servings?|minutes?|oven|°[cf]|degrees)\b/i;

const MEASURE =
  /\b(\d+\/\d+|\d+(\.\d+)?)\s?(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lb|lbs|pounds?|g|kg|ml|l|cloves?|cans?|sticks?)\b/i;

const STEP_LINE = /^\s*(\d+[).]|step\s*\d+|•|-)\s+/i;

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
  const stepHits = lines.filter((l) => STEP_LINE.test(l)).length;
  score += Math.min(0.2, stepHits * 0.05);
  if (/\bingredients?\b/i.test(text) && /\b(directions?|instructions?|method)\b/i.test(text)) {
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
      !/^(ingredients?|directions?|instructions?|method)\b/i.test(l),
  );
  return heading || lines[0]?.slice(0, 72) || 'Untitled clip';
}

/**
 * Split OCR text into candidate blocks, then classify each as recipe vs other.
 * Multiple recipes on one page become separate recipe clips.
 */
export function sortPageText(ocrText: string, sourceImageIndex: number): SortedClip[] {
  const cleaned = ocrText.replace(/\r/g, '').trim();
  if (!cleaned) return [];

  const rawBlocks = splitIntoBlocks(cleaned);
  const clips: SortedClip[] = [];

  rawBlocks.forEach((block, i) => {
    const body = block.trim();
    if (body.length < 12) return;
    const confidence = scoreRecipeLikelihood(body);
    const kind: ClipKind = confidence >= 0.42 ? 'recipe' : 'other';
    clips.push({
      id: clipId(`img${sourceImageIndex}`, i),
      kind,
      title: titleFromBlock(body),
      body,
      confidence,
      sourceImageIndex,
    });
  });

  return mergeTinyOthers(clips);
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

  // If still one huge block, split on lines that look like new titles (short Title Case lines)
  if (blocks.length === 1 && blocks[0].split(/\n/).length > 25) {
    blocks = splitByTitleLines(blocks[0]);
  }

  return blocks;
}

function splitByTitleLines(text: string): string[] {
  const lines = text.split(/\n/);
  const chunks: string[] = [];
  let current: string[] = [];

  const isTitleLine = (line: string) => {
    const t = line.trim();
    if (t.length < 4 || t.length > 60) return false;
    if (MEASURE.test(t) || STEP_LINE.test(t)) return false;
    if (/^(ingredients?|directions?|instructions?|method|notes?)\b/i.test(t)) return false;
    const letters = t.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 4) return false;
    const caps = letters.replace(/[^A-Z]/g, '').length;
    return caps / letters.length >= 0.45 || /^[A-Z][a-z].+[a-z]$/.test(t);
  };

  for (const line of lines) {
    if (isTitleLine(line) && current.length > 6) {
      chunks.push(current.join('\n').trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) chunks.push(current.join('\n').trim());
  return chunks.filter((c) => c.length > 12);
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
