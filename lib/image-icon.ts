// Browser-only helper that turns a user-picked photo into a small, square,
// compressed data URL suitable for use as a custom-food icon.
//
// Privacy: everything here runs in the browser. No bytes leave the device —
// the resulting data URL is stored inside settings.customFoods (the same
// place the rest of the profile lives) and round-trips through JSON
// export/import. We deliberately keep the icon tiny so per-profile storage
// and load speed are not affected.
//
// MVP scope: center-crop to a square and downscale. This is intentionally
// structured so a real background-removal step (e.g. an on-device model or a
// future opt-in service) can be slotted into `extractSubject` later without
// touching call sites.

export const FOOD_ICON_SIZE = 96;
const MAX_INPUT_BYTES = 12 * 1024 * 1024; // 12 MB guard before decoding

export type FoodIconError =
  | "not-an-image"
  | "too-large"
  | "decode-failed"
  | "no-canvas";

export class FoodIconProcessingError extends Error {
  code: FoodIconError;
  constructor(code: FoodIconError, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "FoodIconProcessingError";
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(new FoodIconProcessingError("decode-failed", "read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new FoodIconProcessingError("decode-failed", "image decode"));
    img.src = src;
  });
}

// Placeholder for future background removal. Today it is a no-op that draws
// the source image as-is; swap the body for a segmentation pass later and the
// rest of the pipeline (crop + compress) keeps working unchanged.
function extractSubject(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx: number,
  sy: number,
  side: number,
  size: number
) {
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
}

/**
 * Process a picked image File into a square, downscaled JPEG data URL.
 * Resolves to the data URL, or rejects with a FoodIconProcessingError.
 */
export async function processFoodIconImage(
  file: File,
  size: number = FOOD_ICON_SIZE
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new FoodIconProcessingError("not-an-image");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new FoodIconProcessingError("too-large");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new FoodIconProcessingError("decode-failed");

  // Center-crop to a square so the icon never stretches.
  const side = Math.min(w, h);
  const sx = Math.floor((w - side) / 2);
  const sy = Math.floor((h - side) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new FoodIconProcessingError("no-canvas");

  ctx.imageSmoothingQuality = "high";
  extractSubject(ctx, img, sx, sy, side, size);

  // JPEG keeps photo icons tiny (a 96px icon is typically a few KB). If a
  // later background-removal step needs transparency, switch to "image/png".
  return canvas.toDataURL("image/jpeg", 0.82);
}
