import { SITE_URL } from './config';
import { deleteFile, getTextFile, listDir, putTextFile } from './github';

export interface Car {
  year: string;
  make: string;
  model: string;
  price: string;
  vin: string;
  mileage: string;
  engine: string;
  fuel: string;
  transmission: string;
  drive: string;
  exterior_color: string;
  interior_color: string;
  title_status: string;
  sold: boolean;
  main_image: string;
  gallery: string[];
  body: string;
  /** Repo path + blob sha, present for cars loaded from GitHub. */
  path?: string;
  sha?: string;
}

export const FUEL_OPTIONS = ['Gasoline', 'Diesel', 'Hybrid', 'Electric'];
export const DRIVE_OPTIONS = ['AWD', 'RWD', 'FWD', '4x4'];
export const TITLE_OPTIONS = ['Clean Title', 'Rebuilt Title', 'Salvage Title', 'Bill of Sale'];

export function emptyCar(): Car {
  return {
    year: '', make: '', model: '', price: '', vin: '', mileage: '',
    engine: '', fuel: 'Gasoline', transmission: '', drive: 'RWD',
    exterior_color: '', interior_color: '', title_status: 'Clean Title',
    sold: false, main_image: '', gallery: [], body: '',
  };
}

function unquote(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    if (t.startsWith('"')) {
      try { return JSON.parse(t) as string; } catch { /* Preserve legacy malformed strings. */ }
    }
    return t.slice(1, -1).replace(/''/g, "'");
  }
  return t;
}

/** Parses the simple flat front matter our listings use (no nested maps). */
export function parseCar(text: string): Car {
  const car = emptyCar();
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return car;
  const [, fm, body] = m;
  car.body = body.trim();

  let currentList: string[] | null = null;
  for (const rawLine of fm.split(/\r?\n/)) {
    const listItem = rawLine.match(/^\s+-\s+(.+)$/);
    if (listItem && currentList) {
      currentList.push(unquote(listItem[1]));
      continue;
    }
    currentList = null;
    const kv = rawLine.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    if (key === 'gallery') {
      currentList = car.gallery;
      continue;
    }
    if (key === 'sold') {
      car.sold = unquote(value).toLowerCase() === 'true';
      continue;
    }
    if (key in car) {
      (car as unknown as Record<string, string>)[key] = unquote(value);
    }
  }
  return car;
}

function yamlString(v: string): string {
  return JSON.stringify(v.trim());
}

export function serializeCar(car: Car): string {
  const lines = [
    '---',
    `year: ${car.year.trim()}`,
    `make: ${yamlString(car.make)}`,
    `model: ${yamlString(car.model)}`,
    `price: ${car.price.trim()}`,
    `vin: ${yamlString(car.vin)}`,
    `mileage: ${car.mileage.trim()}`,
    `engine: ${yamlString(car.engine)}`,
    `fuel: ${yamlString(car.fuel)}`,
    `transmission: ${yamlString(car.transmission)}`,
    `drive: ${yamlString(car.drive)}`,
    `exterior_color: ${yamlString(car.exterior_color)}`,
    `interior_color: ${yamlString(car.interior_color)}`,
    `title_status: ${yamlString(car.title_status)}`,
    `sold: ${car.sold}`,
    `main_image: ${yamlString(car.main_image)}`,
  ];
  if (car.gallery.length > 0) {
    lines.push('gallery:');
    for (const img of car.gallery) lines.push(`  - ${yamlString(img)}`);
  }
  lines.push('---', '', car.body.trim(), '');
  return lines.join('\n');
}

export function slugify(car: Car): string {
  return `${car.year}-${car.make}-${car.model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function carTitle(car: Car): string {
  return `${car.year} ${car.make} ${car.model}`.trim();
}

/** Public URL for an image path stored in the repo (site serves the repo). */
export function imageUrl(repoPath: string): string {
  if (!repoPath) return '';
  return `${SITE_URL}/${repoPath.replace(/^\/+/, '')}`;
}

export async function fetchCars(): Promise<Car[]> {
  const files = await listDir('_cars');
  const cars = await Promise.all(
    files
      .filter((f) => f.name.endsWith('.md'))
      .map(async (f) => {
        const { text, sha } = await getTextFile(f.path);
        const car = parseCar(text);
        car.path = f.path;
        car.sha = sha;
        return car;
      })
  );
  // Newest first, matching the website
  return cars.reverse();
}

export async function saveCar(car: Car): Promise<string> {
  if (!car.path) throw new Error('Missing listing ID. Reopen the draft before publishing.');
  const isNew = !car.sha;
  const path = car.path;
  const message = isNew
    ? `Add listing: ${carTitle(car)} [via app]`
    : `Update listing: ${carTitle(car)} [via app]`;
  return putTextFile(path, serializeCar(car), message, car.sha);
}

export async function setSold(car: Car, sold: boolean): Promise<void> {
  if (!car.path || !car.sha) throw new Error('Car has not been saved yet');
  const updated = { ...car, sold };
  const message = sold
    ? `Mark sold: ${carTitle(car)} [via app]`
    : `Mark available: ${carTitle(car)} [via app]`;
  await putTextFile(car.path, serializeCar(updated), message, car.sha);
}

export async function removeCar(car: Car): Promise<void> {
  if (!car.path || !car.sha) throw new Error('Car has not been saved yet');
  await deleteFile(car.path, car.sha, `Remove listing: ${carTitle(car)} [via app]`);
}

/** The UUID belongs to the draft, so retries never create a second listing. */
export function newListingPath(car: Car, id: string): string {
  return `_cars/${slugify(car).slice(0, 90) || 'car'}-${id}.md`;
}

export function normalizeNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const plain = trimmed.replace(/,/g, '');
  const n = Number(plain);
  return Number.isFinite(n) && n <= Number.MAX_SAFE_INTEGER ? String(n) : null;
}

export function validateCar(car: Car, photoCount: number): string | null {
  if (!/^\d{4}$/.test(car.year.trim()) || Number(car.year) < 1886 || Number(car.year) > new Date().getFullYear() + 2) return 'Enter a valid 4-digit model year';
  if (!car.make.trim()) return 'Enter the make (e.g. BMW)';
  if (!car.model.trim()) return 'Enter the model (e.g. M5)';
  const price = normalizeNumber(car.price);
  if (price === null || Number(price) <= 0) return 'Enter a price greater than zero (e.g. 24,500)';
  const mileage = normalizeNumber(car.mileage);
  if (mileage === null || !Number.isInteger(Number(mileage))) return 'Enter mileage as a whole number (e.g. 93,000)';
  if (photoCount < 1 || photoCount > 10) return 'Add between 1 and 10 photos';
  return null;
}
