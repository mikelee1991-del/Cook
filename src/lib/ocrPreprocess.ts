import { rasterizeToCanvas, rotateCanvas, scaleCanvas } from './imageRaster';
import {
  findColumnGutter,
  pageDensityFromInk,
  pageLooksDark,
  type PageDensity,
} from './ocrText';

const TARGET_LONG_EDGE = 2400;
const SPARSE_LONG_EDGE = 2800;
const MAX_LONG_EDGE = 3200;

export interface OcrVariant {
  name: string;
  slices: HTMLCanvasElement[];
}

export interface OcrPagePrep {
  density: PageDensity;
  darkBackground: boolean;
  variants: OcrVariant[];
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
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

function invertCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  ctx.putImageData(image, 0, 0);
}

/** Local-mean binarize (fast integral image). Helps handwriting and uneven lighting. */
export function adaptiveBinarize(canvas: HTMLCanvasElement, invert = false): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = image;
  const gray = new Uint8Array(width * height);
  let lumaSum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    gray[p] = invert ? 255 - g : g;
    lumaSum += gray[p];
  }

  const w1 = width + 1;
  const integral = new Float64Array((height + 1) * w1);
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += gray[y * width + x];
      integral[(y + 1) * w1 + (x + 1)] = integral[y * w1 + (x + 1)] + row;
    }
  }

  const win = Math.max(18, Math.round(Math.min(width, height) / 36));
  const meanLuma = lumaSum / gray.length;
  const bias = meanLuma > 140 ? 8 : 5;

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - win);
    const y1 = Math.min(height - 1, y + win);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - win);
      const x1 = Math.min(width - 1, x + win);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * w1 + (x1 + 1)] -
        integral[y0 * w1 + (x1 + 1)] -
        integral[(y1 + 1) * w1 + x0] +
        integral[y0 * w1 + x0];
      const mean = sum / area;
      const dark = gray[y * width + x] < mean - bias;
      const v = dark ? 0 : 255;
      const i = (y * width + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** 1px dilate of dark ink — thickens pencil/pen strokes for Tesseract. */
export function thickenInk(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out = ctx.createImageData(src);
  const { width, height, data } = src;
  const od = out.data;
  const isDark = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    return data[(y * width + x) * 4] < 128;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dark =
        isDark(x, y) ||
        isDark(x - 1, y) ||
        isDark(x + 1, y) ||
        isDark(x, y - 1) ||
        isDark(x, y + 1);
      const v = dark ? 0 : 255;
      const i = (y * width + x) * 4;
      od[i] = v;
      od[i + 1] = v;
      od[i + 2] = v;
      od[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

function inkHistogram(canvas: HTMLCanvasElement): number[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const ink = new Array(width).fill(0);
  const threshold = 140;
  const top = Math.round(height * 0.08);
  const bottom = Math.round(height * 0.92);
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i] < threshold) ink[x] += 1;
    }
  }
  return ink;
}

/** Dark-pixel counts per row — used to find a horizontal Ingredients / Directions split. */
export function rowInkHistogram(canvas: HTMLCanvasElement): number[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const ink = new Array(height).fill(0);
  const threshold = 140;
  const left = Math.round(width * 0.08);
  const right = Math.round(width * 0.92);
  for (let y = 0; y < height; y++) {
    for (let x = left; x < right; x++) {
      const i = (y * width + x) * 4;
      if (data[i] < threshold) ink[y] += 1;
    }
  }
  return ink;
}

function lumaStats(canvas: HTMLCanvasElement): { mean: number; inkRatio: number; peakNorm: number } {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { mean: 128, inkRatio: 0, peakNorm: 0 };
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0;
  let dark = 0;
  const n = width * height;
  const colInk = new Array(width).fill(0);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = data[i];
    sum += g;
    if (g < 140) {
      dark += 1;
      colInk[p % width] += 1;
    }
  }
  const peak = Math.max(1, ...colInk);
  return {
    mean: sum / n,
    inkRatio: dark / n,
    peakNorm: peak / height,
  };
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

