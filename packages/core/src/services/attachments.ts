import type { Attachment } from '../types';
import { nanoid } from '../utils';
import { IDB_STORES, idbDelete, idbGet, idbGetAll, idbSet } from './indexedDb';

export interface AttachmentBlobRecord {
  meta: Attachment;
  thumbBlob: Blob;
  fullBlob: Blob;
}

type CanvasImageSourceLike = CanvasImageSource & {
  width?: number;
  height?: number;
};

function fitWithin(width: number, height: number, maxEdge: number) {
  const largest = Math.max(width, height);
  if (largest <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / largest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create image blob'));
        return;
      }
      resolve(blob);
    }, mime, quality);
  });
}

async function decodeImage(file: File): Promise<{ source: CanvasImageSourceLike; width: number; height: number; cleanup: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function renderResizedBlob(
  source: CanvasImageSourceLike,
  width: number,
  height: number,
  preferredMime = 'image/webp',
  quality = 0.75
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);

  try {
    return await canvasToBlob(canvas, preferredMime, quality);
  } catch {
    return canvasToBlob(canvas, 'image/jpeg', quality);
  }
}

export async function processImageAttachmentFile(file: File): Promise<AttachmentBlobRecord> {
  const decoded = await decodeImage(file);
  try {
    const thumbSize = fitWithin(decoded.width, decoded.height, 240);
    const fullSize = fitWithin(decoded.width, decoded.height, 1600);
    const thumbBlob = await renderResizedBlob(decoded.source, thumbSize.width, thumbSize.height, 'image/webp', 0.72);
    const fullBlob = await renderResizedBlob(decoded.source, fullSize.width, fullSize.height, 'image/webp', 0.75);

    const meta: Attachment = {
      id: nanoid(),
      kind: 'image',
      mime: fullBlob.type || file.type || 'image/jpeg',
      width: decoded.width,
      height: decoded.height,
      createdAt: Date.now(),
      sizeBytes: fullBlob.size,
    };
    return { meta, thumbBlob, fullBlob };
  } finally {
    decoded.cleanup();
  }
}

export async function saveAttachmentRecord(record: AttachmentBlobRecord): Promise<void> {
  await idbSet(IDB_STORES.attachments, record.meta.id, record);
}

export async function getAttachmentRecord(id: string): Promise<AttachmentBlobRecord | undefined> {
  return idbGet<AttachmentBlobRecord>(IDB_STORES.attachments, id);
}

export async function getAttachmentThumbBlob(id: string): Promise<Blob | undefined> {
  const record = await getAttachmentRecord(id);
  return record?.thumbBlob;
}

export async function getAttachmentFullBlob(id: string): Promise<Blob | undefined> {
  const record = await getAttachmentRecord(id);
  return record?.fullBlob;
}

export async function deleteAttachmentRecord(id: string): Promise<void> {
  await idbDelete(IDB_STORES.attachments, id);
}

export async function getAllAttachmentRecords(): Promise<AttachmentBlobRecord[]> {
  return idbGetAll<AttachmentBlobRecord>(IDB_STORES.attachments);
}

export async function getAttachmentRecordsByIds(ids: string[]): Promise<AttachmentBlobRecord[]> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const records = await Promise.all(uniqueIds.map((id) => getAttachmentRecord(id)));
  return records.filter((record): record is AttachmentBlobRecord => !!record);
}
