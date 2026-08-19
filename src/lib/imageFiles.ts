const IMAGE_EXT =
  /\.(jpe?g|png|webp|gif|bmp|tif{1,2}|heic|heif|avif|svg)$/i;

const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi|mkv|3gp)$/i;

export type FileLike = { type?: string; name?: string };

export function fileExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

/** True for photos even when the browser leaves `file.type` blank (iPhone Files, some HEIC). */
export function isLikelyImageFile(file: FileLike): boolean {
  const type = file.type || '';
  if (type.startsWith('image/')) return true;
  if (type.startsWith('video/')) return false;
  return IMAGE_EXT.test(file.name || '');
}

export function isLikelyVideoFile(file: FileLike): boolean {
  const type = file.type || '';
  if (type.startsWith('video/')) return true;
  if (type.startsWith('image/')) return false;
  return VIDEO_EXT.test(file.name || '');
}

export function isHeicLike(file: FileLike): boolean {
  const type = (file.type || '').toLowerCase();
  if (type.includes('heic') || type.includes('heif')) return true;
  const ext = fileExt(file.name || '');
  return ext === '.heic' || ext === '.heif';
}

export function heicHint(fileName: string): string {
  return `"${fileName}" looks like an iPhone HEIC photo. This browser cannot decode it — export as JPEG (Most Compatible) or open Dinner in Safari, then retry.`;
}

export function collectMediaFiles(
  list: FileList | File[],
  allowVideo: boolean,
): File[] {
  return Array.from(list).filter(
    (f) => isLikelyImageFile(f) || (allowVideo && isLikelyVideoFile(f)),
  );
}
