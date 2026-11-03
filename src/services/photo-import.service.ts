/**
 * Picks an existing card photo from the device library (or a file on web).
 *
 * Android uses the system photo picker, which needs no runtime permission.
 * On web the returned URI is a `blob:` URL. Like camera photos, the URI must
 * go into the capture store and never into route params.
 */

import * as ImagePicker from 'expo-image-picker';

/** Returns the picked image's URI, or null when the user cancels. */
export async function pickCardPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri || null;
}
