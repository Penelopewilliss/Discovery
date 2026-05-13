import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { mockPosts } from '../data/mockData';
import PostCard from '../components/PostCard';
import { Post } from '../types';

const TAGS = ['All', 'beach', 'food', 'hidden gem', 'city', 'nature', 'budget', 'luxury'];

export default function HomeScreen() {
  const [activeTag, setActiveTag] = useState('All');
  const [tick, setTick] = useState(0);

  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  const filtered: Post[] =
    activeTag === 'All'
      ? mockPosts
      : mockPosts.filter((p) => p.tags.includes(activeTag as any));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Tag filter */}
      <FlatList
        horizontal
        data={TAGS}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tagsList}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setActiveTag(item)}>
            {item === activeTag ? (
              <LinearGradient
                colors={theme.colors.gradientPrimary as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.tagActive}
              >
                <Text style={styles.tagTextActive}>{item}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.tagInactive}>
                <Text style={styles.tagTextInactive}>{item}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      {/* Feed */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id + tick.toString()}
        renderItem={({ item }) => (
          <PostCard post={item} onUpdate={forceUpdate} />
        )}
        contentContainerStyle={styles.feed}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No posts for this category yet.</Text>
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
  tagsList: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  tagActive: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  tagInactive: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tagTextActive: {
    color: '#fff',
    ...theme.typography.caption,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  tagTextInactive: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    textTransform: 'capitalize',
  },
  feed: {
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: theme.colors.textMuted,
    ...theme.typography.body,
  },
});
