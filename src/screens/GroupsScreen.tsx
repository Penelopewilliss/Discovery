import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { mockGroups } from '../data/mockData';
import GroupCard from '../components/GroupCard';

const FILTERS = ['All', 'Public', 'Private', 'Joined'];

export default function GroupsScreen() {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);

  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  const filtered = mockGroups.filter((g) => {
    const matchesQuery =
      query.trim() === '' ||
      g.name.toLowerCase().includes(query.toLowerCase()) ||
      g.description.toLowerCase().includes(query.toLowerCase());

    if (!matchesQuery) return false;
    if (filter === 'Public') return !g.isPrivate;
    if (filter === 'Private') return g.isPrivate;
    if (filter === 'Joined') return g.joined;
    return true;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <Text style={styles.subtitle}>Travel communities & private circles</Text>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search groups..."
          placeholderTextColor={theme.colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={styles.filterBtnWrapper}>
            {filter === f ? (
              <LinearGradient
                colors={theme.colors.gradientPrimary as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.filterBtn}
              >
                <Text style={styles.filterTextActive}>{f}</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.filterBtn, styles.filterBtnInactive]}>
                <Text style={styles.filterText}>{f}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Groups list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id + tick}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <GroupCard group={item} onUpdate={forceUpdate} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyText}>No groups found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  title: {
    color: theme.colors.text,
    ...theme.typography.hero,
  },
  subtitle: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.full,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    ...theme.typography.body,
  },
  clearIcon: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  filterBtnWrapper: {
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
  },
  filterBtnInactive: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterText: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
  },
  filterTextActive: {
    color: '#fff',
    ...theme.typography.caption,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: theme.spacing.sm,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyText: {
    color: theme.colors.textMuted,
    ...theme.typography.body,
  },
});
