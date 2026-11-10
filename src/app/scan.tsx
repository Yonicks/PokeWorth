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

import { ScanModeSwitch } from '@/components/scan-mode-switch';
import { setLastPhoto } from '@/services/capture-store';
import { matchCard, parseOcrLines } from '@/services/card-matcher.service';
import {
  autoSettings,
  autoStatusText,
  emptyStreak,
  hasReadableCard,
  isAccepted,
  isRateLimit,
  nextStreak,
  stopText,
  type StopReason,
} from '@/services/live-scan.model';
import {
  isAutoScanAvailable,
  isDeviceOcrAvailable,
  isOcrAvailable,
  recognizeCardText,
  recognizeFrame,
} from '@/services/ocr.service';
import { pickCardPhoto } from '@/services/photo-import.service';
import { logScan } from '@/services/scan-log.service';

// Standard trading card ratio (63mm x 88mm).
const CARD_RATIO = 63 / 88;

export default function ScanScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  // Auto-scan ended by itself (timeout or limit): its message stays under the frame.
  const [stopped, setStopped] = useState(false);
  const [autoStatus, setAutoStatus] = useState(autoStatusText(emptyStreak, 0));
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
  // `preRead` is the text auto-scan already read from this photo, so it is not read twice.
  const processPhoto = async (
    photoUri: string,
    photoId: string,
    photoMs?: number,
    preRead?: { lines: string[]; readMs: number; source: 'device' | 'cloud' },
  ) => {
    if (!preRead && !isOcrAvailable()) {
      router.replace({
        pathname: '/manual-entry',
        params: { photoId, reason: 'ocr-unavailable' },
      });
      return;
    }

    const readStart = Date.now();
    const ocr = preRead
      ? { lines: preRead.lines, source: preRead.source }
      : await recognizeCardText(photoUri);
    const readMs = preRead ? preRead.readMs : Date.now() - readStart;
    if (!mountedRef.current) return;
    const parsed = parseOcrLines(ocr.lines);

    // Scan log (S0): step times and what was read. Matching time is added on Confirm.
    const logId = logScan({
      kind: 'card',
      photoMs,
      readMs,
      ocr: ocr.source,
      lines: parsed.rawLines,
      name: parsed.name,
      number: parsed.localId,
      total: parsed.setTotal,
    });

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
        logId,
      },
    });
  };

  // Runs one capture or import. getPhotoUri resolves null when the user cancels,
  // which clears busy and stays on Scan.
  const runScan = async (getPhotoUri: () => Promise<string | null>, timePhoto = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    // Kept so every failure path below can still show the photo on manual entry.
    let photoId = '';
    try {
      const photoStart = Date.now();
      const photoUri = await getPhotoUri();
      if (!mountedRef.current || !photoUri) return;
      // Only the camera is timed; picking a photo is the user's own time.
      const photoMs = timePhoto ? Date.now() - photoStart : undefined;
      photoId = setLastPhoto(photoUri);
      await processPhoto(photoUri, photoId, photoMs);
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
    }, true);
  };

  // Auto-scan (S4): small photos in a loop, read on the phone, accepted when two frames in a
  // row match the same card confidently. With the phone's own reader (development or release
  // build) frames are fast; in Expo Go they go to the cloud reader, so they are slow and short.
  const processRef = useRef(processPhoto);
  useEffect(() => {
    processRef.current = processPhoto;
  });

  useEffect(() => {
    if (!auto) return;
    let stop = false;
    const started = Date.now();
    let streak = emptyStreak;
    let frames = 0;
    // Own reader: fast frames. Cloud reader (Expo Go): slow frames and an early stop.
    const deviceReader = isDeviceOcrAvailable();
    const pace = autoSettings(deviceReader);
    const source = deviceReader ? ('device' as const) : ('cloud' as const);
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const giveUp = (reason: StopReason) => {
      if (!mountedRef.current) return;
      setAutoStatus(stopText(reason, deviceReader));
      setStopped(true);
      setAuto(false);
    };

    void (async () => {
      while (!stop && mountedRef.current) {
        if (Date.now() - started > pace.timeoutMs) {
          giveUp('timeout');
          return;
        }
        if (busyRef.current || !cameraRef.current) {
          await sleep(150);
          continue;
        }
        busyRef.current = true;
        try {
          const t0 = Date.now();
          const photo = await cameraRef.current.takePictureAsync({
            quality: pace.quality,
            shutterSound: false,
          });
          if (stop || !photo?.uri) continue;
          const photoMs = Date.now() - t0;
          const r0 = Date.now();
          const lines = await recognizeFrame(photo.uri);
          const readMs = Date.now() - r0;
          if (stop) continue;
          frames++;
          const parsed = parseOcrLines(lines);
          const confidentId = hasReadableCard(parsed) ? (await matchCard(parsed)).confidentCardId : undefined;
          streak = nextStreak(streak, confidentId);
          if (mountedRef.current) setAutoStatus(autoStatusText(streak, frames));
          if (isAccepted(streak)) {
            stop = true;
            await processRef.current(photo.uri, setLastPhoto(photo.uri), photoMs, { lines, readMs, source });
            return;
          }
        } catch (e) {
          // The cloud's daily limit ends auto-scan; any other bad frame just tries again.
          if (isRateLimit(e)) {
            stop = true;
            giveUp('limit');
            return;
          }
          if (__DEV__) console.warn('Auto-scan frame failed', e);
        } finally {
          busyRef.current = false;
        }
        await sleep(pace.gapMs);
      }
    })();

    return () => {
      stop = true;
    };
  }, [auto]);

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
        <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={goBack}>
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
            <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={requestPermission}>
              <Text style={styles.primaryButtonText}>Allow camera access</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.permissionTitle}>Camera access is off</Text>
            <Text style={styles.permissionText}>
              Camera access for PokeWorth is turned off. Turn it on in Settings to scan cards.
            </Text>
            <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={openSettings}>
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
          <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={enterManually}>
            <Text style={styles.secondaryButtonText}>Enter card manually</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={goBack}>
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
          {auto || stopped ? autoStatus : busy ? 'Reading card…' : 'Align the card inside the frame'}
        </Text>
      </View>

      <View style={[styles.modeSwitch, { top: insets.top + 8 }]}>
        <ScanModeSwitch mode="card" disabled={busy} />
        {isAutoScanAvailable() && (
          <Pressable
            style={[styles.autoButton, auto && styles.autoButtonOn]}
            onPress={() => {
              setAutoStatus(autoStatusText(emptyStreak, 0));
              setStopped(false);
              setAuto((on) => !on);
            }}
            accessibilityRole="switch"
            accessibilityLabel="Auto-scan"
            accessibilityState={{ checked: auto }}>
            <Text style={styles.autoButtonText}>{auto ? 'Auto-scan: on' : 'Auto-scan: off'}</Text>
          </Pressable>
        )}
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
          style={[styles.shutter, (busy || auto) && styles.shutterBusy]}
          onPress={capture}
          disabled={busy || auto}
          accessibilityRole="button"
          accessibilityLabel="Capture card photo"
          accessibilityState={{ disabled: busy || auto, busy }}>
          {busy ? <ActivityIndicator color="#000" /> : <View style={styles.shutterInner} />}
        </Pressable>
        <Pressable
          style={[styles.cancelButton, (busy || auto) && styles.disabled]}
          onPress={importPhoto}
          disabled={busy || auto}
          accessibilityRole="button"
          accessibilityLabel="Import card photo"
          accessibilityState={{ disabled: busy || auto, busy }}>
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
  modeSwitch: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 8 },
  autoButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  autoButtonOn: { backgroundColor: '#208AEF', borderColor: '#208AEF' },
  autoButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
