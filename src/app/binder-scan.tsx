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
import { setBinderCapture } from '@/services/binder-capture';
import { pickPictureSize } from '@/services/camera-size';
import {
  ENABLED_LAYOUTS,
  guideFrame,
  LAYOUTS,
  previewRectToPhoto,
  type BinderLayout,
  type Rect,
} from '@/services/binder-grid.model';
import { isOcrAvailable } from '@/services/ocr.service';
import { pickCardPhoto } from '@/services/photo-import.service';
import { colors, radius, space, type } from '@/theme/tokens';

/** Space kept clear above and below the guide for the controls. */
const TOP_CONTROLS = 112;
const BOTTOM_CONTROLS = 170;

export default function BinderScanScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [layout, setLayout] = useState<BinderLayout>('3x3');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  // The largest still-photo size; set once the camera is ready (see camera-size.ts).
  const [pictureSize, setPictureSize] = useState<string>();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const busyRef = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') getPermission().catch(() => {});
    });
    return () => sub.remove();
  }, [getPermission]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // The guide is drawn in screen points, from the same geometry the crop uses.
  const areaTop = insets.top + TOP_CONTROLS;
  const areaH = Math.max(200, screenH - areaTop - insets.bottom - BOTTOM_CONTROLS);
  const local = guideFrame(screenW, areaH, layout, 0.04);
  const guide: Rect = { ...local, originY: local.originY + areaTop };
  const { cols, rows } = LAYOUTS[layout];

  const start = (uri: string, frame: Rect | 'full') => {
    const id = setBinderCapture({ uri, layout, frame });
    router.replace({ pathname: '/binder-read', params: { id } });
  };

  const run = async (get: () => Promise<{ uri: string; frame: Rect | 'full' } | null>) => {
    if (busyRef.current) return;
    if (!isOcrAvailable()) {
      setMessage('Card reading is not available on this device.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      const shot = await get();
      if (shot) start(shot.uri, shot.frame);
    } catch (e) {
      if (__DEV__) console.warn('Binder capture failed', e);
      setMessage('Could not take the photo. Try again, or import one.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const capture = () =>
    run(async () => {
      // quality 1 and no extra processing: every pixel counts for the small collector number.
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
      if (!photo?.uri) throw new Error('No photo captured');
      if (__DEV__) console.warn(`Binder photo ${photo.width}×${photo.height}, size ${pictureSize ?? 'default'}`);
      // Map the on-screen guide to the photo, which the preview crops to fill the screen.
      const frame =
        photo.width && photo.height
          ? previewRectToPhoto(guide, { width: screenW, height: screenH }, { width: photo.width, height: photo.height })
          : 'full';
      return { uri: photo.uri, frame };
    });

  // An imported photo is taken as the whole page: crop it to the page first.
  const importPhoto = () =>
    run(async () => {
      const uri = await pickCardPhoto();
      return uri ? { uri, frame: 'full' as const } : null;
    });

  const layoutPicker = (
    <View style={styles.layouts} accessibilityRole="radiogroup" accessibilityLabel="Pockets per page">
      {ENABLED_LAYOUTS.map((l) => {
        const on = l === layout;
        return (
          <Pressable
            key={l}
            onPress={() => setLayout(l)}
            disabled={busy}
            style={[styles.layoutChip, on && styles.layoutChipOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}>
            <Text style={[styles.layoutText, on && styles.layoutTextOn]}>
              {LAYOUTS[l].cols}×{LAYOUTS[l].rows} · {LAYOUTS[l].label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const importButton = (
    <Pressable
      style={[styles.sideButton, busy && styles.disabled]}
      onPress={importPhoto}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Import a binder page photo">
      <Text style={styles.sideText}>Import photo</Text>
    </Pressable>
  );

  if (!permission || !permission.granted) {
    const canAsk = !permission || permission.status === 'undetermined' || permission.canAskAgain;
    return (
      <View style={[styles.center, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
        <ScanModeSwitch mode="binder" disabled={busy} />
        <Text style={styles.title}>Scan a binder page</Text>
        <Text style={styles.body}>
          Photograph a whole page and PokeWorth reads every pocket. You can also import a photo you
          already took.
        </Text>
        {layoutPicker}
        {permission && canAsk ? (
          <Pressable style={styles.primary} onPress={requestPermission} accessibilityRole="button">
            <Text style={styles.primaryText}>Allow camera access</Text>
          </Pressable>
        ) : permission ? (
          <Pressable style={styles.primary} onPress={() => Linking.openSettings().catch(() => {})} accessibilityRole="button">
            <Text style={styles.primaryText}>Open Settings</Text>
          </Pressable>
        ) : (
          <ActivityIndicator color={colors.goldText} />
        )}
        {importButton}
        {message ? <Text style={styles.error}>{message}</Text> : null}
        <Pressable style={styles.sideButton} onPress={goBack} accessibilityRole="button">
          <Text style={styles.sideText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const shade = 'rgba(0,0,0,0.55)';
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        pictureSize={pictureSize}
        onCameraReady={() => {
          cameraRef.current
            ?.getAvailablePictureSizesAsync()
            .then((sizes) => {
              const best = pickPictureSize(sizes);
              if (__DEV__) console.warn(`Camera sizes ${JSON.stringify(sizes)} → ${best}`);
              setPictureSize(best);
            })
            .catch(() => undefined);
        }}
      />

      {/* Dim everything outside the page guide. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={{ height: guide.originY, backgroundColor: shade }} />
        <View style={{ flexDirection: 'row', height: guide.height }}>
          <View style={{ width: guide.originX, backgroundColor: shade }} />
          <View style={[styles.guide, { width: guide.width, height: guide.height }]}>
            {Array.from({ length: rows }).map((_, r) => (
              <View key={r} style={styles.gridRow}>
                {Array.from({ length: cols }).map((__, c) => (
                  <View key={c} style={[styles.cell, c === cols - 1 && styles.cellLastCol, r === rows - 1 && styles.cellLastRow]} />
                ))}
              </View>
            ))}
          </View>
          <View style={{ flex: 1, backgroundColor: shade }} />
        </View>
        <View style={{ flex: 1, backgroundColor: shade }} />
      </View>

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <ScanModeSwitch mode="binder" disabled={busy} />
        {layoutPicker}
      </View>

      <View pointerEvents="none" style={[styles.tipWrap, { top: guide.originY + guide.height + space.sm }]}>
        <Text style={styles.tip}>
          {busy ? 'Taking the photo…' : 'Fit the page inside the gold frame. Shoot straight on; tilt slightly away from lights to avoid glare.'}
        </Text>
        {message ? <Text style={styles.error}>{message}</Text> : null}
      </View>

      <View style={[styles.controls, { bottom: insets.bottom + space.xl }]}>
        <Pressable style={styles.sideButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.sideText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.shutter, busy && styles.disabled]}
          onPress={capture}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Photograph the binder page">
          {busy ? <ActivityIndicator color={colors.textOnGold} /> : <View style={styles.shutterInner} />}
        </Pressable>
        {importButton}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingHorizontal: space.xl, backgroundColor: colors.bg },
  title: { ...type.title, fontSize: 24, color: colors.textPrimary, textAlign: 'center' },
  body: { ...type.body, color: colors.textSecondary, textAlign: 'center', maxWidth: 340 },
  primary: { minHeight: 48, paddingHorizontal: space.xl, borderRadius: radius.card, backgroundColor: colors.gold400, justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.textOnGold },
  error: { fontSize: 14, color: colors.down, textAlign: 'center' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center', gap: space.sm },
  layouts: { flexDirection: 'row', gap: space.sm },
  layoutChip: {
    minHeight: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    justifyContent: 'center',
    backgroundColor: 'rgba(3, 18, 41, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  layoutChipOn: { borderColor: colors.gold400, backgroundColor: 'rgba(253, 203, 86, 0.18)' },
  layoutText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  layoutTextOn: { color: colors.goldText },
  guide: { borderWidth: 2.5, borderColor: colors.gold400, borderRadius: 6, overflow: 'hidden' },
  gridRow: { flex: 1, flexDirection: 'row' },
  cell: { flex: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(253, 203, 86, 0.55)', borderStyle: 'dashed' },
  cellLastCol: { borderRightWidth: 0 },
  cellLastRow: { borderBottomWidth: 0 },
  tipWrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center', gap: 4 },
  tip: { fontSize: 14, lineHeight: 19, color: '#fff', textAlign: 'center' },
  controls: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  sideButton: { minWidth: 88, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  sideText: { fontSize: 16, color: '#fff', textAlign: 'center' },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.gold400,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: colors.textOnGold },
  disabled: { opacity: 0.5 },
});
