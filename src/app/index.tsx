import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useRecentScans } from '@/hooks/use-cards';
import { cardImageUrl } from '@/services/tcgdex.service';
import type { RecentScan } from '@/types/card';

export default function HomeScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const recentScans = useRecentScans();

  useFocusEffect(
    useCallback(() => {
      recentScans.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const submitSearch = () => {
    const name = search.trim();
    if (name.length < 3) return;
    router.push({ pathname: '/confirm', params: { name } });
  };

  const renderScan = ({ item }: { item: RecentScan }) => (
    <Pressable
      style={styles.scanRow}
      onPress={() => router.push({ pathname: '/result', params: { id: item.cardId } })}>
      {item.image ? (
        <Image source={{ uri: cardImageUrl(item.image, 'low') }} style={styles.scanThumb} />
      ) : (
        <View style={[styles.scanThumb, styles.scanThumbPlaceholder]} />
      )}
      <View style={styles.scanInfo}>
        <Text style={styles.scanName}>{item.name}</Text>
        <Text style={styles.scanMeta}>
          {[item.setName, item.localId].filter(Boolean).join(' · ') || 'Unknown set'}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Pressable style={styles.scanButton} onPress={() => router.push('/scan')}>
        <Text style={styles.scanButtonText}>📷  Scan Card</Text>
      </Pressable>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Or search a card by name…"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={submitSearch}
          returnKeyType="search"
          autoCapitalize="words"
        />
        <Pressable style={styles.searchButton} onPress={submitSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Recent scans</Text>
      <FlatList
        data={recentScans.data ?? []}
        keyExtractor={(item) => item.cardId}
        renderItem={renderScan}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No scans yet. Scan a card or search by name to get started.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  scanButton: {
    backgroundColor: '#208AEF',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  scanButtonText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#c7c7cc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  searchButton: {
    backgroundColor: '#34C759',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchButtonText: { color: '#fff', fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  scanRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  scanThumb: { width: 44, height: 62, borderRadius: 4 },
  scanThumbPlaceholder: { backgroundColor: '#d1d1d6' },
  scanInfo: { flex: 1 },
  scanName: { fontSize: 16, fontWeight: '600' },
  scanMeta: { fontSize: 13, color: '#8e8e93', marginTop: 2 },
  emptyText: { color: '#8e8e93', textAlign: 'center', marginTop: 24 },
});
