/**
 * Find a two-column gutter from a per-x ink histogram (dark-pixel counts).
 * Returns the split x, or null if the page looks like a single column.
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
  return bestX;
}

/** Common Tesseract mistakes on printed recipe pages. */
export function cleanupOcrText(raw: string): string {
  let text = raw.replace(/\r/g, '').split('\f').join('').trim();
  if (!text) return '';

  text = text.replace(/(\w)-\n(\w)/g, '$1$2');
  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');

  const lines = text.split('\n').map((line) =>
    line
      .replace(/\b(tosp|tbso|tbs|tbi)\b/gi, 'tbsp')
      .replace(/\b(tspn|tso)\b/gi, 'tsp')
      .replace(/\b(cujp|cupS)\b/g, 'cup')
      .replace(/\b0z\b/g, 'oz')
      .replace(/\blb[s5]\b/gi, 'lbs')
      .replace(/(\d)\s+\/\s+(\d)/g, '$1/$2')
      .replace(/[ \t]{2,}/g, ' ')
      .trimEnd(),
  );

  return lines.join('\n').trim();
}

export function ocrTextLooksWeak(text: string, confidence: number): boolean {
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  const words = text.trim().split(/\s+/).filter((w) => w.length > 1);
  if (confidence < 48) return true;
  if (letters < 40) return true;
  if (words.length < 8) return true;
  const junk = (text.match(/[^A-Za-z0-9\s.,;:/'"°%$()-]/g) || []).length;
  return junk / Math.max(text.length, 1) > 0.18;
}
