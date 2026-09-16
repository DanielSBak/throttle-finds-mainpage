import * as FileSystem from 'expo-file-system/legacy';
import { Draft, photoUri } from './drafts';
import { carTitle, normalizeNumber, saveCar, validateCar } from './cars';
import { putBinaryFile } from './github';

/** Stable file names + content checks make every step safe to repeat after interruption. */
export async function publishDraft(key: string, draft: Draft, onProgress: (text: string) => void): Promise<void> {
  const problem = validateCar(draft.car, draft.images.length);
  if (problem) throw new Error(problem);
  for (let i = 0; i < draft.images.length; i++) {
    const photo = draft.images[i];
    if (!photo.localFile) continue;
    onProgress(`Uploading photo ${i + 1} of ${draft.images.length}…`);
    const base64 = await FileSystem.readAsStringAsync(photoUri(key, photo.localFile), { encoding: FileSystem.EncodingType.Base64 });
    await putBinaryFile(photo.repoPath, base64, `Add photo for ${carTitle(draft.car)} [via app]`);
    if (photo.thumbFile) {
      const thumb = await FileSystem.readAsStringAsync(photoUri(key, photo.thumbFile), { encoding: FileSystem.EncodingType.Base64 });
      await putBinaryFile(photo.repoPath.replace('images/uploads/', 'images/uploads/thumbs/'), thumb, `Add thumbnail for ${carTitle(draft.car)} [via app]`);
    }
  }
  onProgress('Saving listing…');
  await saveCar({ ...draft.car, price: normalizeNumber(draft.car.price)!, mileage: normalizeNumber(draft.car.mileage)!,
    main_image: draft.images[0].repoPath, gallery: draft.images.slice(1).map((p) => p.repoPath) });
}
