import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export interface PickedPhoto {
  /** Local URI for previewing in the form. */
  uri: string;
  /** JPEG bytes, base64 — ready for the GitHub contents API. */
  base64: string;
}

const MAX_WIDTH = 1800;
const JPEG_QUALITY = 0.8;

async function compress(uri: string): Promise<PickedPhoto> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return { uri: result.uri, base64: result.base64 ?? '' };
}

/** Opens the photo library and returns compressed JPEGs ready to upload. */
export async function pickPhotos(limit: number): Promise<PickedPhoto[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
  });
  if (picked.canceled) return [];
  return Promise.all(picked.assets.map((a) => compress(a.uri)));
}
