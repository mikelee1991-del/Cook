import { createWorker, PSM } from 'tesseract.js';
import { prepareImageForOcr } from './ocrPreprocess';
import { cleanupOcrText, ocrTextLooksWeak } from './ocrText';
import { orderClipsForDisplay, sortPageText, type SortedClip } from './recipeSort';

type OcrSource = string | Blob;

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
  const result = await worker.recognize(canvas, { rotateAuto: true });
  return {
    text: cleanupOcrText(result.data.text || ''),
    confidence: result.data.confidence ?? 0,
  };
}

async function readPageBestEffort(
  worker: Awaited<ReturnType<typeof createWorker>>,
  canvas: HTMLCanvasElement,
): Promise<string> {
  const primary = await readCanvas(worker, canvas, PSM.SINGLE_COLUMN);
  if (!ocrTextLooksWeak(primary.text, primary.confidence)) return primary.text;

  const fallback = await readCanvas(worker, canvas, PSM.SINGLE_BLOCK);
  if (fallback.confidence > primary.confidence || fallback.text.length > primary.text.length) {
    return fallback.text;
  }
  return primary.text;
}

/**
 * OCR recipe photos. Preprocess (scale, contrast, column split) before Tesseract.
 * Pass original File/Blob when available — compressed storage JPEGs lose print detail.
 */
export async function scanImagesForRecipes(
  images: OcrSource[],
  onProgress?: (message: string) => void,
): Promise<SortedClip[]> {
  const worker = await createWorker('eng');
  const all: SortedClip[] = [];

  try {
    for (let i = 0; i < images.length; i++) {
      onProgress?.(`Preparing page ${i + 1} of ${images.length}…`);
      const slices = await prepareImageForOcr(images[i]);
      const parts: string[] = [];
      for (let s = 0; s < slices.length; s++) {
        onProgress?.(
          slices.length > 1
            ? `Reading page ${i + 1} (${s === 0 ? 'left' : 'right'} column)…`
            : `Reading page ${i + 1} of ${images.length}…`,
        );
        parts.push(await readPageBestEffort(worker, slices[s]));
      }
      const text = parts.filter(Boolean).join('\n\n');
      all.push(...sortPageText(text, i));
    }
  } finally {
    await worker.terminate();
  }

  return orderClipsForDisplay(all);
}
