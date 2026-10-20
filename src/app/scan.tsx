import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { parseOcrLines } from '@/services/card-matcher.service';
import { isOcrAvailable, recognizeCardText } from '@/services/ocr.service';

export default function ScanScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);

  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>
          PokeWorth needs camera access to photograph your card.
        </Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Grant camera access</Text>
        </Pressable>
      </View>
    );
  }

  const capture = async () => {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) throw new Error('No photo captured');

      if (!isOcrAvailable()) {
        Alert.alert(
          'OCR unavailable',
          'Text recognition needs a development build (it does not run in Expo Go). Use manual search instead.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }

      const ocr = await recognizeCardText(photo.uri);
      const parsed = parseOcrLines(ocr.lines);

      if (!parsed.name && !parsed.localId) {
        Alert.alert(
          'Could not read the card',
          'Try again with better lighting and the card filling the frame, or use manual search.',
        );
        return;
      }

      router.replace({
        pathname: '/confirm',
        params: {
          name: parsed.name ?? '',
          number: parsed.localId ?? '',
          total: parsed.setTotal ? String(parsed.setTotal) : '',
          lines: JSON.stringify(parsed.rawLines),
        },
      });
    } catch (e) {
      Alert.alert('Scan failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* Card alignment guide (standard card ratio 63:88). */}
      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.cardGuide} />
        <Text style={styles.guideText}>Align the card inside the frame</Text>
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.shutter} onPress={capture} disabled={busy}>
          {busy ? <ActivityIndicator color="#000" /> : <View style={styles.shutterInner} />}
        </Pressable>
        <View style={styles.cancelButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  permissionText: { fontSize: 16, textAlign: 'center' },
  primaryButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
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
    width: '75%',
    aspectRatio: 63 / 88,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
  },
  guideText: { color: '#fff', marginTop: 16, fontSize: 15 },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  cancelButton: { width: 80, alignItems: 'center' },
  cancelText: { color: '#fff', fontSize: 16 },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
});
