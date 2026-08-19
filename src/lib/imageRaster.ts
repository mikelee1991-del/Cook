import { heicHint, isHeicLike } from './imageFiles';

async function blobFromSource(src: string | Blob): Promise<Blob> {
  if (typeof src !== 'string') return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error('Could not load image');
  return res.blob();
}

function canvasFromBitmap(bitmap: ImageBitmap): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, bitmap.width);
  canvas.height = Math.max(1, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas unavailable');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

function loadViaImageElement(blob: Blob): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, img.naturalWidth || img.width);
        canvas.height = Math.max(1, img.naturalHeight || img.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image'));
    };
    img.src = url;
  });
}

/**
 * Draw a photo onto a canvas, honoring EXIF orientation when the browser allows it.
 */
export async function rasterizeToCanvas(src: string | Blob): Promise<HTMLCanvasElement> {
  const blob = await blobFromSource(src);
  try {
    const bitmap = await createImageBitmap(blob, {
      imageOrientation: 'from-image',
    } as ImageBitmapOptions);
    return canvasFromBitmap(bitmap);
  } catch {
    try {
      return await loadViaImageElement(blob);
    } catch (err) {
      const name = src instanceof File ? src.name : 'Photo';
      if (isHeicLike(src instanceof File ? src : { type: blob.type, name })) {
        throw new Error(heicHint(name));
      }
      throw err instanceof Error ? err : new Error('Could not decode image');
    }
  }
}

/** Clockwise rotation for pages photographed sideways. */
export function rotateCanvas(source: HTMLCanvasElement, degrees: 90 | 180 | 270): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  if (degrees === 90 || degrees === 270) {
    canvas.width = source.height;
    canvas.height = source.width;
  } else {
    canvas.width = source.width;
    canvas.height = source.height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

export function scaleCanvas(
  source: HTMLCanvasElement,
  maxEdge: number,
  mode: 'down' | 'fit' = 'down',
): HTMLCanvasElement {
  const longEdge = Math.max(source.width, source.height);
  let scale = 1;
  if (mode === 'down') {
    if (longEdge > maxEdge) scale = maxEdge / longEdge;
  } else if (longEdge !== maxEdge) {
    scale = maxEdge / longEdge;
  }
  if (Math.abs(scale - 1) < 0.01) return source;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
