import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { mockPlaces } from '../data/mockData';
import { Place } from '../types';
import PlaceCard from '../components/PlaceCard';
import GlassCard from '../components/GlassCard';

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  const filtered = query.trim()
    ? mockPlaces.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.country.toLowerCase().includes(query.toLowerCase())
      )
    : mockPlaces;

  if (selectedPlace) {
    const place = mockPlaces.find((p) => p.id === selectedPlace.id) ?? selectedPlace;
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.heroContainer}>
            <Image source={{ uri: place.coverImage }} style={styles.heroImage} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', theme.colors.background]}
              style={styles.heroGradient}
            />
            <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedPlace(null)}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.heroContent}>
              <Text style={styles.heroName}>{place.name}</Text>
              <Text style={styles.heroCountry}>{place.country}</Text>
              <Text style={styles.heroFollowers}>
                👥 {place.followersCount.toLocaleString()} followers
              </Text>
            </View>
          </View>

          <View style={styles.detailContent}>
            {/* Travel Tips */}
            <Text style={styles.sectionTitle}>✈️ Travel Tips</Text>
            {place.travelTips.map((tip, i) => (
              <GlassCard key={i} style={styles.tipCard}>
                <Text style={styles.tipText}>• {tip}</Text>
              </GlassCard>
            ))}

            {/* Safety Notes */}
            <Text style={[styles.sectionTitle, { marginTop: theme.spacing.lg }]}>🛡️ Safety Notes</Text>
            {place.safetyNotes.map((note, i) => (
              <GlassCard key={i} style={[styles.tipCard, styles.safetyCard]}>
                <Text style={styles.tipText}>• {note}</Text>
              </GlassCard>
            ))}

            <View style={{ height: theme.spacing.xxl }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
        <Text style={styles.subtitle}>Discover & follow destinations</Text>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search destinations..."
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

      {/* Horizontal place cards */}
      {query.length === 0 && (
        <View style={styles.featuredSection}>
          <Text style={styles.sectionLabel}>🔥 Trending Destinations</Text>
          <FlatList
            horizontal
            data={mockPlaces}
            keyExtractor={(item) => item.id + tick}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => setSelectedPlace(item)}>
                <PlaceCard place={item} onUpdate={forceUpdate} />
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Search results / all places grid */}
      <Text style={styles.sectionLabel2}>
        {query ? `Results for "${query}"` : '🌍 All Destinations'}
      </Text>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id + tick}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => setSelectedPlace(item)}
          >
            <Image source={{ uri: item.coverImage }} style={styles.gridImage} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.gridGradient}
            />
            <View style={styles.gridInfo}>
              <Text style={styles.gridName}>{item.name}</Text>
              <Text style={styles.gridCountry}>{item.country}</Text>
            </View>
            {item.followed && (
              <View style={styles.followingBadge}>
                <Text style={styles.followingText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No destinations found.</Text>
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
  featuredSection: {
    marginBottom: theme.spacing.sm,
  },
  sectionLabel: {
    color: theme.colors.text,
    ...theme.typography.h3,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  sectionLabel2: {
    color: theme.colors.text,
    ...theme.typography.h3,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  horizontalList: {
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.xs,
  },
  grid: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  gridRow: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  gridCard: {
    flex: 1,
    height: 140,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gridGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  gridInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.sm,
  },
  gridName: {
    color: theme.colors.text,
    ...theme.typography.h3,
  },
  gridCountry: {
    color: theme.colors.textSecondary,
    ...theme.typography.tiny,
  },
  followingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: theme.colors.textMuted,
    ...theme.typography.body,
  },
  // Detail view
  heroContainer: {
    height: 320,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  backBtn: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  backText: {
    color: '#fff',
    ...theme.typography.caption,
    fontWeight: '600',
  },
  heroContent: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    left: theme.spacing.md,
  },
  heroName: {
    color: theme.colors.text,
    ...theme.typography.hero,
  },
  heroCountry: {
    color: theme.colors.textSecondary,
    ...theme.typography.body,
  },
  heroFollowers: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    marginTop: 4,
  },
  detailContent: {
    padding: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.text,
    ...theme.typography.h2,
    marginBottom: theme.spacing.sm,
  },
  tipCard: {
    marginBottom: theme.spacing.sm,
  },
  safetyCard: {
    borderColor: 'rgba(252,92,125,0.3)',
  },
  tipText: {
    color: theme.colors.textSecondary,
    ...theme.typography.body,
    lineHeight: 20,
  },
});
