import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';
import { DraftImage, ensureDraftDirectory, photoUri } from './drafts';
import { fitPhoto } from './photoSizing';

import { FULL_PHOTO_BYTES, THUMBNAIL_BYTES } from './photoLimits';

async function compress(asset: { uri: string; width: number; height: number }, key: string): Promise<DraftImage> {
  const id = randomUUID();
  const localFile = `${id}.jpg`;
  const thumbFile = `${id}-thumb.jpg`;
  // Process one asset at a time, without retaining base64 copies in React state.
  for (const [edge, quality] of [[1600, 0.75], [1400, 0.65], [1200, 0.55], [1000, 0.45]]) {
    const result = await ImageManipulator.manipulateAsync(asset.uri,
      [{ resize: fitPhoto(asset.width, asset.height, edge) }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG });
    const info = await FileSystem.getInfoAsync(result.uri);
    if (info.exists && info.size <= FULL_PHOTO_BYTES) {
      await FileSystem.copyAsync({ from: result.uri, to: photoUri(key, localFile) });
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      break;
    }
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
  }
  if (!(await FileSystem.getInfoAsync(photoUri(key, localFile))).exists) throw new Error('This photo is too large to prepare. Choose a smaller version.');
  for (const [edge, quality] of [[640, 0.65], [480, 0.6], [360, 0.5]]) {
    const thumb = await ImageManipulator.manipulateAsync(photoUri(key, localFile),
      [{ resize: fitPhoto(asset.width, asset.height, edge) }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG });
    try {
      const info = await FileSystem.getInfoAsync(thumb.uri);
      if (info.exists && info.size <= THUMBNAIL_BYTES) {
        await FileSystem.copyAsync({ from: thumb.uri, to: photoUri(key, thumbFile) });
        break;
      }
    } finally { await FileSystem.deleteAsync(thumb.uri, { idempotent: true }); }
  }
  if (!(await FileSystem.getInfoAsync(photoUri(key, thumbFile))).exists) throw new Error('Could not prepare a small preview. Choose another photo.');
  return { id, repoPath: `images/uploads/${id}.jpg`, localFile, thumbFile };
}

export async function pickPhotos(limit: number, key: string, onPhoto: (photo: DraftImage) => Promise<void>, onProgress: (text: string) => void): Promise<void> {
  if (limit <= 0) return;
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access in iPhone Settings to add pictures.');
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: limit > 1, selectionLimit: limit, quality: 1 });
  if (picked.canceled) return;
  await ensureDraftDirectory(key);
  const assets = picked.assets.slice(0, limit);
  for (let i = 0; i < assets.length; i++) {
    onProgress(`Preparing photo ${i + 1} of ${assets.length}…`);
    await onPhoto(await compress(assets[i], key));
  }
}

/** Write a new image, never overwrite an uploaded photo or the uncropped source. */
export async function cropPhoto(photo: DraftImage, uri: string, key: string,
  rectangle: { originX: number; originY: number; width: number; height: number }): Promise<DraftImage> {
  await ensureDraftDirectory(key);
  let downloaded: string | undefined;
  let cropped: ImageManipulator.ImageResult | undefined;
  try {
    if (/^https?:/.test(uri)) {
      downloaded = `${FileSystem.cacheDirectory}${randomUUID()}-source.jpg`;
      const response = await FileSystem.downloadAsync(uri, downloaded);
      if (response.status !== 200) throw new Error('Could not download the original photo. Try again after the website finishes updating.');
    }
    cropped = await ImageManipulator.manipulateAsync(downloaded ?? uri, [{ crop: rectangle }],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG });
    const result = await compress(cropped, key);
    return { ...result, originalFile: photo.originalFile ?? photo.localFile,
      originalRepoPath: photo.originalRepoPath ?? photo.repoPath };
  } finally {
    if (cropped) await FileSystem.deleteAsync(cropped.uri, { idempotent: true }).catch(() => {});
    if (downloaded) await FileSystem.deleteAsync(downloaded, { idempotent: true }).catch(() => {});
  }
}
