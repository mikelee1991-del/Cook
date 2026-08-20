import { sourceToVisionImage, visionJson } from './visionClient';
import { orderClipsForDisplay, type SortedClip } from './recipeSort';
import { clipsFromVisionPage, RECIPE_VISION_PROMPT, type RawVisionPage } from './visionRecipes';
import { pantryVisionPrompt, resolveIdentifiedItems, mergeIdentifiedItems, type IdentifiedPantryItem, type RawVisionPantryItem } from './visionPantry';

type OcrSource = string | Blob;

export interface ScanPageWarning {
  page: number;
  message: string;
}

export interface RecipeScanResult {
  clips: SortedClip[];
  warnings: ScanPageWarning[];
}

/**
 * Read recipe photos with a vision model — layout, handwriting, dish photos,
 * and packaging of the page — then return cookable clips.
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
  const all: SortedClip[] = [];
  const warnings: ScanPageWarning[] = [];

  for (let i = 0; i < images.length; i++) {
    onProgress?.(`Looking at page ${i + 1} of ${images.length}…`);
    try {
      const visionImage = await sourceToVisionImage(images[i]);
      const page = await visionJson<RawVisionPage>(RECIPE_VISION_PROMPT, [visionImage]);
      const clips = clipsFromVisionPage(page, i);
      if (!clips.length) {
        warnings.push({
          page: i + 1,
          message: 'No recipe found on this photo. Try a straighter shot of the full card or page.',
        });
        continue;
      }
      all.push(...clips);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read this photo.';
      warnings.push({ page: i + 1, message });
    }
  }

  return { clips: orderClipsForDisplay(all), warnings };
}

export async function identifyPantryPhotos(
  images: OcrSource[],
  onProgress?: (message: string) => void,
): Promise<{ items: IdentifiedPantryItem[]; warnings: ScanPageWarning[] }> {
  const merged: IdentifiedPantryItem[][] = [];
  const warnings: ScanPageWarning[] = [];
  const prompt = pantryVisionPrompt();

  for (let i = 0; i < images.length; i++) {
    onProgress?.(`Looking at shelf photo ${i + 1} of ${images.length}…`);
    try {
      const visionImage = await sourceToVisionImage(images[i]);
      const page = await visionJson<{ items?: RawVisionPantryItem[] }>(prompt, [visionImage]);
      const items = resolveIdentifiedItems(Array.isArray(page.items) ? page.items : []);
      if (!items.length) {
        warnings.push({
          page: i + 1,
          message: 'No groceries matched on this photo. Try a closer shot of labels or produce.',
        });
        continue;
      }
      merged.push(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not identify this photo.';
      warnings.push({ page: i + 1, message });
    }
  }

  return { items: mergeIdentifiedItems(merged), warnings };
}
