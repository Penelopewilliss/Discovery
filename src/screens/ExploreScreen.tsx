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
  Platform,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';

const SCREEN = Dimensions.get('window');
import * as Location from 'expo-location';
import { theme } from '../theme';
import { Place } from '../types';
import { useUser, VisitedPlace, TripStop, Trip } from '../context/UserContext';
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
  const { isVisited, markVisited, removeVisited, createTrip } = useUser();
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');

  // Trip planner state
  const [showTripPlanner, setShowTripPlanner] = useState(false);
  const [tripName, setTripName] = useState('');
  const [tripStops, setTripStops] = useState<TripStop[]>([]);
  const [tripSearch, setTripSearch] = useState('');
  const [tripResults, setTripResults] = useState<FsqPlace[]>([]);
  const [tripSearchLoading, setTripSearchLoading] = useState(false);
  const tripSearchTimer = useRef<ReturnType<typeof setTimeout>>();
  const tripAbortRef = useRef<AbortController>();

  const [featured, setFeatured] = useState<Place[]>([]);
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [detailTips, setDetailTips] = useState<string[]>([]);
  const [detailPhotos, setDetailPhotos] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const searchAbortRef = useRef<AbortController>();

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
      // Cancel any in-flight request
      searchAbortRef.current?.abort();
      searchAbortRef.current = new AbortController();
      const { signal } = searchAbortRef.current;
      setSearchLoading(true);
      try {
        const results = await searchFsqPlaces(query, signal);
        if (!signal.aborted) {
          setSearchResults(results.map((r) => fsqToPlace(r, '')));
          setSearchLoading(false);
        }
      } catch {
        if (!searchAbortRef.current?.signal.aborted) setSearchLoading(false);
      }
    }, 500);
    return () => {
      clearTimeout(searchTimer.current);
      searchAbortRef.current?.abort();
    };
  }, [query]);

  // Trip destination search
  useEffect(() => {
    if (!tripSearch.trim()) { setTripResults([]); return; }
    clearTimeout(tripSearchTimer.current);
    tripSearchTimer.current = setTimeout(async () => {
      // Cancel any in-flight request
      tripAbortRef.current?.abort();
      tripAbortRef.current = new AbortController();
      const { signal } = tripAbortRef.current;
      setTripSearchLoading(true);
      try {
        const results = await searchFsqPlaces(tripSearch, signal);
        if (!signal.aborted) {
          setTripResults(results.filter((r) => r.geocodes?.main));
          setTripSearchLoading(false);
        }
      } catch {
        if (!tripAbortRef.current?.signal.aborted) setTripSearchLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(tripSearchTimer.current);
      tripAbortRef.current?.abort();
    };
  }, [tripSearch]);

  const addStop = (place: FsqPlace) => {
    const geo = place.geocodes?.main;
    if (!geo) return;
    setTripStops((prev) => [
      ...prev,
      { name: place.name, country: place.location.country ?? place.location.locality ?? '', lat: geo.latitude, lon: geo.longitude },
    ]);
    setTripSearch('');
    setTripResults([]);
  };

  const removeStop = (i: number) => setTripStops((prev) => prev.filter((_, idx) => idx !== i));

  const saveTripPlan = () => {
    if (!tripName.trim()) { Alert.alert('Name your trip first!'); return; }
    if (tripStops.length === 0) { Alert.alert('Add at least one destination!'); return; }
    createTrip({ id: Date.now().toString(), name: tripName.trim(), stops: tripStops, createdAt: new Date().toISOString() });
    setShowTripPlanner(false);
    setTripName('');
    setTripStops([]);
    setTripSearch('');
    Alert.alert('✈️ Trip saved!', 'View it on your Profile under "My Trips".');
  };

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
              <TouchableOpacity
                style={[
                  styles.visitedBtn,
                  isVisited(selectedPlace.id) && styles.visitedBtnActive,
                ]}
                onPress={() => {
                  if (isVisited(selectedPlace.id)) {
                    removeVisited(selectedPlace.id);
                  } else {
                    const vp: VisitedPlace = {
                      id: selectedPlace.id,
                      name: selectedPlace.name,
                      country: selectedPlace.country,
                      lat: selectedPlace.lat ?? 0,
                      lon: selectedPlace.lon ?? 0,
                      coverImage: selectedPlace.coverImage,
                      visitedAt: new Date().toISOString(),
                    };
                    markVisited(vp);
                  }
                }}
              >
                <Text style={styles.visitedBtnText}>
                  {isVisited(selectedPlace.id) ? '✅ Visited! Tap to remove' : '📍 I\'ve been here!'}
                </Text>
              </TouchableOpacity>
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

                {/* About this place */}
                {detailTips.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>💬 About this place</Text>
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
        <View style={{ flex: 1 }}>
          <MapView
            style={StyleSheet.absoluteFillObject}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            showsUserLocation={userLocation !== null}
            showsMyLocationButton
            initialRegion={
              userLocation
                ? { latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: 30, longitudeDelta: 40 }
                : { latitude: 20, longitude: 10, latitudeDelta: 80, longitudeDelta: 100 }
            }
          >
            {/* Featured destination pins */}
            {featured.filter((p) => p.lat && p.lon).map((place) => {
              const visited = isVisited(place.id);
              return (
                <Marker
                  key={place.id}
                  coordinate={{ latitude: place.lat!, longitude: place.lon! }}
                  onPress={() => handleSelectPlace(place)}
                >
                  <View style={styles.mapPin}>
                    <LinearGradient
                      colors={visited ? ['#22c55e', '#16a34a'] : [theme.colors.primary, theme.colors.accent]}
                      style={styles.mapPinInner}
                    >
                      <Text style={styles.mapPinEmoji}>{visited ? '✅' : '📍'}</Text>
                    </LinearGradient>
                  </View>
                  <Callout onPress={() => handleSelectPlace(place)} style={styles.callout}>
                    <Text style={styles.calloutTitle}>{place.name}</Text>
                    <Text style={styles.calloutSub}>{place.country}{visited ? ' · Visited ✅' : ''}</Text>
                  </Callout>
                </Marker>
              );
            })}

            {/* Search result pins — any place in the world */}
            {query.trim() ? searchResults.filter((p) => p.lat && p.lon).map((place) => (
              <Marker
                key={`sr-${place.id}`}
                coordinate={{ latitude: place.lat!, longitude: place.lon! }}
                pinColor="#3b82f6"
                onPress={() => handleSelectPlace(place)}
              >
                <Callout style={styles.callout}>
                  <Text style={styles.calloutTitle}>{place.name}</Text>
                  <Text style={styles.calloutSub}>{place.country}</Text>
                </Callout>
              </Marker>
            )) : null}
          </MapView>

          {/* Plan Trip floating button */}
          <TouchableOpacity style={styles.tripFab} onPress={() => setShowTripPlanner(true)}>
            <Text style={styles.tripFabText}>✈️ Plan Trip</Text>
          </TouchableOpacity>
        </View>
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

      {/* ═══ Trip Planner Modal ═══ */}
      <Modal visible={showTripPlanner} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.tripModal}>
          {/* Header */}
          <View style={styles.tripModalHeader}>
            <TouchableOpacity onPress={() => setShowTripPlanner(false)}>
              <Text style={styles.tripModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.tripModalTitle}>✈️ Plan a Trip</Text>
            <TouchableOpacity
              onPress={saveTripPlan}
              disabled={!tripName.trim() || tripStops.length === 0}
              style={{ opacity: !tripName.trim() || tripStops.length === 0 ? 0.35 : 1 }}
            >
              <Text style={styles.tripModalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Trip name */}
          <TextInput
            style={styles.tripNameInput}
            placeholder="Trip name (e.g. European Summer 🌞)"
            placeholderTextColor={theme.colors.textMuted}
            value={tripName}
            onChangeText={setTripName}
            returnKeyType="done"
          />

          {/* Live map preview — shown once stops are added */}
          {tripStops.length > 0 && (
            <View style={{ height: 200 }}>
              <MapView
                style={{ flex: 1, width: SCREEN.width }}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                region={{
                  latitude: tripStops[tripStops.length - 1].lat,
                  longitude: tripStops[tripStops.length - 1].lon,
                  latitudeDelta: 50,
                  longitudeDelta: 60,
                }}
              >
                {tripStops.map((stop, i) => (
                  <Marker
                    key={i}
                    coordinate={{ latitude: stop.lat, longitude: stop.lon }}
                    title={`${i + 1}. ${stop.name}`}
                    pinColor="#6366f1"
                  />
                ))}
                {tripStops.length > 1 && (
                  <Polyline
                    coordinates={tripStops.map((s) => ({ latitude: s.lat, longitude: s.lon }))}
                    strokeColor={theme.colors.primary}
                    strokeWidth={2.5}
                    lineDashPattern={[6, 3]}
                  />
                )}
              </MapView>
            </View>
          )}

          {/* Search bar */}
          <View style={styles.tripSearchBar}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
            <TextInput
              style={styles.tripSearchInput}
              placeholder="Search any city, country or landmark..."
              placeholderTextColor={theme.colors.textMuted}
              value={tripSearch}
              onChangeText={setTripSearch}
            />
            {tripSearchLoading && <ActivityIndicator size="small" color={theme.colors.primary} />}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
            {/* Search results */}
            {tripResults.map((place) => (
              <TouchableOpacity key={place.fsq_id} style={styles.tripResultRow} onPress={() => addStop(place)}>
                <Text style={styles.tripResultAdd}>＋</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripResultName}>{place.name}</Text>
                  <Text style={styles.tripResultSub}>{place.location.country ?? place.location.locality ?? ''}</Text>
                </View>
                <Text style={{ fontSize: 14 }}>📍</Text>
              </TouchableOpacity>
            ))}

            {/* Stops list */}
            {tripResults.length === 0 && tripStops.length > 0 && (
              <View style={styles.tripStopsSection}>
                <Text style={styles.tripStopsLabel}>Your Journey — {tripStops.length} stop{tripStops.length > 1 ? 's' : ''}</Text>
                {tripStops.map((stop, i) => (
                  <View key={i} style={styles.tripStopItem}>
                    <View style={styles.tripStopBadge}>
                      <Text style={styles.tripStopBadgeText}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tripStopName}>{stop.name}</Text>
                      <Text style={styles.tripStopCountry}>{stop.country}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeStop(i)} style={{ padding: 8 }}>
                      <Text style={{ color: '#fc5c7d', fontSize: 18, fontWeight: '800' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Empty hint */}
            {tripResults.length === 0 && tripStops.length === 0 && (
              <View style={styles.tripEmptyHint}>
                <Text style={{ fontSize: 52, textAlign: 'center' }}>🗺️</Text>
                <Text style={styles.tripEmptyText}>
                  Search any city, country or landmark above to build your dream route
                </Text>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
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
  map: { width: SCREEN.width, flex: 1 },
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
  visitedBtn: {
    marginTop: theme.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  visitedBtnActive: {
    backgroundColor: 'rgba(34,197,94,0.25)',
    borderColor: '#22c55e',
  },
  visitedBtnText: {
    color: theme.colors.text,
    ...theme.typography.caption,
    fontWeight: '700',
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
  // Trip FAB
  tripFab: {
    position: 'absolute',
    bottom: 28,
    right: 16,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: theme.borderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  tripFabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Trip Planner Modal
  tripModal: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: 56,
  },
  tripModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tripModalCancel: { color: theme.colors.textMuted, fontSize: 15 },
  tripModalTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '700' },
  tripModalSave: { color: theme.colors.primary, fontSize: 15, fontWeight: '700' },
  tripNameInput: {
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    backgroundColor: theme.colors.glass,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    color: theme.colors.text,
    padding: theme.spacing.sm,
    fontSize: 15,
    height: 44,
  },
  tripSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.glass,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    paddingHorizontal: theme.spacing.sm,
    height: 44,
  },
  tripSearchInput: { flex: 1, color: theme.colors.text, fontSize: 15 },
  tripResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  tripResultAdd: { color: theme.colors.primary, fontSize: 22, fontWeight: '700', width: 24, textAlign: 'center' },
  tripResultName: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  tripResultSub: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  tripStopsSection: { padding: theme.spacing.md },
  tripStopsLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginBottom: theme.spacing.md },
  tripStopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  tripStopBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripStopBadgeText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  tripStopName: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  tripStopCountry: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  tripEmptyHint: { padding: theme.spacing.xl, alignItems: 'center', paddingTop: theme.spacing.xxl },
  tripEmptyText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    lineHeight: 22,
  },
});
