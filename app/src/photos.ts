import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';
import { DraftImage, ensureDraftDirectory, photoUri } from './drafts';
import { fitPhoto } from './photoSizing';

const TARGET_BYTES = 900 * 1024;

async function compress(asset: ImagePicker.ImagePickerAsset, key: string): Promise<DraftImage> {
  const id = randomUUID();
  const localFile = `${id}.jpg`;
  const thumbFile = `${id}-thumb.jpg`;
  // Process one asset at a time, without retaining ten base64 copies in React state.
  for (const [edge, quality] of [[1600, 0.75], [1400, 0.65], [1200, 0.55], [1000, 0.45]]) {
    const result = await ImageManipulator.manipulateAsync(asset.uri,
      [{ resize: fitPhoto(asset.width, asset.height, edge) }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG });
    const info = await FileSystem.getInfoAsync(result.uri);
    if (info.exists && info.size <= TARGET_BYTES) {
      await FileSystem.copyAsync({ from: result.uri, to: photoUri(key, localFile) });
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      break;
    }
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
  }
  if (!(await FileSystem.getInfoAsync(photoUri(key, localFile))).exists) throw new Error('This photo is too large to prepare. Choose a smaller version.');
  const thumb = await ImageManipulator.manipulateAsync(photoUri(key, localFile),
    [{ resize: fitPhoto(asset.width, asset.height, 480) }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
  await FileSystem.copyAsync({ from: thumb.uri, to: photoUri(key, thumbFile) });
  await FileSystem.deleteAsync(thumb.uri, { idempotent: true });
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
