import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';
import { Car, emptyCar, newListingPath } from './cars';

export interface DraftImage {
  id: string;
  /** Existing repository image, or stable destination for a new photo. */
  repoPath: string;
  /** File names relative to the draft directory; survive iOS container changes. */
  localFile?: string;
  thumbFile?: string;
}
export interface Draft {
  version: 1;
  id: string;
  car: Car;
  images: DraftImage[];
}
export const draftKey = (car: Car | null) => car?.path ?? 'new';

export function createDraft(car: Car | null): Draft {
  return {
    version: 1, id: randomUUID(), car: car ? { ...car } : emptyCar(),
    images: car ? [car.main_image, ...car.gallery].filter(Boolean).map((repoPath) => ({ id: randomUUID(), repoPath })) : [],
  };
}
export function prepareDraft(draft: Draft): Draft {
  return { ...draft, car: { ...draft.car, path: draft.car.path ?? newListingPath(draft.car, draft.id) } };
}
export function draftDirectory(key: string): string {
  if (!FileSystem.documentDirectory) throw new Error('Local storage is unavailable on this device.');
  return `${FileSystem.documentDirectory}inventory-drafts/${encodeURIComponent(key)}/`;
}
export function photoUri(key: string, name: string): string { return draftDirectory(key) + name; }
export async function ensureDraftDirectory(key: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(draftDirectory(key), { intermediates: true });
}

const queues = new Map<string, Promise<void>>();
const revisions = new Map<string, number>();
function enqueue(key: string, action: () => Promise<void>): Promise<void> {
  const job = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(action);
  queues.set(key, job);
  return job;
}

/** Alternating snapshots keep the last complete draft if a write is interrupted. */
export async function loadDraft(key: string): Promise<Draft | null> {
  await (queues.get(key) ?? Promise.resolve()).catch(() => {});
  const snapshots: Array<{ revision: number; draft: Draft }> = [];
  let filesExist = false;
  for (const slot of [0, 1]) {
    const uri = photoUri(key, `draft-${slot}.json`);
    if (!(await FileSystem.getInfoAsync(uri)).exists) continue;
    filesExist = true;
    try {
      const snapshot = JSON.parse(await FileSystem.readAsStringAsync(uri));
      if (snapshot.draft?.version === 1 && snapshot.draft.car && Array.isArray(snapshot.draft.images) && Number.isSafeInteger(snapshot.revision)) snapshots.push(snapshot);
    } catch { /* The other slot can survive an interrupted write. */ }
  }
  snapshots.sort((a, b) => b.revision - a.revision);
  const latest = snapshots[0];
  if (!latest && filesExist) throw new Error('The saved draft could not be read. It has been left on this phone for recovery.');
  if (latest) revisions.set(key, latest.revision);
  return latest?.draft ?? null;
}
export function saveDraft(key: string, draft: Draft): Promise<void> {
  const revision = (revisions.get(key) ?? 0) + 1;
  revisions.set(key, revision);
  const snapshot = JSON.stringify({ revision, draft });
  return enqueue(key, async () => {
    await ensureDraftDirectory(key);
    await FileSystem.writeAsStringAsync(photoUri(key, `draft-${revision % 2}.json`), snapshot);
  });
}
export function deleteDraft(key: string): Promise<void> {
  return enqueue(key, async () => {
    await FileSystem.deleteAsync(draftDirectory(key), { idempotent: true });
    revisions.delete(key);
  });
}
