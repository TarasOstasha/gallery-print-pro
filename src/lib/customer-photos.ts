export type StoredCustomerPhoto = {
  id: string;
  number: string;
  previewUrl: string;
  width: number;
  height: number;
  fileName: string;
  createdAt: number;
};

const DB_NAME = "atelier-nord-customer-photos";
const DB_VERSION = 1;
const STORE = "photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

type PhotoRecord = StoredCustomerPhoto & {
  previewBlob: Blob;
  originalBlob: Blob;
};

export async function saveCustomerPhoto(file: File): Promise<StoredCustomerPhoto> {
  const { previewBlob, width, height } = await buildPreviewBlob(file);
  const id = crypto.randomUUID();
  const number = nextPhotoNumber();
  const previewUrl = URL.createObjectURL(previewBlob);
  const record: PhotoRecord = {
    id,
    number,
    previewUrl,
    width,
    height,
    fileName: file.name,
    createdAt: Date.now(),
    previewBlob,
    originalBlob: file,
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return {
    id,
    number,
    previewUrl,
    width,
    height,
    fileName: file.name,
    createdAt: record.createdAt,
  };
}

export async function listCustomerPhotos(): Promise<StoredCustomerPhoto[]> {
  const db = await openDb();
  const rows = await new Promise<PhotoRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as PhotoRecord[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((row) => ({
      id: row.id,
      number: row.number,
      previewUrl: URL.createObjectURL(row.previewBlob),
      width: row.width,
      height: row.height,
      fileName: row.fileName,
      createdAt: row.createdAt,
    }));
}

export async function getCustomerPhotoPreviewUrl(id: string): Promise<string | null> {
  const db = await openDb();
  const row = await new Promise<PhotoRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as PhotoRecord | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!row) return null;
  return URL.createObjectURL(row.previewBlob);
}

export async function getCustomerPhotoOriginalBase64(id: string): Promise<{
  base64: string;
  mimeType: string;
  fileName: string;
} | null> {
  const db = await openDb();
  const row = await new Promise<PhotoRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as PhotoRecord | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!row) return null;
  const buffer = await row.originalBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return {
    base64: btoa(binary),
    mimeType: row.originalBlob.type || "image/jpeg",
    fileName: row.fileName,
  };
}

export async function removeCustomerPhoto(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function nextPhotoNumber(): string {
  const key = "atelier-nord.photo-counter";
  const current = Number(localStorage.getItem(key) ?? "0") + 1;
  localStorage.setItem(key, String(current));
  return `IMG_${String(current).padStart(4, "0")}`;
}

async function buildPreviewBlob(file: File): Promise<{
  previewBlob: Blob;
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image preview");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const previewBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Preview encoding failed"))),
      "image/jpeg",
      0.88,
    );
  });
  return { previewBlob, width, height };
}
