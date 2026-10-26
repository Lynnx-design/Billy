import { api } from "./api";

/** Shrinks a photo in the browser (max 1280px, JPEG) so uploads stay small on mobile data. */
export async function resizeImage(file: File, maxSize = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export async function uploadImage(file: File, maxSize?: number): Promise<{ id: string; url: string }> {
  const dataUrl = await resizeImage(file, maxSize);
  return api("/media", { body: { dataUrl } });
}
