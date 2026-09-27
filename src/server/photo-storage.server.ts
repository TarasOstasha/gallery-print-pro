import { createDb, isServiceRoleKey } from "@/server/db.server";

/** Same ID as customer-uploads event in orders.server.ts */
export const CUSTOMER_UPLOAD_EVENT_ID = "33333333-3333-4333-8333-333333333333";

export type PhotoStorageStatus = "available" | "deleted" | "none";

export type PhotoAssetRecord = {
  id: string;
  eventId: string;
  photoNumber: string;
  previewUrl: string;
  originalPath: string | null;
  originalFileName: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type DeletePhotoAssetsResult = {
  photoId: string;
  status: "deleted" | "already_deleted" | "no_stored_photo" | "skipped_shared";
  deletedAt: string | null;
  warnings: string[];
  blockingOrderNumbers?: string[];
};

const ORIGINALS_BUCKET = "photo-originals";
const PREVIEWS_BUCKET = "photo-previews";

export function getPhotoRetentionDays(): number {
  const raw = process.env.PHOTO_RETENTION_DAYS;
  const n = raw ? Number.parseInt(raw, 10) : 30;
  if (!Number.isFinite(n) || n < 1) return 30;
  return n;
}

export function classifyPhotoStorage(photo: {
  deletedAt: string | null;
  originalPath: string | null;
  previewUrl: string | null;
} | null): PhotoStorageStatus {
  if (!photo) return "none";
  if (photo.deletedAt) return "deleted";
  if (isCustomerStoragePath(photo.originalPath) || isCustomerStoragePath(photo.previewUrl)) {
    return "available";
  }
  // Blob-only fallback still counts as stored until deleted (bytes in print_file_blobs).
  if (photo.previewUrl?.startsWith("blob://")) return "available";
  return "none";
}

export function isCustomerStoragePath(path: string | null | undefined): boolean {
  if (!path) return false;
  if (path.startsWith("http://") || path.startsWith("https://")) return false;
  if (path.startsWith("blob://") || path.startsWith("deleted://")) return false;
  if (path.startsWith("/")) return false;
  return path.includes("customer-uploads/");
}

function requireServiceRole() {
  if (!isServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("Storage deletion requires a valid SUPABASE_SERVICE_ROLE_KEY");
  }
}

async function getAdminStorageClient() {
  requireServiceRole();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadPhotoAsset(
  supabase: { from: (t: string) => any },
  photoId: string,
): Promise<PhotoAssetRecord | null> {
  const { data, error } = await supabase
    .from("photos")
    .select(
      "id, event_id, photo_number, preview_url, original_path, original_file_name, created_at, deleted_at",
    )
    .eq("id", photoId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    eventId: data.event_id,
    photoNumber: data.photo_number,
    previewUrl: data.preview_url,
    originalPath: data.original_path,
    originalFileName: data.original_file_name ?? null,
    createdAt: data.created_at,
    deletedAt: data.deleted_at ?? null,
  };
}

/** Other orders (excluding `orderId`) that still reference this photo. */
export async function findBlockingOrderNumbers(
  supabase: { from: (t: string) => any },
  photoId: string,
  orderId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("order_id, orders(order_number)")
    .eq("photo_id", photoId);
  if (error) throw error;

  const blocking = new Set<string>();
  for (const row of data ?? []) {
    if (row.order_id === orderId) continue;
    const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
    if (order?.order_number) blocking.add(String(order.order_number));
  }
  return [...blocking].sort();
}

async function removeStorageObject(
  supabase: Awaited<ReturnType<typeof getAdminStorageClient>>,
  bucket: string,
  path: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    // Treat missing object as success (already gone).
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("not found") || msg.includes("does not exist")) {
      return { ok: true };
    }
    return { ok: false, error: `${bucket}/${path}: ${error.message}` };
  }
  return { ok: true };
}

