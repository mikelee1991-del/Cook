/**
 * OCR text scoring, cleanup, and layout hints for recipe-page scans.
 */

/**
 * Find a two-column gutter from a per-x ink histogram (dark-pixel counts).
 * Returns the split x, or null if the page looks like a single column.
 *
 * Handwritten notes and sparse cards often have a wide empty middle — that is
 * not a gutter, and splitting there cuts lines in half.
 */
export function findColumnGutter(ink: number[]): number | null {
  const width = ink.length;
  if (width < 80) return null;

  const radius = Math.max(2, Math.round(width / 80));
  const smooth = ink.map((_, x) => {
    let sum = 0;
    let n = 0;
    for (let i = x - radius; i <= x + radius; i++) {
      if (i < 0 || i >= width) continue;
      sum += ink[i];
      n += 1;
    }
    return sum / n;
  });

  const leftBound = Math.round(width * 0.28);
  const rightBound = Math.round(width * 0.72);
  const peak = Math.max(...smooth);
  if (peak < 8) return null;

  const totalMass = smooth.reduce((s, v) => s + v, 0);
  if (totalMass < peak * 8) return null;

  let bestX = -1;
  let bestScore = 0;
  for (let x = leftBound; x <= rightBound; x++) {
    const leftPeak = Math.max(...smooth.slice(0, x));
    const rightPeak = Math.max(...smooth.slice(x));
    if (leftPeak < peak * 0.35 || rightPeak < peak * 0.35) continue;
    const valley = smooth[x];
    const score = Math.min(leftPeak, rightPeak) / Math.max(valley, 1);
    if (score > bestScore) {
      bestScore = score;
      bestX = x;
    }
  }

  if (bestX < 0 || bestScore < 2.4) return null;
  const minSide = Math.round(width * 0.22);
  if (bestX < minSide || width - bestX < minSide) return null;

  const leftMass = smooth.slice(0, bestX).reduce((s, v) => s + v, 0);
  const rightMass = smooth.slice(bestX).reduce((s, v) => s + v, 0);
  if (leftMass < totalMass * 0.22 || rightMass < totalMass * 0.22) return null;

  const cutoff = Math.max(peak * 0.22, 1);
  let lo = bestX;
  let hi = bestX;
  while (lo > 0 && smooth[lo] <= cutoff) lo -= 1;
  while (hi < width - 1 && smooth[hi] <= cutoff) hi += 1;
  if (hi - lo > width * 0.14) return null;

  return bestX;
}

export type PageDensity = 'print' | 'sparse';

export function pageDensityFromInk(inkRatio: number, peakNormalized: number): PageDensity {
  if (inkRatio < 0.045 && peakNormalized < 0.22) return 'sparse';
  if (inkRatio < 0.028) return 'sparse';
  return 'print';
}

export function pageLooksDark(meanLuma: number): boolean {
  return meanLuma < 92;
}

const RECIPE_TERMS =
  /\b(ingredients?|ingred|directions?|directlons|instructions?|instruct|method|preparation|preheat|bake|roast|simmer|whisk|tablespoons?|teaspoons?|tbsp|tsp|cups?|serves?|servings?|minutes?|mins?\b|oven|flour|sugar|salt|butter|garlic|onion|chicken|°[cf]|degrees)\b/i;

/** Score an OCR candidate 0–100. Higher means keep this pass. */
export function scoreOcrResult(text: string, confidence: number): number {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 0;
  const letters = (cleaned.match(/[A-Za-z]/g) || []).length;
  const digits = (cleaned.match(/\d/g) || []).length;
  const words = cleaned.split(/\s+/).filter((w) => w.length > 1);
  const junk = (cleaned.match(/[^A-Za-z0-9\s.,;:/'"°%$()-]/g) || []).length;
  const junkRatio = junk / Math.max(cleaned.length, 1);

  let score = confidence * 0.42;
  score += Math.min(26, letters / 7);
  score += Math.min(10, words.length / 2);
  score += Math.min(12, digits * 0.7);
  score -= junkRatio * 45;
  if (RECIPE_TERMS.test(cleaned)) score += 14;
  if (/\b(\d+\/\d+|\d+)\s?(cups?|tbsp|tsp|oz|lb)\b/i.test(cleaned)) score += 8;
  if (letters < 20) score -= 22;
  if (words.length < 4) score -= 10;
  return Math.max(0, Math.min(100, score));
}

export function ocrTextLooksStrong(text: string, confidence: number): boolean {
  return scoreOcrResult(text, confidence) >= 64;
}

export function ocrTextLooksWeak(text: string, confidence: number): boolean {
  return scoreOcrResult(text, confidence) < 38;
}

function fixCommonGlyphs(line: string): string {
  return line
    .replace(/\b(tosp|tbso|tbs|tbi)\b/gi, 'tbsp')
    .replace(/\b(tspn|tso)\b/gi, 'tsp')
    .replace(/\b(cujp|cupS)\b/g, 'cup')
    .replace(/\b0z\b/g, 'oz')
    .replace(/\blb[s5]\b/gi, 'lbs')
    .replace(/\blngredients\b/gi, 'Ingredients')
    .replace(/\b1ngredients\b/gi, 'Ingredients')
    .replace(/\bingredlents\b/gi, 'Ingredients')
    .replace(/\blnstructions\b/gi, 'Instructions')
    .replace(/\binstructlons\b/gi, 'Instructions')
    .replace(/\bdirectlons\b/gi, 'Directions')
    .replace(/\bprebeat\b/gi, 'Preheat')
    .replace(/\btablesp\b/gi, 'tablespoon')
    .replace(/\bteasp\b/gi, 'teaspoon')
    .replace(/\b[lI]\s+(tsp|tbsp|cup|cups|oz|lb|lbs)\b/g, '1 $1')
    .replace(/\b[lI]\/(\d)/g, '1/$1')
    .replace(/(\d)\s+\/\s+(\d)/g, '$1/$2')
    .replace(/[ \t]{2,}/g, ' ');
}

/** Common Tesseract mistakes on printed and handwritten recipe pages. */
export function cleanupOcrText(raw: string): string {
  let text = raw.replace(/\r/g, '').split('\f').join('').trim();
  if (!text) return '';

  text = text.replace(/(\w)-\n(\w)/g, '$1$2');
  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');

  const lines = text.split('\n').map((line) => fixCommonGlyphs(line).trimEnd());
  return lines.join('\n').trim();
}
