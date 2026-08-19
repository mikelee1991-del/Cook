import { createWorker, OEM, PSM } from 'tesseract.js';
import { rasterizeToCanvas, rotateCanvas } from './imageRaster';
import { prepareOcrCanvas, type OcrVariant } from './ocrPreprocess';
import { cleanupOcrText, ocrTextLooksStrong, ocrTextLooksWeak, scoreOcrResult } from './ocrText';
import { orderClipsForDisplay, sortPageText, type SortedClip } from './recipeSort';

type OcrSource = string | Blob;

interface OcrAttempt {
  text: string;
  confidence: number;
  score: number;
}

const RECOGNIZE_MS = 90_000;

function psmsFor(density: 'print' | 'sparse', split: boolean): PSM[] {
  if (density === 'sparse') {
    return [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK, PSM.AUTO];
  }
  if (split) {
    return [PSM.SINGLE_COLUMN, PSM.SINGLE_BLOCK];
  }
  return [PSM.AUTO, PSM.SINGLE_BLOCK, PSM.SINGLE_COLUMN];
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readCanvas(
  worker: Awaited<ReturnType<typeof createWorker>>,
  canvas: HTMLCanvasElement,
  psm: PSM,
): Promise<{ text: string; confidence: number }> {
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  });
  const result = await withTimeout(
    worker.recognize(canvas, { rotateAuto: true }, { text: true }),
    RECOGNIZE_MS,
    'Text recognition',
  );
  return {
    text: cleanupOcrText(result.data.text || ''),
    confidence: result.data.confidence ?? 0,
  };
}

async function readSlices(
  worker: Awaited<ReturnType<typeof createWorker>>,
  slices: HTMLCanvasElement[],
  psms: PSM[],
  density: 'print' | 'sparse',
): Promise<OcrAttempt> {
  const parts: string[] = [];
  let confSum = 0;
  let confN = 0;
  for (const slice of slices) {
    let best = { text: '', confidence: 0, score: -1 };
    for (const psm of psms) {
      const read = await readCanvas(worker, slice, psm);
      const score = scoreOcrResult(read.text, read.confidence);
      if (score > best.score) best = { ...read, score };
      if (ocrTextLooksStrong(read.text, read.confidence)) break;
      if (density === 'sparse' && score >= 50 && read.confidence >= 38) break;
    }
    if (best.text) parts.push(best.text);
    confSum += best.confidence;
    confN += 1;
  }
  const text = parts.filter(Boolean).join('\n\n');
  const confidence = confN ? confSum / confN : 0;
  return { text, confidence, score: scoreOcrResult(text, confidence) };
}

async function readPageBestEffort(
  worker: Awaited<ReturnType<typeof createWorker>>,
  prep: Awaited<ReturnType<typeof prepareOcrCanvas>>,
  onProgress?: (message: string) => void,
): Promise<OcrAttempt> {
  let best: OcrAttempt = { text: '', confidence: 0, score: -1 };
  const ordered: OcrVariant[] =
    prep.density === 'sparse'
      ? [...prep.variants].sort((a, b) => Number(a.name !== 'handwriting') - Number(b.name !== 'handwriting'))
      : prep.variants;

  for (const variant of ordered) {
    onProgress?.(
      variant.name === 'handwriting'
        ? 'Trying a handwriting pass…'
        : variant.name === 'binary'
            ? 'Trying a high-contrast pass…'
            : variant.slices.length > 1
              ? 'Reading columns…'
              : 'Reading printed text…',
    );
    const attempt = await readSlices(
      worker,
      variant.slices,
      psmsFor(prep.density, variant.slices.length > 1),
      prep.density,
    );
    if (attempt.score > best.score) best = attempt;
    if (ocrTextLooksStrong(attempt.text, attempt.confidence) && attempt.score >= 64) {
      return best;
    }
  }
  return best;
}

export interface ScanPageWarning {
  page: number;
  message: string;
}

export interface RecipeScanResult {
  clips: SortedClip[];
  warnings: ScanPageWarning[];
}

/**
 * OCR recipe photos. Preprocess (scale, contrast, column split, handwriting pass)
 * then try several Tesseract layouts and keep the best text.
 * Pass original File/Blob when available — compressed storage JPEGs lose print detail.
 */
export async function scanImagesForRecipes(
  images: OcrSource[],
  onProgress?: (message: string) => void,
): Promise<SortedClip[]> {
  const { clips } = await scanImagesForRecipesDetailed(images, onProgress);
  return clips;
}

export async function scanImagesForRecipesDetailed(
  images: OcrSource[],
  onProgress?: (message: string) => void,
): Promise<RecipeScanResult> {
  const worker = await createWorker('eng', OEM.LSTM_ONLY);
  const all: SortedClip[] = [];
  const warnings: ScanPageWarning[] = [];

  try {
    for (let i = 0; i < images.length; i++) {
      onProgress?.(`Preparing page ${i + 1} of ${images.length}…`);
      try {
        const raw = await rasterizeToCanvas(images[i]);
        let prep = prepareOcrCanvas(raw);
        let best = await readPageBestEffort(worker, prep, (msg) => {
          onProgress?.(`Page ${i + 1} of ${images.length}: ${msg}`);
        });
        if (ocrTextLooksWeak(best.text, best.confidence) || best.score < 48) {
          for (const deg of [90, 270, 180] as const) {
            onProgress?.(`Page ${i + 1} of ${images.length}: Trying a ${deg}° rotation…`);
            const rotated = prepareOcrCanvas(rotateCanvas(raw, deg));
            const attempt = await readPageBestEffort(worker, rotated);
            if (attempt.score > best.score) best = attempt;
            if (ocrTextLooksStrong(best.text, best.confidence) && best.score >= 64) break;
          }
        }
        const text = best.text;
        if (!text.trim()) {
          warnings.push({
            page: i + 1,
            message: 'No readable text found. Try a straighter, brighter photo of the page.',
          });
          continue;
        }
        all.push(...sortPageText(text, i));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not read text from this photo.';
        warnings.push({ page: i + 1, message });
      }
    }
  } finally {
    await worker.terminate();
  }

  return { clips: orderClipsForDisplay(all), warnings };
}
