export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}

export function parseSizeLabel(label: string): { width: number; height: number } | null {
  const match = label.match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}
