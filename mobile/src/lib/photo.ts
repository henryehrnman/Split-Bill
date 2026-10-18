import {AppState} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {ImageManipulator, SaveFormat} from 'expo-image-manipulator';

export type ReceiptPhoto = {data: string; mediaType: 'image/jpeg'};

// The vision model downscales anything with a long edge over 1568px, so sending more only slows the upload.
const LONG_EDGE = 1568;

/** Takes or picks a receipt photo and returns it as a small base64 JPEG, or null if the user cancels. */
export async function pickReceiptPhoto(camera: boolean): Promise<ReceiptPhoto | null> {
  if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Allow camera access to scan the receipt, or choose a photo instead.');
  const options: ImagePicker.ImagePickerOptions = {mediaTypes: ['images'], quality: 1};
  const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const edit = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > LONG_EDGE) edit.resize(asset.width >= asset.height ? {width: LONG_EDGE} : {height: LONG_EDGE});
  const image = await (await edit.renderAsync()).saveAsync({format: SaveFormat.JPEG, compress: 0.75, base64: true});
  const data = image.base64?.replace(/^data:[^,]*,/, '');
  if (!data) throw new Error('Could not read that photo. Try another.');
  return {data, mediaType: 'image/jpeg'};
}

/**
 * The camera and photo library background the app. Resolves once it is active again and the
 * screen's own AppState listener has run, so returning from the picker never reads as leaving.
 */
export function untilActive(): Promise<void> {
  return new Promise(resolve => {
    const settle = () => setTimeout(resolve, 0);
    if (AppState.currentState === 'active') return settle();
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      sub.remove();
      settle();
    });
  });
}
