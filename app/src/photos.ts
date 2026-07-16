import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export interface PickedPhoto {
  /** Local URI for previewing in the form. */
  uri: string;
  /** Full-size JPEG bytes, base64 — ready for the GitHub contents API. */
  base64: string;
  /** Small 480px JPEG bytes, base64 — uploaded next to the full photo so the
   *  website can show lightweight thumbnails instead of megabyte files. */
  thumbBase64: string;
}

const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.75;
const THUMB_WIDTH = 480;
const THUMB_QUALITY = 0.7;

async function resizeJpeg(uri: string, width: number, quality: number) {
  return ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
}

async function compress(uri: string): Promise<PickedPhoto> {
  const full = await resizeJpeg(uri, MAX_WIDTH, JPEG_QUALITY);
  const thumb = await resizeJpeg(uri, THUMB_WIDTH, THUMB_QUALITY);
  return { uri: full.uri, base64: full.base64 ?? '', thumbBase64: thumb.base64 ?? '' };
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
