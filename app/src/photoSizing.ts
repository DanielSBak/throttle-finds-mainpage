/** Bound the longest edge, preserving orientation and never enlarging originals. */
export function fitPhoto(width: number, height: number, limit: number): { width: number; height: number } {
  if (!(width > 0 && height > 0)) throw new Error('This photo has invalid dimensions. Choose another photo.');
  const scale = Math.min(1, limit / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
