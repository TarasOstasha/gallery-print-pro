/** Minimum effective DPI before we warn the customer about print quality. */
export const MIN_PRINT_DPI = 150;

/** Default object-position center for print crop preview (0–100). */
export const DEFAULT_CROP_X = 50;
export const DEFAULT_CROP_Y = 50;

export function effectiveDpi(
  pixelWidth: number,
  pixelHeight: number,
  printWidthIn: number,
  printHeightIn: number,
): number {
  const dpiW = pixelWidth / printWidthIn;
  const dpiH = pixelHeight / printHeightIn;
  return Math.min(dpiW, dpiH);
}

export function printAspectRatio(widthIn: number, heightIn: number): number {
  return widthIn / heightIn;
}

export function resolutionWarning(
  pixelWidth: number,
  pixelHeight: number,
  printWidthIn: number,
  printHeightIn: number,
): string | null {
  const dpi = effectiveDpi(pixelWidth, pixelHeight, printWidthIn, printHeightIn);
  if (dpi >= MIN_PRINT_DPI) return null;
  return `This size may look soft at ${Math.round(dpi)} DPI. Try a smaller print or upload a higher-resolution file.`;
}

/** Inner image area aspect when a fixed white border is applied to the print. */
export function cropFrameAspect(
  printWidthIn: number,
  printHeightIn: number,
  borderInches: number,
  hasBorder: boolean,
): number {
  if (!hasBorder) return printWidthIn / printHeightIn;
  const innerW = Math.max(printWidthIn - borderInches * 2, 0.01);
  const innerH = Math.max(printHeightIn - borderInches * 2, 0.01);
  return innerW / innerH;
}

/**
 * True when object-fit:cover will crop the photo for the given frame aspect,
 * so repositioning (object-position) is meaningful.
 */
export function canRepositionCrop(
  photoWidth: number,
  photoHeight: number,
  frameAspect: number,
): boolean {
  if (photoWidth <= 0 || photoHeight <= 0 || frameAspect <= 0) return false;
  const photoAspect = photoWidth / photoHeight;
  return Math.abs(photoAspect - frameAspect) > 0.02;
}

export function clampCropPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}
