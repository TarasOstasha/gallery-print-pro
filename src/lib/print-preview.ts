/** Minimum effective DPI before we warn the customer about print quality. */
export const MIN_PRINT_DPI = 150;

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
