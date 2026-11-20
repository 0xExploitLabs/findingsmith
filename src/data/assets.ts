import { newId } from "../domain/factories";
import type { Asset } from "../domain/types";
import { getAsset, putAsset } from "./db";

const MAX_EDGE = 2400;

/**
 * Stores an image for a project. Anything that is not PNG or JPEG, and
 * anything larger than MAX_EDGE on a side, is redrawn to PNG first, so every
 * asset can be embedded in the PDF as is.
 */
export async function storeImage(projectId: string, file: Blob, name: string): Promise<Asset> {
  const bitmap = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  let blob: Blob = file;
  if (scale < 1 || !["image/png", "image/jpeg"].includes(file.type)) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available.");
    ctx.drawImage(bitmap, 0, 0, width, height);
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode image."))),
        "image/png",
      ),
    );
  }
  if ("close" in bitmap) bitmap.close();
  const asset: Asset = {
    id: newId(),
    projectId,
    name: name || "image",
    type: blob.type,
    blob,
    width,
    height,
    createdAt: new Date().toISOString(),
  };
  await putAsset(asset);
  return asset;
}

/**
 * createImageBitmap cannot decode SVG, so vector logos go through an <img>.
 * An SVG without intrinsic size is drawn 1200 px wide.
 */
async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (file.type !== "image/svg+xml") return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) {
      img.width = 1200;
      img.height = 400;
    } else if (img.naturalWidth < 1200) {
      const k = 1200 / img.naturalWidth;
      img.width = 1200;
      img.height = Math.round(img.naturalHeight * k);
    } else {
      img.width = img.naturalWidth;
      img.height = img.naturalHeight;
    }
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

const urlCache = new Map<string, string>();

/** An object URL for showing an asset in the app; cached for the session. */
export async function assetUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const asset = await getAsset(id);
  if (!asset) return null;
  const url = URL.createObjectURL(asset.blob);
  urlCache.set(id, url);
  return url;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export const ASSET_REF = /asset:([0-9a-f-]{36})/g;

export function assetIdsIn(markdown: string): string[] {
  return [...markdown.matchAll(ASSET_REF)].map((m) => m[1] as string);
}
