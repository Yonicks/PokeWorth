import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OcrDebugPanel } from '@/components/ocr-debug-panel';
import { useCardMatch } from '@/hooks/use-cards';
import { splitStrongMatches } from '@/services/card-matcher.service';
import { cardImageUrl } from '@/services/tcgdex.service';
import type { ParsedCardText, ScoredCandidate } from '@/types/card';

export default function ConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    number?: string;
    total?: string;
    lines?: string;
    /** Capture-store id of the photo; only for manual entry / debug, never shown as card artwork. */
    photoId?: string;
  }>();

  const enterManually = () =>
    router.push({
      pathname: '/manual-entry',
      params: {
        name: typeof params.name === 'string' ? params.name : '',
        number: typeof params.number === 'string' ? params.number : '',
        total: typeof params.total === 'string' ? params.total : '',
        lines: typeof params.lines === 'string' ? params.lines : '',
        photoId: typeof params.photoId === 'string' ? params.photoId : '',
      },
    });

  const rawLines: string[] = useMemo(() => {
    try {
      if (typeof params.lines === 'string' && params.lines) {
        const value: unknown = JSON.parse(params.lines);
        if (Array.isArray(value)) return value.map(String);
      }
    } catch {
      // Raw lines are debug-only; ignore malformed input.
    }
    return [];
  }, [params.lines]);

  const parsed: ParsedCardText | null = useMemo(() => {
    const name = typeof params.name === 'string' ? params.name.trim() : '';
    const localId = typeof params.number === 'string' ? params.number.trim() : '';
    const total = typeof params.total === 'string' ? parseInt(params.total, 10) : NaN;
    if (!name && !localId) return null;
    return {
      name: name || undefined,
      localId: localId || undefined,
      setTotal: Number.isNaN(total) ? undefined : total,
      rawLines,
    };
  }, [params.name, params.number, params.total, rawLines]);

  const match = useCardMatch(parsed);
  const [showAll, setShowAll] = useState(false);

  // Skip confirmation when there is exactly one trustworthy match.
  useEffect(() => {
    if (match.data?.confidentCardId) {
      router.replace({ pathname: '/result', params: { id: match.data.confidentCardId } });
    }
  }, [match.data?.confidentCardId, router]);

  if (!parsed) {
    return (
      <View style={styles.center}>
        {__DEV__ ? <OcrDebugPanel rawLines={rawLines} /> : null}
        <Text style={styles.infoText}>Nothing to search for. Go back and try again.</Text>
        <Pressable style={styles.retryButton} onPress={enterManually}>
          <Text style={styles.retryText}>Enter details manually</Text>
        </Pressable>
      </View>
    );
  }

  if (match.isLoading || match.data?.confidentCardId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.infoText}>Searching the card catalog…</Text>
      </View>
    );
  }

  if (match.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.infoText}>Search failed. Check your connection.</Text>
        <Pressable style={styles.retryButton} onPress={() => match.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const { strong, others } = splitStrongMatches(match.data?.candidates ?? []);
  const candidates = showAll ? [...strong, ...others] : strong;

  const renderCandidate = ({ item }: { item: ScoredCandidate }) => (
    <Pressable
      style={styles.candidateRow}
      onPress={() => router.replace({ pathname: '/result', params: { id: item.card.id } })}>
      {item.card.image ? (
        <Image source={{ uri: cardImageUrl(item.card.image, 'low') }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}
      <View style={styles.candidateInfo}>
        <Text style={styles.candidateName}>{item.card.name}</Text>
        <Text style={styles.candidateMeta}>
          #{item.card.localId} · {item.card.id}
        </Text>
        <Text style={styles.candidateScore}>
          Match {(item.score * 100).toFixed(0)}% ({item.reasons.join(', ')})
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.flex}>
      <FlatList
        // The iOS header floats over content; "automatic" insets the list below it.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
        data={candidates}
        keyExtractor={(item) => item.card.id}
        renderItem={renderCandidate}
        ListHeaderComponent={
          <>
            <Text style={styles.header}>
              Looked for: {match.data?.parsed.name ?? parsed.name ?? 'unknown name'}
              {parsed.localId
                ? ` · №${parsed.localId}${parsed.setTotal ? `/${parsed.setTotal}` : ''}`
                : ''}
            </Text>
            {__DEV__ ? (
              <OcrDebugPanel
                rawLines={parsed.rawLines}
                name={parsed.name}
                localId={parsed.localId}
                setTotal={parsed.setTotal}
              />
            ) : null}
          </>
        }
        ListFooterComponent={
          others.length > 0 ? (
            <Pressable
              style={styles.moreButton}
              onPress={() => setShowAll((v) => !v)}
              accessibilityRole="button">
              <Text style={styles.moreText}>
                {showAll
                  ? 'Show best matches only'
                  : `Show ${others.length} other printing${others.length === 1 ? '' : 's'}`}
              </Text>
            </Pressable>
          ) : undefined
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.infoText}>
              No matching cards found. Try scanning again or refining the search from the home
              screen.
            </Text>
            <Pressable
              style={styles.retryButton}
              onPress={enterManually}
              accessibilityRole="button">
              <Text style={styles.retryText}>Enter details manually</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  empty: { alignItems: 'center', gap: 16 },
  header: { fontSize: 15, color: '#8e8e93', marginBottom: 12 },
  infoText: { fontSize: 15, color: '#8e8e93', textAlign: 'center', marginTop: 16 },
  retryButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  candidateRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#c7c7cc',
  },
  thumb: { width: 60, height: 84, borderRadius: 4 },
  thumbPlaceholder: { backgroundColor: '#d1d1d6' },
  candidateInfo: { flex: 1, justifyContent: 'center' },
  candidateName: { fontSize: 17, fontWeight: '600', color: '#fefefe' },
  candidateMeta: { fontSize: 13, color: '#8e8e93', marginTop: 2 },
  candidateScore: { fontSize: 13, color: '#208AEF', marginTop: 4 },
  moreButton: { paddingVertical: 16, alignItems: 'center' },
  moreText: { fontSize: 15, color: '#208AEF', fontWeight: '600' },
});
