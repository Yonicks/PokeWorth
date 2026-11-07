/**
 * Pick the camera's largest still-photo size (binder pages need every pixel:
 * the collector number is tiny). expo-camera's `pictureSize` defaults to a
 * lower preset, and `getAvailablePictureSizesAsync()` differs by platform:
 * iOS returns session preset names ("Photo" is the full-resolution still
 * preset), Android and web return "WxH" strings.
 */
export function pickPictureSize(sizes: string[] | undefined): string | undefined {
  if (!sizes || sizes.length === 0) return undefined;
  if (sizes.includes('Photo')) return 'Photo';
  let best: string | undefined;
  let bestArea = 0;
  for (const s of sizes) {
    const m = /(\d+)\s*x\s*(\d+)/i.exec(s);
    if (!m) continue;
    const area = Number(m[1]) * Number(m[2]);
    if (area > bestArea) {
      bestArea = area;
      best = s;
    }
  }
  return best ?? (sizes.includes('High') ? 'High' : undefined);
}
