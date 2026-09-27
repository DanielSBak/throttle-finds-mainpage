export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function movePhoto<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
/** Coordinates in the original image; the preview uses this same rectangle. */
export function cropRectangle(width: number, height: number, zoom: number, x: number, y: number) {
  if (!(width > 0 && height > 0)) throw new Error('Photo dimensions are unavailable');
  const cropWidth = Math.min(width, height * 1.5) / clamp(zoom, 1, 3);
  const w = Math.max(1, Math.floor(cropWidth));
  const h = Math.max(1, Math.floor(cropWidth / 1.5));
  return { originX: Math.round((width - w) * clamp(x, 0, 1)), originY: Math.round((height - h) * clamp(y, 0, 1)), width: w, height: h };
}
