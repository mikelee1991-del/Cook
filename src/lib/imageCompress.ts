const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.78;

/** Read a File as a compressed JPEG data URL for local storage. */
export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not read ${file.name}`));
    };
    img.src = objectUrl;
  });
}

export async function compressImageFiles(
  files: FileList | File[],
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
  const out: string[] = [];
  for (let i = 0; i < list.length; i++) {
    out.push(await compressImageFile(list[i]));
    onProgress?.(i + 1, list.length);
  }
  return out;
}
