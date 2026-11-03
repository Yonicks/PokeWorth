/**
 * In-memory holder for the last captured photo.
 *
 * Photo URIs must not travel through route params: on web, expo-camera returns
 * a multi-MB base64 data URI and Expo Router writes params into the URL, which
 * would put the user's photo in the address bar and browser history. Screens
 * pass the short id instead and look the URI up here. Only the latest photo is
 * kept, and nothing is persisted.
 */

let lastPhoto: { id: string; uri: string } | null = null;
let counter = 0;

/** Stores the photo URI and returns a short id to pass between screens. */
export function setLastPhoto(uri: string): string {
  counter += 1;
  const id = `${Date.now().toString(36)}-${counter}`;
  lastPhoto = { id, uri };
  return id;
}

/** Returns the stored URI for this id, or '' if it was replaced or never stored. */
export function getLastPhoto(id: string | undefined): string {
  if (!id || !lastPhoto || lastPhoto.id !== id) return '';
  return lastPhoto.uri;
}
