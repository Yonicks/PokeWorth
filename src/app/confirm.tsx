import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCardMatch } from '@/hooks/use-cards';
import { cardImageUrl } from '@/services/tcgdex.service';
import type { ParsedCardText, ScoredCandidate } from '@/types/card';

export default function ConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    number?: string;
    total?: string;
    lines?: string;
  }>();

  const parsed: ParsedCardText | null = useMemo(() => {
    const name = typeof params.name === 'string' ? params.name.trim() : '';
    const localId = typeof params.number === 'string' ? params.number.trim() : '';
    const total = typeof params.total === 'string' ? parseInt(params.total, 10) : NaN;
    let rawLines: string[] = [];
    try {
      if (typeof params.lines === 'string' && params.lines) {
        rawLines = JSON.parse(params.lines);
      }
    } catch {
      // Raw lines are debug-only; ignore malformed input.
    }
    if (!name && !localId) return null;
    return {
      name: name || undefined,
      localId: localId || undefined,
      setTotal: Number.isNaN(total) ? undefined : total,
      rawLines,
    };
  }, [params.name, params.number, params.total, params.lines]);

  const match = useCardMatch(parsed);

  // Skip confirmation when there is exactly one trustworthy match.
  useEffect(() => {
    if (match.data?.confidentCardId) {
      router.replace({ pathname: '/result', params: { id: match.data.confidentCardId } });
    }
  }, [match.data?.confidentCardId, router]);

  if (!parsed) {
    return (
      <View style={styles.center}>
        <Text style={styles.infoText}>Nothing to search for. Go back and try again.</Text>
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

  const candidates = match.data?.candidates ?? [];

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
    <View style={styles.container}>
      <Text style={styles.header}>
        Looked for: {parsed.name ?? 'unknown name'}
        {parsed.localId ? ` · №${parsed.localId}${parsed.setTotal ? `/${parsed.setTotal}` : ''}` : ''}
      </Text>
      <FlatList
        data={candidates}
        keyExtractor={(item) => item.card.id}
        renderItem={renderCandidate}
        ListEmptyComponent={
          <Text style={styles.infoText}>
            No matching cards found. Try scanning again or refining the search from the home
            screen.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
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
  candidateName: { fontSize: 17, fontWeight: '600' },
  candidateMeta: { fontSize: 13, color: '#8e8e93', marginTop: 2 },
  candidateScore: { fontSize: 13, color: '#208AEF', marginTop: 4 },
});