async function clearPrintFileBlob(photoId: string): Promise<string | null> {
  const sql = createDb();
  try {
    await sql`delete from public.print_file_blobs where photo_id = ${photoId}::uuid`;
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Failed to clear print_file_blobs";
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Delete Storage originals/previews + DB blob bytes for a photo entity.
 * Does not delete the photos row or any order_items.
 * Refuses if other orders still reference the photo.
 */
export async function deletePhotoAssetsForOrder(opts: {
  supabase: { from: (t: string) => any };
  orderId: string;
  photoId: string;
}): Promise<DeletePhotoAssetsResult> {
  const photo = await loadPhotoAsset(opts.supabase, opts.photoId);
  if (!photo) {
    return {
      photoId: opts.photoId,
      status: "no_stored_photo",
      deletedAt: null,
      warnings: ["Photo record not found"],
    };
  }

  if (photo.eventId !== CUSTOMER_UPLOAD_EVENT_ID) {
    return {
      photoId: photo.id,
      status: "no_stored_photo",
      deletedAt: null,
      warnings: ["Not a customer-upload photo; Storage deletion skipped"],
    };
  }

  if (photo.deletedAt) {
    return {
      photoId: photo.id,
      status: "already_deleted",
      deletedAt: photo.deletedAt,
      warnings: [],
    };
  }

  const blocking = await findBlockingOrderNumbers(opts.supabase, photo.id, opts.orderId);
  if (blocking.length > 0) {
    return {
      photoId: photo.id,
      status: "skipped_shared",
      deletedAt: null,
      warnings: [
        `Photo is still referenced by order(s) ${blocking.map((n) => `#${n}`).join(", ")}`,
      ],
      blockingOrderNumbers: blocking,
    };
  }

  const hasOriginal = isCustomerStoragePath(photo.originalPath);
  const hasPreview = isCustomerStoragePath(photo.previewUrl);
  const hasBlobHint = photo.previewUrl?.startsWith("blob://") === true;

  if (!hasOriginal && !hasPreview && !hasBlobHint) {
    // Nothing in customer Storage; still clear any leftover blob and stamp deleted if blob existed.
    const blobErr = await clearPrintFileBlob(photo.id);
    if (blobErr) {
      throw new Error(`Could not clear stored blob: ${blobErr}`);
    }
    return {
      photoId: photo.id,
      status: "no_stored_photo",
      deletedAt: null,
      warnings: [],
    };
  }

  const admin = await getAdminStorageClient();
  const warnings: string[] = [];
  let originalOk = !hasOriginal;
  let previewOk = !hasPreview;

  if (hasOriginal && photo.originalPath) {
    const res = await removeStorageObject(admin, ORIGINALS_BUCKET, photo.originalPath);
    originalOk = res.ok;
    if (!res.ok) throw new Error(`Failed to delete original: ${res.error}`);
  }

  if (hasPreview && photo.previewUrl) {
    const res = await removeStorageObject(admin, PREVIEWS_BUCKET, photo.previewUrl);
    previewOk = res.ok;
    if (!res.ok) {
      warnings.push(`Original removed but preview deletion failed: ${res.error}`);
    }
  }

  const blobErr = await clearPrintFileBlob(photo.id);
  if (blobErr) {
    warnings.push(`Storage cleared but print_file_blobs cleanup failed: ${blobErr}`);
  }

  // Mark deleted only after original (or sole blob) removal succeeded.
  if (!originalOk && hasOriginal) {
    throw new Error("Original deletion failed; photo was not marked deleted");
  }

  const deletedAt = new Date().toISOString();
  const { error: updateError } = await opts.supabase
    .from("photos")
    .update({
      deleted_at: deletedAt,
      // Keep original_path for audit; neutralize preview so clients never treat it as live.
      preview_url: photo.previewUrl?.startsWith("deleted://")
        ? photo.previewUrl
        : `deleted://${photo.id}`,
    })
    .eq("id", photo.id)
    .is("deleted_at", null);

  if (updateError) {
    throw new Error(
      `Storage objects were removed but failed to record deleted_at: ${updateError.message}`,
    );
  }

  if (!previewOk) {
    // Partial failure already in warnings — still return deleted with warnings.
  }

  return {
    photoId: photo.id,
    status: "deleted",
    deletedAt,
    warnings,
  };
}

export async function createOriginalDownloadUrl(opts: {
  supabase: { from: (t: string) => any };
  orderId: string;
  photoId: string;
}): Promise<{ url: string; fileName: string }> {
  // Validate membership on this order before signing.
  const { data: item, error: itemError } = await opts.supabase
    .from("order_items")
    .select("id")
    .eq("order_id", opts.orderId)
    .eq("photo_id", opts.photoId)
    .limit(1)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item) throw new Error("Photo does not belong to this order");

  const photo = await loadPhotoAsset(opts.supabase, opts.photoId);
  if (!photo) throw new Error("Photo not found");
  if (photo.deletedAt) throw new Error("Stored photo was already deleted");
  if (!isCustomerStoragePath(photo.originalPath) || !photo.originalPath) {
    throw new Error("No stored original available for download");
  }

  const admin = await getAdminStorageClient();
  const { data: signed, error } = await admin.storage
    .from(ORIGINALS_BUCKET)
    .createSignedUrl(photo.originalPath, 60 * 10);
  if (error || !signed?.signedUrl) {
    throw new Error(error?.message ?? "Could not create download URL");
  }

  const fileName =
    photo.originalFileName ||
    photo.originalPath.split("/").pop() ||
    `${photo.photoNumber}.jpg`;

  return { url: signed.signedUrl, fileName };
}

/** Photos eligible for future automatic retention cleanup (dry-run friendly). */
export async function listRetentionEligiblePhotoIds(supabase: {
  from: (t: string) => any;
}): Promise<
  Array<{
    photoId: string;
    orderNumbers: string[];
    completedAt: string;
  }>
> {
  const retentionDays = getPhotoRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("order_items")
    .select(
      `
      photo_id,
      orders!inner(order_number, order_status, payment_status, updated_at, created_at),
      photos!inner(id, deleted_at, original_path, preview_url, event_id)
    `,
    )
    .eq("photos.event_id", CUSTOMER_UPLOAD_EVENT_ID)
    .is("photos.deleted_at", null);

  if (error) throw error;

  type Acc = { orderNumbers: Set<string>; completedAt: string; blocked: boolean };
  const byPhoto = new Map<string, Acc>();

  for (const row of data ?? []) {
    const photoId = row.photo_id as string | null;
    if (!photoId) continue;
    const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
    const photo = Array.isArray(row.photos) ? row.photos[0] : row.photos;
    if (!order || !photo) continue;

    const status = classifyPhotoStorage({
      deletedAt: photo.deleted_at,
      originalPath: photo.original_path,
      previewUrl: photo.preview_url,
    });
    if (status !== "available") continue;

    let acc = byPhoto.get(photoId);
    if (!acc) {
      acc = {
        orderNumbers: new Set(),
        completedAt: order.updated_at ?? order.created_at,
        blocked: false,
      };
      byPhoto.set(photoId, acc);
    }
    acc.orderNumbers.add(order.order_number);

    const fulfilled =
      (order.order_status === "completed" || order.order_status === "shipped") &&
      order.payment_status === "paid";
    if (!fulfilled) {
      acc.blocked = true;
    } else {
      const doneAt = order.updated_at ?? order.created_at;
      // Eligible only after the latest fulfilled reference is past retention.
      if (doneAt > acc.completedAt) acc.completedAt = doneAt;
    }
  }

  const eligible: Array<{ photoId: string; orderNumbers: string[]; completedAt: string }> = [];
  for (const [photoId, acc] of byPhoto) {
    if (acc.blocked) continue;
    if (acc.completedAt > cutoff) continue;
    eligible.push({
      photoId,
      orderNumbers: [...acc.orderNumbers].sort(),
      completedAt: acc.completedAt,
    });
  }
  return eligible;
}
