import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { type ComponentRef, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getLastPhoto } from '@/services/capture-store';
import {
  manualEntryMessage,
  toManualEntryReason,
  validateManualEntry,
  type ManualEntryErrors,
} from '@/utils/manual-entry';

// Standard trading card ratio (63mm x 88mm).
const CARD_RATIO = 63 / 88;

function param(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

export default function ManualEntryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    /** Id into the in-memory capture store; the photo URI never goes in params. */
    photoId?: string;
    reason?: string;
    name?: string;
    number?: string;
    total?: string;
    lines?: string;
  }>();

  const photoId = param(params.photoId);
  const photoUri = getLastPhoto(photoId);
  const reason = toManualEntryReason(params.reason);
  const prefillNumber = param(params.number).trim();
  const prefillTotal = param(params.total).trim();

  const [name, setName] = useState(param(params.name).trim());
  const [number, setNumber] = useState(
    prefillNumber && prefillTotal ? `${prefillNumber}/${prefillTotal}` : prefillNumber,
  );
  const [errors, setErrors] = useState<ManualEntryErrors>({});
  const numberRef = useRef<ComponentRef<typeof TextInput>>(null);

  const submit = () => {
    const result = validateManualEntry({ name, number });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const { values } = result;
    router.replace({
      pathname: '/confirm',
      params: {
        name: values.name,
        number: values.localId ?? '',
        total: values.setTotal ? String(values.setTotal) : '',
        lines: param(params.lines),
        photoId,
      },
    });
  };

  const scanAgain = () => router.replace('/scan');

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={styles.photo}
            contentFit="contain"
            accessibilityLabel="Photo you took of the card"
          />
        ) : null}

        <Text style={styles.explanation}>{manualEntryMessage(reason)}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Card name</Text>
          <TextInput
            style={[styles.input, { color: colors.text }, errors.name && styles.inputError]}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="e.g. Pikachu"
            placeholderTextColor="#8e8e93"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => numberRef.current?.focus()}
            accessibilityLabel="Card name"
          />
          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Collector number (optional)</Text>
          <TextInput
            ref={numberRef}
            style={[styles.input, { color: colors.text }, errors.number && styles.inputError]}
            value={number}
            onChangeText={(text) => {
              setNumber(text);
              if (errors.number) setErrors((prev) => ({ ...prev, number: undefined }));
            }}
            placeholder="e.g. 4/102"
            placeholderTextColor="#8e8e93"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={submit}
            accessibilityLabel="Collector number"
          />
          {errors.number ? (
            <Text style={styles.errorText}>{errors.number}</Text>
          ) : (
            <Text style={styles.hint}>Printed at the bottom of the card.</Text>
          )}
        </View>

        <Pressable style={styles.primaryButton} onPress={submit} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Find card</Text>
        </Pressable>
        {reason !== 'permission' && (
          <Pressable style={styles.secondaryButton} onPress={scanAgain} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Scan again</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, gap: 16 },
  photo: {
    alignSelf: 'center',
    width: '60%',
    maxWidth: 260,
    aspectRatio: CARD_RATIO,
    borderRadius: 8,
    backgroundColor: '#d1d1d6',
  },
  explanation: { fontSize: 15, color: '#8e8e93', textAlign: 'center' },
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: '600', color: '#8e8e93' },
  input: {
    borderWidth: 1,
    borderColor: '#c7c7cc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17,
  },
  inputError: { borderColor: '#FF3B30' },
  errorText: { fontSize: 13, color: '#FF3B30' },
  hint: { fontSize: 13, color: '#8e8e93' },
  primaryButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  secondaryButton: { paddingVertical: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#208AEF', fontSize: 16, fontWeight: '600' },
});
