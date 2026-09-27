import { Car, carTitle } from './cars';
import { SITE_URL } from './config';
export type InventoryFilter = 'All' | 'Available' | 'Sold';
export function visibleCars(cars: Car[], query: string, filter: InventoryFilter): Car[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return cars.filter(c => (filter === 'All' || c.sold === (filter === 'Sold')) &&
    words.every(word => `${carTitle(c)} ${c.vin}`.toLowerCase().includes(word)))
    .sort((a, b) => Number(a.sold) - Number(b.sold));
}
export function listingUrl(car: Car): string | null {
  if (!car.path?.startsWith('_cars/') || !car.path.endsWith('.md')) return null;
  return `${SITE_URL}/cars/${encodeURIComponent(car.path.slice(6, -3))}/`;
}
export type SiteEntry = { path: string; revision: string };
export type PublicationStatus = 'Live' | 'Updating' | 'Saved';
export function publicationStatus(car: Car, entries: SiteEntry[] | null): PublicationStatus {
  if (!entries || !car.publication_id) return 'Saved';
  return entries.some(e => e.path === car.path && e.revision === car.publication_id) ? 'Live' : 'Updating';
}
export async function fetchSiteStatus(): Promise<SiteEntry[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${SITE_URL}/inventory-status.json?t=${Date.now()}`, { signal: controller.signal });
    if (!response.ok) throw new Error('Website status unavailable');
    const data = await response.json();
    if (!Array.isArray(data) || !data.every(e => typeof e.path === 'string' && typeof e.revision === 'string')) throw new Error('Invalid website status');
    return data;
  } finally { clearTimeout(timeout); }
}
