import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setLastPhoto } from '@/services/capture-store';
import { parseOcrLines } from '@/services/card-matcher.service';
import { isOcrAvailable, recognizeCardText } from '@/services/ocr.service';
import { pickCardPhoto } from '@/services/photo-import.service';

// Standard trading card ratio (63mm x 88mm).
const CARD_RATIO = 63 / 88;

export default function ScanScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  // Shown in-screen when Settings cannot be opened (Alert does nothing on web).
  const [settingsFailed, setSettingsFailed] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // A ref (not just state) so a second tap before re-render is ignored.
  const busyRef = useRef(false);
  // Cancel stays usable mid-capture; results arriving after unmount are dropped.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Coming back from "Open Settings" does not remount this screen, so re-read
  // the permission whenever the app becomes active again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') getPermission().catch(() => {});
    });
    return () => sub.remove();
  }, [getPermission]);

  // The header is hidden for this screen and web has no hardware back,
  // so every state needs its own way out.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const enterManually = () =>
    router.replace({ pathname: '/manual-entry', params: { reason: 'permission' } });

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (e) {
      if (__DEV__) console.warn('Could not open Settings', e);
      if (mountedRef.current) setSettingsFailed(true);
    }
  };

  // Camera photos and imported photos share this path so they cannot drift apart.
  // Only the short store id goes into route params, never the URI itself.
  const processPhoto = async (photoUri: string, photoId: string) => {
    if (!isOcrAvailable()) {
      router.replace({
        pathname: '/manual-entry',
        params: { photoId, reason: 'ocr-unavailable' },
      });
      return;
    }

    const ocr = await recognizeCardText(photoUri);
    if (!mountedRef.current) return;
    const parsed = parseOcrLines(ocr.lines);

    if (!parsed.name && !parsed.localId) {
      router.replace({
        pathname: '/manual-entry',
        params: { photoId, reason: 'no-text', lines: JSON.stringify(parsed.rawLines) },
      });
      return;
    }

    router.replace({
      pathname: '/confirm',
      params: {
        name: parsed.name ?? '',
        number: parsed.localId ?? '',
        total: parsed.setTotal ? String(parsed.setTotal) : '',
        lines: JSON.stringify(parsed.rawLines),
        photoId,
      },
    });
  };

  // Runs one capture or import. getPhotoUri resolves null when the user cancels,
  // which clears busy and stays on Scan.
  const runScan = async (getPhotoUri: () => Promise<string | null>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    // Kept so every failure path below can still show the photo on manual entry.
    let photoId = '';
    try {
      const photoUri = await getPhotoUri();
      if (!mountedRef.current || !photoUri) return;
      photoId = setLastPhoto(photoUri);
      await processPhoto(photoUri, photoId);
    } catch (e) {
      // Raw error text is for developers only; manual entry shows friendly copy.
      if (__DEV__) console.warn('Scan failed', e);
      if (!mountedRef.current) return;
      router.replace({
        pathname: '/manual-entry',
        params: photoId ? { photoId, reason: 'error' } : { reason: 'error' },
      });
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const capture = () => {
    if (!cameraRef.current) return;
    return runScan(async () => {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) throw new Error('No photo captured');
      return photo.uri;
    });
  };

  // Importing needs no camera, so it is offered in the permission states too.
  const importPhoto = () => runScan(pickCardPhoto);

  const importButton = (
    <Pressable
      style={[styles.secondaryButton, busy && styles.disabled]}
      onPress={importPhoto}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Import card photo"
      accessibilityState={{ disabled: busy, busy }}>
      <Text style={styles.secondaryButtonText}>Import photo</Text>
    </Pressable>
  );

  const permissionPadding = {
    paddingTop: insets.top + 24,
    paddingBottom: insets.bottom + 24,
    paddingLeft: insets.left + 24,
    paddingRight: insets.right + 24,
  };

  if (!permission) {
    return (
      <View style={[styles.center, permissionPadding]}>
        <ActivityIndicator />
        <Text style={styles.permissionText}>Checking camera access…</Text>
        <Pressable style={styles.secondaryButton} onPress={goBack}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (!permission.granted) {
    const canAsk = permission.status === 'undetermined' || permission.canAskAgain;
    return (
      <View style={[styles.center, permissionPadding]}>
        {canAsk ? (
          <>
            <Text style={styles.permissionTitle}>Camera access needed</Text>
            <Text style={styles.permissionText}>
              PokeWorth uses the camera to photograph your card and read its name and number.
            </Text>
            <Pressable style={styles.primaryButton} onPress={requestPermission}>
              <Text style={styles.primaryButtonText}>Allow camera access</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.permissionTitle}>Camera access is off</Text>
            <Text style={styles.permissionText}>
              Camera access for PokeWorth is turned off. Turn it on in Settings to scan cards.
            </Text>
            <Pressable style={styles.primaryButton} onPress={openSettings}>
              <Text style={styles.primaryButtonText}>Open Settings</Text>
            </Pressable>
            {settingsFailed && (
              <Text style={styles.permissionText}>
                Could not open Settings. Open your device settings and allow camera access for
                PokeWorth.
              </Text>
            )}
          </>
        )}
        {importButton}
        {busy && (
          <View style={styles.busyRow}>
            <ActivityIndicator />
            <Text style={styles.permissionText}>Reading card…</Text>
          </View>
        )}
        {permission.status === 'denied' && (
          <Pressable style={styles.secondaryButton} onPress={enterManually}>
            <Text style={styles.secondaryButtonText}>Enter card manually</Text>
          </Pressable>
        )}
        <Pressable style={styles.secondaryButton} onPress={goBack}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  // Fit the guide by width and height so it never crowds the controls on short screens.
  const guideWidth = Math.min(screenWidth * 0.75, screenHeight * 0.55 * CARD_RATIO);

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* Card alignment guide (standard card ratio 63:88). */}
      <View pointerEvents="none" style={styles.overlay}>
        <View style={[styles.cardGuide, { width: guideWidth }]} />
        <Text style={styles.guideText}>
          {busy ? 'Reading card…' : 'Align the card inside the frame'}
        </Text>
      </View>

      <View style={[styles.controls, { bottom: insets.bottom + 24 }]}>
        <Pressable
          style={styles.cancelButton}
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Cancel scan">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.shutter, busy && styles.shutterBusy]}
          onPress={capture}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Capture card photo"
          accessibilityState={{ disabled: busy, busy }}>
          {busy ? <ActivityIndicator color="#000" /> : <View style={styles.shutterInner} />}
        </Pressable>
        <Pressable
          style={[styles.cancelButton, busy && styles.disabled]}
          onPress={importPhoto}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Import card photo"
          accessibilityState={{ disabled: busy, busy }}>
          <Text style={styles.cancelText}>Import photo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  permissionTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  permissionText: { fontSize: 16, textAlign: 'center' },
  primaryButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { paddingHorizontal: 20, paddingVertical: 10 },
  secondaryButtonText: { color: '#208AEF', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardGuide: {
    aspectRatio: CARD_RATIO,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
  },
  guideText: { color: '#fff', marginTop: 16, fontSize: 15 },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  cancelButton: { width: 80, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterBusy: { opacity: 0.7 },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
});
