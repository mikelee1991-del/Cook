import { isLikelyImageFile } from './imageFiles';
import { rasterizeToCanvas, scaleCanvas } from './imageRaster';

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.78;

export interface CompressFailure {
  name: string;
  reason: string;
}

export interface CompressBatchResult {
  items: Array<{ file: File; dataUrl: string }>;
  failed: CompressFailure[];
}

/** Read a File as a compressed JPEG data URL for local storage. */
export async function compressImageFile(file: File): Promise<string> {
  const raster = await rasterizeToCanvas(file);
  const sized = scaleCanvas(raster, MAX_EDGE, 'down');
  return sized.toDataURL('image/jpeg', JPEG_QUALITY);
}

export async function compressImageBatch(
  files: FileList | File[],
  onProgress?: (done: number, total: number) => void,
): Promise<CompressBatchResult> {
  const list = Array.from(files).filter(isLikelyImageFile);
  const items: CompressBatchResult['items'] = [];
  const failed: CompressFailure[] = [];
  for (let i = 0; i < list.length; i++) {
    try {
      const dataUrl = await compressImageFile(list[i]);
      items.push({ file: list[i], dataUrl });
    } catch (err) {
      failed.push({
        name: list[i].name || `photo ${i + 1}`,
        reason: err instanceof Error ? err.message : 'Could not read this image',
      });
    }
    onProgress?.(i + 1, list.length);
  }
  return { items, failed };
}

export async function compressImageFiles(
  files: FileList | File[],
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const { items, failed } = await compressImageBatch(files, onProgress);
  if (!items.length && failed.length) {
    throw new Error(failed[0].reason);
  }
  return items.map((item) => item.dataUrl);
}
