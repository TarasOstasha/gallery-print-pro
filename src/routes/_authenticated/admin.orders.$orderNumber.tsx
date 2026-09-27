import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  deleteAdminOrderPhotos,
  deleteAdminStoredPhoto,
  getAdminOrderDetail,
  getAdminPhotoDownloadUrl,
  updateOrderStatus,
  type AdminOrderDetail,
} from "@/lib/admin.functions";
import { formatCents } from "@/lib/money";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/orders/$orderNumber")({
  component: AdminOrderDetailPage,
});

function mountingLabel(code: string): string {
  if (code === "print-only") return "Print Only";
  return code
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function finishLabel(finish: string | null): string {
  if (!finish) return "—";
  return finish
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDeletedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AdminOrderDetailPage() {
  const { orderNumber } = Route.useParams();
  const nav = useNavigate();
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [deletingOrderPhotos, setDeletingOrderPhotos] = useState(false);
  const [confirmPhotoId, setConfirmPhotoId] = useState<string | null>(null);
  const [confirmOrderPhotos, setConfirmOrderPhotos] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const next = await getAdminOrderDetail({ data: { orderNumber } });
      setDetail(next);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not load order");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [orderNumber]);

  async function markReady() {
    if (!detail) return;
    try {
      await updateOrderStatus({ data: { orderId: detail.order.id, status: "ready_for_pickup" } });
      toast.success("Marked ready for pickup");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function downloadOriginal(photoId: string) {
    if (!detail) return;
    setBusyPhotoId(photoId);
    try {
      const result = await getAdminPhotoDownloadUrl({
        data: { orderId: detail.order.id, photoId },
      });
      if (result.source === "storage") {
        const a = document.createElement("a");
        a.href = result.url;
        a.download = result.fileName;
        a.rel = "noopener";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        // LEGACY: older orders that only have print_file_blobs.
        const binary = atob(result.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: result.mimeType });
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = result.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusyPhotoId(null);
    }
  }

  async function confirmDeletePhoto() {
    if (!detail || !confirmPhotoId) return;
    const photoId = confirmPhotoId;
    setConfirmPhotoId(null);
    setBusyPhotoId(photoId);
    try {
      const result = await deleteAdminStoredPhoto({
        data: { orderId: detail.order.id, photoId },
      });
      if (result.partial) {
        toast.warning(result.warnings.join(" ") || "Photo deleted with warnings");
      } else if (result.status === "already_deleted") {
        toast.message("Photo was already deleted");
      } else {
        toast.success("Stored photo deleted");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyPhotoId(null);
    }
  }

  async function confirmDeleteOrderPhotos() {
    if (!detail) return;
    setConfirmOrderPhotos(false);
    setDeletingOrderPhotos(true);
    try {
      const result = await deleteAdminOrderPhotos({ data: { orderId: detail.order.id } });
      const parts = [
        result.deleted ? `${result.deleted} deleted` : null,
        result.skippedShared ? `${result.skippedShared} shared (kept)` : null,
        result.alreadyDeleted ? `${result.alreadyDeleted} already removed` : null,
      ].filter(Boolean);
      toast.success(parts.length ? parts.join(" · ") : "No stored photos to delete");
      if (result.warnings.length) toast.warning(result.warnings.join(" "));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingOrderPhotos(false);
    }
  }

  const deletableCount = detail?.photoSummary.deletableUniqueCount ?? 0;

  return (
    <div className="max-w-5xl">
      <button
        type="button"
        onClick={() => void nav({ to: "/admin" })}
        className="label-mono text-white/55 hover:text-white"
      >
        ← Back to orders
      </button>

      {loading ? (
        <p className="mt-10 text-sm text-white/45">Loading order…</p>
      ) : error ? (
        <p className="mt-10 text-sm text-red-300">{error}</p>
      ) : detail ? (
        <>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="label-mono text-primary">Order detail</p>
              <h1 className="mt-3 font-display text-5xl">#{detail.order.orderNumber}</h1>
              <p className="mt-2 text-sm text-white/45">
                {new Date(detail.order.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-wider text-white/70">
                {detail.order.orderStatus.replaceAll("_", " ")}
              </span>
              <span className="rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-wider text-white/70">
                Payment: {detail.order.paymentStatus}
              </span>
              {detail.order.fulfillmentMethod === "studio_pickup" &&
                detail.order.orderStatus === "new" && (
                  <button
                    type="button"
                    onClick={() => void markReady()}
                    className="rounded-full border border-white/20 px-4 py-2 text-[10px] uppercase tracking-wider"
                  >
                    Ready
                  </button>
                )}
              {deletableCount > 0 && (
                <button
                  type="button"
                  disabled={deletingOrderPhotos}
                  onClick={() => setConfirmOrderPhotos(true)}
                  className="rounded-full border border-red-400/40 px-4 py-2 text-[10px] uppercase tracking-wider text-red-300"
                >
                  Delete order photos
                </button>
              )}
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Panel title="Order">
              <Row label="Order number" value={`#${detail.order.orderNumber}`} />
              <Row label="Created" value={new Date(detail.order.createdAt).toLocaleString()} />
              <Row label="Status" value={detail.order.orderStatus.replaceAll("_", " ")} />
              <Row label="Payment status" value={detail.order.paymentStatus} />
              <Row label="Total" value={formatCents(detail.order.totalCents)} />
            </Panel>

            <Panel title="Customer">
              {detail.customer ? (
                <>
                  <Row
                    label="Name"
                    value={`${detail.customer.firstName} ${detail.customer.lastName}`}
                  />
                  <Row label="Email" value={detail.customer.email} />
                  <Row label="Phone" value={detail.customer.phone || "—"} />
                </>
              ) : (
                <p className="text-sm text-white/45">No customer record</p>
              )}
            </Panel>

            <Panel title="Fulfillment" className="md:col-span-2">
              <Row
                label="Method"
                value={
                  detail.order.fulfillmentMethod === "shipping" ? "Ship order" : "Studio Pickup"
                }
              />
              {detail.order.fulfillmentMethod === "shipping" ? (
                <>
                  <Row label="Shipping method" value={detail.shippingMethodName || "—"} />
                  {detail.shippingAddress ? (
                    <div className="mt-3 text-sm leading-6 text-white/70">
                      <p className="label-mono text-white/40">Shipping address</p>
                      <p className="mt-2">
                        {detail.shippingAddress.firstName} {detail.shippingAddress.lastName}
                        <br />
                        {detail.shippingAddress.addressLine1}
                        {detail.shippingAddress.addressLine2
                          ? `, ${detail.shippingAddress.addressLine2}`
                          : ""}
                        <br />
                        {detail.shippingAddress.city}, {detail.shippingAddress.state}{" "}
                        {detail.shippingAddress.postalCode}
                        <br />
                        {detail.shippingAddress.country}
                      </p>
                    </div>
                  ) : (
                    <Row label="Shipping address" value="—" />
                  )}
                </>
              ) : null}
              <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
                <Row label="Subtotal" value={formatCents(detail.order.subtotalCents)} />
                <Row label="Shipping amount" value={formatCents(detail.order.shippingCents)} />
                <Row label="Tax" value={formatCents(detail.order.taxCents)} />
                <Row label="Total" value={formatCents(detail.order.totalCents)} />
              </div>
            </Panel>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]">
            <div className="border-b border-white/10 p-5">
              <p className="label-mono text-white/45">Line items</p>
              <h2 className="mt-2 font-display text-3xl">Order items</h2>
            </div>
            <div className="divide-y divide-white/10">
              {detail.items.map((item) => (
                <div key={item.id} className="grid gap-4 p-5 sm:grid-cols-[88px_1fr_auto]">
                  <div className="h-20 w-20 overflow-hidden rounded-lg bg-white/5">
                    {item.photoStatus === "available" && item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.photoNumber}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center px-1 text-center text-[9px] uppercase tracking-wider text-white/35">
                        {item.photoStatus === "deleted"
                          ? "Removed"
                          : item.photoStatus === "none"
                            ? "No photo"
                            : "No preview"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 text-sm">
                    <strong className="block">{item.photoNumber}</strong>
                    <p className="mt-1 text-white/55">{item.fileName || "—"}</p>
                    <p className="mt-2 text-white/70">
                      {item.productName}
                      {item.finish ? ` · ${finishLabel(item.finish)}` : ""}
                      {` · ${item.sizeLabel}`}
                    </p>
                    <p className="mt-1 text-white/50">
                      Qty {item.quantity} · Border: {item.hasBorder ? "Yes" : "No"} · Mounting:{" "}
                      {mountingLabel(item.mountingCode)}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-white/35">
                      cropX: {item.cropX} · cropY: {item.cropY}
                    </p>

                    {item.photoStatus === "deleted" && item.photoDeletedAt ? (
                      <div className="mt-3 rounded-lg border border-white/10 bg-white/[.04] px-3 py-2">
                        <p className="label-mono text-[10px] text-amber-300/90">Photo removed</p>
                        <p className="mt-1 text-xs text-white/50">
                          Original customer file was deleted on{" "}
                          {formatDeletedDate(item.photoDeletedAt)}.
                        </p>
                      </div>
                    ) : item.photoStatus === "none" ? (
                      <p className="mt-3 text-xs text-white/40">No stored photo</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.canDownloadOriginal && item.photoId ? (
                          <button
                            type="button"
                            disabled={busyPhotoId === item.photoId}
                            onClick={() => void downloadOriginal(item.photoId!)}
                            className="rounded-full border border-white/20 px-3 py-1.5 text-[10px] uppercase tracking-wider"
                          >
                            Download original
                          </button>
                        ) : null}
                        {item.canDeleteStoredPhoto && item.photoId ? (
                          <button
                            type="button"
                            disabled={busyPhotoId === item.photoId}
                            onClick={() => setConfirmPhotoId(item.photoId)}
                            className="rounded-full border border-red-400/35 px-3 py-1.5 text-[10px] uppercase tracking-wider text-red-300"
                          >
                            Delete stored photo
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-white/50">{formatCents(item.unitPriceCents)} each</p>
                    <strong className="mt-1 block">{formatCents(item.lineTotalCents)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <AlertDialog open={Boolean(confirmPhotoId)} onOpenChange={(o) => !o && setConfirmPhotoId(null)}>
        <AlertDialogContent className="border-white/10 bg-[#16181d] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stored photo?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/55">
              This will permanently delete the customer&apos;s original photo and its generated
              preview from storage.
              <br />
              <br />
              The order record and production details will remain.
              <br />
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 bg-transparent text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white hover:bg-red-500/90"
              onClick={() => void confirmDeletePhoto()}
            >
              Delete photo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOrderPhotos} onOpenChange={setConfirmOrderPhotos}>
        <AlertDialogContent className="border-white/10 bg-[#16181d] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete order photos?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/55">
              This will permanently delete {deletableCount} stored photo
              {deletableCount === 1 ? "" : "s"} (unique originals) belonging exclusively to this
              order, including generated previews.
              <br />
              <br />
              The order record and production details will remain. Photos still referenced by other
              orders will be skipped.
              <br />
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 bg-transparent text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white hover:bg-red-500/90"
              onClick={() => void confirmDeleteOrderPhotos()}
            >
              Delete order photos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[.03] p-5 ${className}`}>
      <p className="label-mono text-white/45">{title}</p>
      <div className="mt-4 space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-white/45">{label}</span>
      <span className="text-right text-white/85">{value}</span>
    </div>
  );
}
