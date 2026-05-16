import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { theme } from '../theme';
import { Place } from '../types';
import PlaceCard from '../components/PlaceCard';
import GlassCard from '../components/GlassCard';
import { PlaceCardSkeleton } from '../components/SkeletonLoader';
import {
  getFeaturedPlaces,
  searchFsqPlaces,
  getPlacePhotos,
  getPlaceTips,
  FsqPlace,
  FsqPlaceWithPhoto,
} from '../utils/foursquare';

function fsqToPlace(raw: FsqPlace, photoUrl: string): Place {
  return {
    id: raw.fsq_id,
    name: raw.name,
    country: raw.location.country ?? raw.location.locality ?? '',
    coverImage: photoUrl,
    followersCount: raw.stats?.total_ratings ?? 1000,
    trendingPosts: [],
    travelTips: [],
    safetyNotes: [],
    followed: false,
    lat: raw.geocodes?.main?.latitude,
    lon: raw.geocodes?.main?.longitude,
  };
}

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  const [featured, setFeatured] = useState<Place[]>([]);
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [detailTips, setDetailTips] = useState<string[]>([]);
  const [detailPhotos, setDetailPhotos] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load featured destinations and request GPS on mount
  useEffect(() => {
    getFeaturedPlaces().then((results: FsqPlaceWithPhoto[]) => {
      setFeatured(results.map((r) => fsqToPlace(r, r.photoUrl)));
      setFeaturedLoading(false);
    });
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      const results = await searchFsqPlaces(query);
      setSearchResults(results.map((r) => fsqToPlace(r, '')));
      setSearchLoading(false);
    }, 500);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  const handleSelectPlace = async (place: Place) => {
    setSelectedPlace(place);
    setDetailTips([]);
    setDetailPhotos([]);
    setDetailLoading(true);
    const [photos, tips] = await Promise.all([
      getPlacePhotos(place.id),
      getPlaceTips(place.id),
    ]);
    setDetailPhotos(photos);
    setDetailTips(tips);
    setDetailLoading(false);
  };

  const displayPlaces = query.trim() ? searchResults : featured;

  if (selectedPlace) {
    const heroImage = detailPhotos[0] ?? selectedPlace.coverImage;
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.heroContainer}>
            {heroImage ? (
              <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.accent]}
                style={styles.heroImage}
              />
            )}
            <LinearGradient
              colors={['transparent', theme.colors.background]}
              style={styles.heroGradient}
            />
            <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedPlace(null)}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.heroContent}>
              <Text style={styles.heroName}>{selectedPlace.name}</Text>
              <Text style={styles.heroCountry}>{selectedPlace.country}</Text>
              <Text style={styles.heroFollowers}>
                👥 {selectedPlace.followersCount.toLocaleString()} check-ins
              </Text>
            </View>
          </View>

          <View style={styles.detailContent}>
            {detailLoading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
            ) : (
              <>
                {/* Extra photos strip */}
                {detailPhotos.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: theme.spacing.lg }}
                  >
                    {detailPhotos.slice(1).map((uri, i) => (
                      <Image
                        key={i}
                        source={{ uri }}
                        style={styles.extraPhoto}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                )}

                {/* Visitor Tips from Foursquare */}
                {detailTips.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>💬 Visitor Tips</Text>
                    {detailTips.map((tip, i) => (
                      <GlassCard key={i} style={styles.tipCard}>
                        <Text style={styles.tipText}>• {tip}</Text>
                      </GlassCard>
                    ))}
                  </>
                )}

                {detailTips.length === 0 && !detailLoading && (
                  <GlassCard style={styles.tipCard}>
                    <Text style={styles.tipText}>No tips yet — be the first to visit! 🌍</Text>
                  </GlassCard>
                )}
              </>
            )}
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
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Explore</Text>
            <Text style={styles.subtitle}>Discover & follow destinations</Text>
          </View>
          {/* Grid / Map toggle */}
          <View style={styles.viewToggle}>
            <TouchableOpacity
              onPress={() => setViewMode('grid')}
              style={[styles.toggleBtn, viewMode === 'grid' && styles.toggleBtnActive]}
            >
              <Text style={styles.toggleIcon}>⊞</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode('map')}
              style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
            >
              <Text style={styles.toggleIcon}>🗺️</Text>
            </TouchableOpacity>
          </View>
        </View>
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

      {/* Map View */}
      {viewMode === 'map' && (
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          showsUserLocation={userLocation !== null}
          showsMyLocationButton
          initialRegion={
            userLocation
              ? { latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: 30, longitudeDelta: 40 }
              : { latitude: 20, longitude: 10, latitudeDelta: 80, longitudeDelta: 100 }
          }
          customMapStyle={darkMapStyle}
        >
          {featured.filter((p) => p.lat && p.lon).map((place) => (
            <Marker
              key={place.id}
              coordinate={{ latitude: place.lat!, longitude: place.lon! }}
              onPress={() => handleSelectPlace(place)}
            >
              <View style={styles.mapPin}>
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.accent]}
                  style={styles.mapPinInner}
                >
                  <Text style={styles.mapPinEmoji}>📍</Text>
                </LinearGradient>
              </View>
              <Callout onPress={() => handleSelectPlace(place)} style={styles.callout}>
                <Text style={styles.calloutTitle}>{place.name}</Text>
                <Text style={styles.calloutSub}>{place.country}</Text>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <>
          {/* Horizontal featured cards */}
          {query.length === 0 && (
            <View style={styles.featuredSection}>
              <Text style={styles.sectionLabel}>🔥 Trending Destinations</Text>
              {featuredLoading ? (
                <FlatList
                  horizontal
                  data={[1, 2, 3]}
                  keyExtractor={(i) => String(i)}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  renderItem={() => <PlaceCardSkeleton />}
                />
              ) : (
                <FlatList
                  horizontal
                  data={featured}
                  keyExtractor={(item) => item.id + tick}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => handleSelectPlace(item)}>
                      <PlaceCard place={item} onUpdate={() => setTick((t) => t + 1)} />
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          {/* Search results / all places grid */}
          <Text style={styles.sectionLabel2}>
            {query ? `Results for "${query}"` : '🌍 All Destinations'}
          </Text>

          {searchLoading ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={displayPlaces}
              keyExtractor={(item) => item.id + tick}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.gridCard}
                  onPress={() => handleSelectPlace(item)}
                >
                  {item.coverImage ? (
                    <Image source={{ uri: item.coverImage }} style={styles.gridImage} resizeMode="cover" />
                  ) : (
                    <LinearGradient
                      colors={[theme.colors.primary, theme.colors.accent]}
                      style={styles.gridImage}
                    />
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.gridGradient}
                  />
                  <View style={styles.gridInfo}>
                    <Text style={styles.gridName}>{item.name}</Text>
                    <Text style={styles.gridCountry}>{item.country}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                featuredLoading && !query ? null : (
                  <View style={styles.empty}>
                    <Text style={styles.emptyEmoji}>🌍</Text>
                    <Text style={styles.emptyText}>No destinations found.</Text>
                  </View>
                )
              }
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

// Dark style for MapView to match app theme
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
];

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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  toggleBtnActive: { backgroundColor: theme.colors.primary },
  toggleIcon: { fontSize: 14 },
  map: { flex: 1 },
  mapPin: { alignItems: 'center' },
  mapPinInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  mapPinEmoji: { fontSize: 16 },
  callout: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 8,
    minWidth: 100,
  },
  calloutTitle: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  calloutSub: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
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
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
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
  extraPhoto: {
    width: 180,
    height: 120,
    borderRadius: theme.borderRadius.md,
    marginRight: theme.spacing.sm,
  },
});
