import { createWorker } from 'tesseract.js';
import { orderClipsForDisplay, sortPageText, type SortedClip } from './recipeSort';

export async function scanImagesForRecipes(
  images: string[],
  onProgress?: (message: string) => void,
): Promise<SortedClip[]> {
  const worker = await createWorker('eng');
  const all: SortedClip[] = [];

  try {
    for (let i = 0; i < images.length; i++) {
      onProgress?.(`Reading page ${i + 1} of ${images.length}…`);
      const result = await worker.recognize(images[i]);
      const clips = sortPageText(result.data.text || '', i);
      all.push(...clips);
    }
  } finally {
    await worker.terminate();
  }

  return orderClipsForDisplay(all);
}
