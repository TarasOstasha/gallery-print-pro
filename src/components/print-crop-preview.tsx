import { DEFAULT_PREVIEW_SIZE, PRINT_BORDER_INCHES } from "@/lib/print-catalog";
import { DEFAULT_CROP_X, DEFAULT_CROP_Y } from "@/lib/print-preview";

type Props = {
  photoUrl: string;
  width?: number;
  height?: number;
  border?: boolean;
  cropX?: number;
  cropY?: number;
  /** CSS max-height for the print frame (keeps aspect ratio). */
  maxHeight?: string;
};

/**
 * View-only print crop preview — same aspect, border inset, object-cover,
 * and object-position rules as the configurator preview.
 */
export function PrintCropPreview({
  photoUrl,
  width = DEFAULT_PREVIEW_SIZE.width,
  height = DEFAULT_PREVIEW_SIZE.height,
  border = false,
  cropX = DEFAULT_CROP_X,
  cropY = DEFAULT_CROP_Y,
  maxHeight = "min(70vh, 560px)",
}: Props) {
  const aspect = width / height;
  const insetTop = border ? `${(PRINT_BORDER_INCHES / height) * 100}%` : "0%";
  const insetSide = border ? `${(PRINT_BORDER_INCHES / width) * 100}%` : "0%";

  return (
    <div className="mx-auto flex w-full justify-center">
      <div
        className={`relative max-w-full overflow-hidden ${border ? "bg-white" : "bg-transparent"}`}
        style={{
          aspectRatio: String(aspect),
          maxHeight,
          width: `min(100%, calc(${maxHeight} * ${aspect}))`,
          height: "auto",
        }}
      >
        <div
          className="absolute overflow-hidden"
          style={{
            top: insetTop,
            bottom: insetTop,
            left: insetSide,
            right: insetSide,
          }}
        >
          <img
            src={photoUrl}
            alt="Print preview"
            draggable={false}
            className="h-full w-full select-none object-cover"
            style={{ objectPosition: `${cropX}% ${cropY}%` }}
          />
        </div>
      </div>
    </div>
  );
}
