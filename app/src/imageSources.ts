import { imageUrl } from './cars';
/** Legacy files without a thumbnail fall back to the original in CachedPhoto. */
export function thumbnailUrl(path: string): string {
  return imageUrl(path.replace(/^\/?images\/uploads\/(?!thumbs\/)/, 'images/uploads/thumbs/'));
}
