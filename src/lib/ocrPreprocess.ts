import { findColumnGutter } from './ocrText';

const TARGET_LONG_EDGE = 2400;
const MAX_LONG_EDGE = 3200;

function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const revoke = typeof src === 'string' ? () => undefined : () => URL.revokeObjectURL(url);
    img.onload = () => {
      revoke();
      resolve(img);
    };
    img.onerror = () => {
      revoke();
      reject(new Error('Could not load image for OCR'));
    };
    img.src = url;
  });
}

function drawScaled(img: HTMLImageElement): HTMLCanvasElement {
  const longEdge = Math.max(img.width, img.height);
  let scale = 1;
  if (longEdge < TARGET_LONG_EDGE) scale = TARGET_LONG_EDGE / longEdge;
  if (longEdge * scale > MAX_LONG_EDGE) scale = MAX_LONG_EDGE / longEdge;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function grayscaleContrast(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  const hist = new Array(256).fill(0);
  const gray = new Uint8Array(canvas.width * canvas.height);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    gray[p] = g;
    hist[g] += 1;
  }

  const total = gray.length;
  let acc = 0;
  let low = 0;
  let high = 255;
  const loCut = total * 0.02;
  const hiCut = total * 0.98;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= loCut && low === 0) low = i;
    if (acc >= hiCut) {
      high = i;
      break;
    }
  }
  if (high <= low + 8) {
    low = 0;
    high = 255;
  }
  const scale = 255 / (high - low);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = Math.max(0, Math.min(255, Math.round((gray[p] - low) * scale)));
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
}

function inkHistogram(canvas: HTMLCanvasElement): number[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const ink = new Array(canvas.width).fill(0);
  const threshold = 140;
  const top = Math.round(canvas.height * 0.08);
  const bottom = Math.round(canvas.height * 0.92);
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      if (data[i] < threshold) ink[x] += 1;
    }
  }
  return ink;
}

function cropCanvas(
  source: HTMLCanvasElement,
  left: number,
  top: number,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(source, left, top, width, height, 0, 0, width, height);
  return canvas;
}

function splitIfTwoColumns(canvas: HTMLCanvasElement): HTMLCanvasElement[] {
  const gutter = findColumnGutter(inkHistogram(canvas));
  if (gutter == null) return [canvas];
  const pad = Math.round(canvas.width * 0.015);
  const left = cropCanvas(canvas, 0, 0, Math.max(1, gutter - pad), canvas.height);
  const right = cropCanvas(
    canvas,
    Math.min(canvas.width - 1, gutter + pad),
    0,
    Math.max(1, canvas.width - gutter - pad),
    canvas.height,
  );
  return [left, right];
}

/** High-res grayscale slices for Tesseract. Two-column pages become two images. */
export async function prepareImageForOcr(src: string | Blob): Promise<HTMLCanvasElement[]> {
  const img = await loadImage(src);
  const scaled = drawScaled(img);
  grayscaleContrast(scaled);
  return splitIfTwoColumns(scaled);
}