function splitAtGutter(canvas: HTMLCanvasElement, gutter: number | null): HTMLCanvasElement[] {
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

/**
 * Printed cards often put ingredients in two columns, or ingredients on the left
 * and directions on the right. A mid-page horizontal rule (Ingredients vs Directions)
 * must be split first, or a full-height column cut bisects the steps.
 */
export function sliceRecipeLayout(canvas: HTMLCanvasElement, density: PageDensity): HTMLCanvasElement[] {
  if (density === 'sparse') return [canvas];
  const rowGutter = findColumnGutter(rowInkHistogram(canvas));
  if (rowGutter != null) {
    const padY = Math.max(4, Math.round(canvas.height * 0.01));
    const top = cropCanvas(canvas, 0, 0, canvas.width, Math.max(1, rowGutter - padY));
    const bottom = cropCanvas(
      canvas,
      0,
      Math.min(canvas.height - 1, rowGutter + padY),
      canvas.width,
      Math.max(1, canvas.height - rowGutter - padY),
    );
    return [
      ...splitAtGutter(top, findColumnGutter(inkHistogram(top))),
      ...splitAtGutter(bottom, findColumnGutter(inkHistogram(bottom))),
    ];
  }
  return splitAtGutter(canvas, findColumnGutter(inkHistogram(canvas)));
}

function splitIfTwoColumns(canvas: HTMLCanvasElement, density: PageDensity): HTMLCanvasElement[] {
  return sliceRecipeLayout(canvas, density);
}

function fitForOcr(source: HTMLCanvasElement, density: PageDensity): HTMLCanvasElement {
  const target = density === 'sparse' ? SPARSE_LONG_EDGE : TARGET_LONG_EDGE;
  const longEdge = Math.max(source.width, source.height);
  if (longEdge < target) return scaleCanvas(source, Math.min(target, MAX_LONG_EDGE), 'fit');
  if (longEdge > MAX_LONG_EDGE) return scaleCanvas(source, MAX_LONG_EDGE, 'down');
  return source;
}

/** High-res grayscale slices plus extra passes for handwriting / odd layouts. */
export async function prepareImageForOcr(src: string | Blob): Promise<HTMLCanvasElement[]> {
  const prep = await prepareOcrPage(src);
  return prep.variants[0]?.slices ?? [];
}

export async function prepareOcrPage(src: string | Blob): Promise<OcrPagePrep> {
  const raw = await rasterizeToCanvas(src);
  return prepareOcrCanvas(raw);
}

export function prepareOcrCanvas(raw: HTMLCanvasElement): OcrPagePrep {
  const probe = scaleCanvas(raw, 480, 'down');
  grayscaleContrast(probe);
  const stats = lumaStats(probe);
  const density = pageDensityFromInk(stats.inkRatio, stats.peakNorm);
  const darkBackground = pageLooksDark(stats.mean);

  const fitted = fitForOcr(raw, density);
  const contrast = cloneCanvas(fitted);
  grayscaleContrast(contrast);
  if (darkBackground) invertCanvas(contrast);

  const variants: OcrVariant[] = [
    {
      name: density === 'sparse' ? 'sparse-contrast' : 'contrast',
      slices: splitIfTwoColumns(contrast, density),
    },
  ];

  const binary = cloneCanvas(fitted);
  grayscaleContrast(binary);
  if (darkBackground) invertCanvas(binary);
  adaptiveBinarize(binary, false);
  if (density === 'sparse') thickenInk(binary);
  variants.push({
    name: density === 'sparse' ? 'handwriting' : 'binary',
    slices: density === 'sparse' ? [binary] : splitIfTwoColumns(binary, density),
  });

  return { density, darkBackground, variants };
}

export function rotatePreparedSource(raw: HTMLCanvasElement, degrees: 90 | 180 | 270): HTMLCanvasElement {
  return rotateCanvas(raw, degrees);
}
