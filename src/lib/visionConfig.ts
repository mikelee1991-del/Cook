import { VISION_KEY } from './appStorage';
import { sharedWorkerBase } from './syncConfig';

const ENV_KEY = import.meta.env?.VITE_DINNER_VISION_KEY;
const ENV_PROXY = import.meta.env?.VITE_DINNER_VISION_URL;
const ENV_MODEL = import.meta.env?.VITE_DINNER_VISION_MODEL;

export const DEFAULT_VISION_MODEL = 'gemini-2.5-flash';
export const FALLBACK_VISION_MODELS = ['gemini-2.0-flash', 'gemini-flash-latest'];

/** Server-side vision proxy — key stays on the worker, not in the browser bundle. */
export function visionProxyUrl(): string | null {
  if (typeof ENV_PROXY === 'string' && ENV_PROXY.trim()) return ENV_PROXY.replace(/\/$/, '');
  return sharedWorkerBase();
}

export function usesGlobalVision(): boolean {
  return Boolean(visionProxyUrl());
}

export function visionModel(): string {
  if (typeof ENV_MODEL === 'string' && ENV_MODEL.trim()) return ENV_MODEL.trim();
  return DEFAULT_VISION_MODEL;
}

export function loadVisionKey(): string {
  if (typeof ENV_KEY === 'string' && ENV_KEY.trim()) return ENV_KEY.trim();
  try {
    return (localStorage.getItem(VISION_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function saveVisionKey(key: string): void {
  const trimmed = key.trim();
  try {
    if (trimmed) localStorage.setItem(VISION_KEY, trimmed);
    else localStorage.removeItem(VISION_KEY);
  } catch {
    /* ignore quota */
  }
}

export function hasVisionAccess(): boolean {
  return Boolean(visionProxyUrl() || loadVisionKey());
}

export function visionSetupMessage(): string {
  if (usesGlobalVision()) {
    return 'Photo scans are not available yet — the shared vision service is not configured. Ask the site owner to add GEMINI_API_KEY to the Dinner worker.';
  }
  return 'Add a free Gemini API key so Dinner can look at photos (packaging, produce, handwriting). Get one at aistudio.google.com/apikey and paste it in Devices at the bottom of the page.';
}
