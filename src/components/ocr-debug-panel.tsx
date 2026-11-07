import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  rawLines: string[];
  name?: string;
  localId?: string;
  setTotal?: number;
};

/**
 * Dev-only panel showing what OCR read and what the parser extracted.
 * Callers must guard rendering with `__DEV__` so it never ships in release builds.
 */
export function OcrDebugPanel({ rawLines, name, localId, setTotal }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.panel}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}>
        <Text style={styles.title}>
          {open ? '▾' : '▸'} OCR debug ({rawLines.length} lines)
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <Text style={styles.mono}>name:     {name ?? 'none'}</Text>
          <Text style={styles.mono}>number:   {localId ?? 'none'}</Text>
          <Text style={styles.mono}>setTotal: {setTotal ?? 'none'}</Text>
          <Text style={[styles.mono, styles.section]}>raw lines:</Text>
          {rawLines.length === 0 ? (
            <Text style={styles.mono}>none</Text>
          ) : (
            rawLines.map((line, i) => (
              <Text key={i} style={styles.mono}>
                {String(i + 1).padStart(2, ' ')}: {line}
              </Text>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: '#ff9f0a',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    alignSelf: 'stretch',
  },
  title: { fontFamily: mono, fontSize: 13, fontWeight: '600', color: '#ff9f0a' },
  body: { marginTop: 6, gap: 2 },
  section: { marginTop: 6 },
  mono: { fontFamily: mono, fontSize: 12, color: '#8e8e93' },
});
