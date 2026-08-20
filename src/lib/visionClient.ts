import { rasterizeToCanvas, scaleCanvas } from './imageRaster';
import {
  FALLBACK_VISION_MODELS,
  loadVisionKey,
  visionModel,
  visionProxyUrl,
  visionSetupMessage,
} from './visionConfig';
import { parseModelJson } from './visionJson';

export interface VisionImage {
  mimeType: string;
  data: string;
}

const VISION_EDGE = 1600;
const JPEG_QUALITY = 0.84;

function canvasToJpegBase64(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export async function sourceToVisionImage(src: string | Blob): Promise<VisionImage> {
  const canvas = scaleCanvas(await rasterizeToCanvas(src), VISION_EDGE, 'down');
  return { mimeType: 'image/jpeg', data: canvasToJpegBase64(canvas) };
}

function geminiUrl(model: string, key: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
}

function geminiBody(prompt: string, images: VisionImage[]) {
  return {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          ...images.map((img) => ({
            inline_data: { mime_type: img.mimeType, data: img.data },
          })),
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };
}

interface GeminiResponse {
  error?: { message?: string; status?: string };
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
}

function textFromGemini(data: GeminiResponse): string {
  if (data.error?.message) throw new Error(data.error.message);
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text || '').join('\n').trim();
  if (!text) throw new Error('Vision returned no text for this photo.');
  return text;
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function callGeminiDirect(prompt: string, images: VisionImage[], key: string): Promise<string> {
  const models = [visionModel(), ...FALLBACK_VISION_MODELS.filter((m) => m !== visionModel())];
  let lastError = 'Vision request failed';
  for (const model of models) {
    const res = await postJson(geminiUrl(model, key), geminiBody(prompt, images));
    const data = (await res.json()) as GeminiResponse;
    if (res.ok) return textFromGemini(data);
    lastError = data.error?.message || `Vision request failed (${res.status})`;
    if (res.status !== 404 && !/not found|NOT_FOUND/i.test(lastError)) {
      throw new Error(lastError);
    }
  }
  throw new Error(lastError);
}

async function callVisionProxy(prompt: string, images: VisionImage[]): Promise<string> {
  const base = visionProxyUrl();
  if (!base) throw new Error(visionSetupMessage());
  const res = await postJson(`${base}/vision`, {
    prompt,
    images,
    model: visionModel(),
  });
  const data = (await res.json()) as GeminiResponse & { text?: string; error?: string | { message?: string } };
  if (!res.ok) {
    const message =
      typeof data.error === 'string' ? data.error : data.error?.message || `Vision proxy failed (${res.status})`;
    throw new Error(message);
  }
  if (typeof data.text === 'string' && data.text.trim()) return data.text;
  return textFromGemini(data);
}

export async function visionJson<T>(prompt: string, images: VisionImage[]): Promise<T> {
  if (!images.length) throw new Error('No photos to look at.');
  const proxy = visionProxyUrl();
  const key = loadVisionKey();
  if (!proxy && !key) throw new Error(visionSetupMessage());
  const text = proxy ? await callVisionProxy(prompt, images) : await callGeminiDirect(prompt, images, key);
  return parseModelJson<T>(text);
}
