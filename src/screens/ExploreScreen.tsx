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
  Dimensions,
  Modal,
  Alert,
  Switch,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import LeafletMapView, { LeafletMapRef } from '../components/LeafletMapView';

const SCREEN = Dimensions.get('window');
import * as Location from 'expo-location';
import { theme } from '../theme';
import { Place } from '../types';
import { useUser, VisitedPlace, TripStop, Trip, MapPin, LiveTrip, LiveTripPin } from '../context/UserContext';
import LiveTripSummarySheet from '../components/LiveTripSummarySheet';
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

export default function ExploreScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { isVisited, markVisited, removeVisited, createTrip, mapPins, addMapPin, updateMapPin, deleteMapPin,
    activeLiveTrip, startLiveTrip, addLiveTripPin, pauseLiveTrip, resumeLiveTrip, endLiveTrip } = useUser();
  const mapRef = useRef<LeafletMapRef>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');
  // Remember which view the user was in before typing so we can restore it
  const preSearchViewMode = useRef<'grid' | 'map'>('map');
  const [kbHeight, setKbHeight] = useState(0);

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
  const [mapContainerHeight, setMapContainerHeight] = useState(0);
  // Custom map pin modals
  const [addPinModal, setAddPinModal] = useState<{ lat: number; lon: number } | null>(null);
  const [editPinModal, setEditPinModal] = useState<MapPin | null>(null);
  const [pinLabel, setPinLabel] = useState('');
  const [pinNote, setPinNote] = useState('');

  // Live trip state
  const [showStartLiveTrip, setShowStartLiveTrip] = useState(false);
  const [liveTripName, setLiveTripName] = useState('');
  const [liveTripPrivacy, setLiveTripPrivacy] = useState<LiveTrip['privacy']>('followers');
  // Drop-stop modal (photo is picked BEFORE modal opens to avoid Modal + native picker conflict)
  const [showDropPhotoPin, setShowDropPhotoPin] = useState(false);
  const [photoPinName, setPhotoPinName] = useState('');
  const [photoPinNote, setPhotoPinNote] = useState('');
  const [photoPinUri, setPhotoPinUri] = useState<string | null>(null);
  // 'now' = add to visited immediately, 'end' = add at end of trip, 'no' = don't add
  const [addToVisitedMode, setAddToVisitedMode] = useState<'now' | 'end' | 'no'>('now');
  // Summary / end-trip sheet
  const [summaryMode, setSummaryMode] = useState<'view' | 'end' | null>(null);

  /** Pick a photo (camera or gallery) then open the drop-stop modal */
  const openDropStop = async (sourceType: 'camera' | 'gallery' | 'none') => {
    if (!userLocation) { Alert.alert('Waiting for GPS…'); return; }
    setPhotoPinName('');
    setPhotoPinNote('');
    setPhotoPinUri(null);

    if (sourceType === 'none') {
      setShowDropPhotoPin(true);
      return;
    }
    const perm = sourceType === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access to continue.', [
        { text: 'OK', onPress: () => setShowDropPhotoPin(true) },
      ]);
      return;
    }
    const result = sourceType === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7, allowsEditing: true, aspect: [4, 3] });

    if (!result.canceled && result.assets[0]) {
      setPhotoPinUri(result.assets[0].uri);
    }
    // Open the modal AFTER picker has fully closed
    setShowDropPhotoPin(true);
  };
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const searchAbortRef = useRef<AbortController>();

  // Track keyboard height so the results list can pad itself out of the way
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Load featured destinations and start live GPS tracking on mount
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
        // Live tracking — update blue dot without remounting the map
        locationSub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
          (l) => {
            const coord = { latitude: l.coords.latitude, longitude: l.coords.longitude };
            setUserLocation(coord);
            mapRef.current?.updateUserLocation(coord.latitude, coord.longitude);
          },
        );
      }
    })();
    return () => { locationSub.current?.remove(); };
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      if (userLocation) mapRef.current?.flyTo(userLocation.latitude, userLocation.longitude, 4);
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
          const places = results.map((r) => fsqToPlace(r, ''));
          setSearchResults(places);
          setSearchLoading(false);
          // Fly the map to the first result that has coordinates
          const first = places.find((p) => p.lat && p.lon);
          if (first?.lat && first?.lon) {
            mapRef.current?.flyTo(first.lat, first.lon, 5);
          }
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

  /** Tapping a search dropdown result: fly map to it, clear the query */
  const handleSearchResultSelect = (place: Place) => {
    Keyboard.dismiss();
    setQuery('');
    if (place.lat && place.lon) {
      setViewMode('map');
      // Brief delay so keyboard dismissal animates before the map flies
      setTimeout(() => mapRef.current?.flyTo(place.lat!, place.lon!, 8), 150);
    } else {
      handleSelectPlace(place);
    }
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
      <SafeAreaView style={styles.container} edges={embedded ? [] : ['top']}>
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
    <SafeAreaView style={styles.container} edges={embedded ? [] : ['top']}>
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
          returnKeyType="search"
          onSubmitEditing={Keyboard.dismiss}
        />
        {searchLoading && query.length > 0 ? (
          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 4 }} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Content area — map/grid with floating search dropdown */}
      <View style={{ flex: 1, position: 'relative' }}>

      {/* Map View */}
      {viewMode === 'map' && (
        <View
          style={{ flex: 1, width: SCREEN.width }}
          onLayout={(e) => setMapContainerHeight(e.nativeEvent.layout.height)}
        >
          {mapContainerHeight > 0 && (
          <LeafletMapView
            ref={mapRef}
            style={{ width: SCREEN.width, height: mapContainerHeight }}
            region={
              userLocation
                ? { latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: 30, longitudeDelta: 40 }
                : { latitude: 20, longitude: 10, latitudeDelta: 80, longitudeDelta: 100 }
            }
            userLocation={userLocation}
            markers={[
              ...(query.trim() ? [] : featured).filter((p) => p.lat && p.lon).map((place) => ({
                id: place.id,
                latitude: place.lat!,
                longitude: place.lon!,
                color: isVisited(place.id) ? '#22c55e' : '#6366f1',
                label: place.name,
                sublabel: place.country + (isVisited(place.id) ? ' · Visited ✅' : ''),
              })),
              ...(query.trim()
                ? searchResults.filter((p) => p.lat && p.lon).map((place) => ({
                    id: place.id,
                    latitude: place.lat!,
                    longitude: place.lon!,
                    color: '#3b82f6',
                    label: place.name,
                    sublabel: place.country,
                  }))
                : []),
              ...mapPins.map((pin) => ({
                id: pin.id,
                latitude: pin.lat,
                longitude: pin.lon,
                color: '#f59e0b',
                label: pin.label,
                sublabel: pin.note || undefined,
              })),
              // Live trip pins — shown in red/pink with a camera emoji hint
              ...(activeLiveTrip?.pins.map((pin) => ({
                id: pin.id,
                latitude: pin.latitude,
                longitude: pin.longitude,
                color: '#ef4444',
                label: `📍 ${pin.placeName}`,
                sublabel: pin.note || undefined,
              })) ?? []),
            ]}
            onMarkerPress={(id) => {
              if (id.startsWith('pin_')) {
                const pin = mapPins.find((p) => p.id === id);
                if (pin) { setEditPinModal(pin); setPinLabel(pin.label); setPinNote(pin.note); }
                return;
              }
              const place = [...featured, ...searchResults].find((p) => p.id === id);
              if (place) handleSelectPlace(place);
            }}
            onMapPress={(lat, lng) => {
              setAddPinModal({ lat, lon: lng });
              setPinLabel('');
              setPinNote('');
            }}
          />
          )}

          {/* FABs */}
          {activeLiveTrip ? (
            // ── Live trip active controls ──────────────────────────────
            <View style={styles.fabRow}>
              {/* Status badge — red when live, amber when paused */}
              <View style={[styles.liveBadge, activeLiveTrip.status === 'paused' && styles.liveBadgePaused]}>
                <View style={[styles.liveDot, activeLiveTrip.status === 'paused' && styles.liveDotPaused]} />
                <Text style={styles.liveBadgeText}>
                  {activeLiveTrip.status === 'paused' ? '⏸ PAUSED' : '🔴 LIVE'} · {activeLiveTrip.name}
                </Text>
              </View>
              <View style={styles.liveActions}>
                {/* Drop Stop — disabled while paused */}
                <TouchableOpacity
                  style={[styles.photoPinFab, activeLiveTrip.status === 'paused' && styles.fabDisabled]}
                  disabled={activeLiveTrip.status === 'paused'}
                  onPress={() =>
                    Alert.alert('Add a Stop', 'How do you want to capture this moment?', [
                      { text: '📷 Take Photo', onPress: () => openDropStop('camera') },
                      { text: '🖼️ From Gallery', onPress: () => openDropStop('gallery') },
                      { text: '📍 Just Pin (no photo)', onPress: () => openDropStop('none') },
                      { text: 'Cancel', style: 'cancel' },
                    ])
                  }
                >
                  <Text style={styles.tripFabText}>📸 Drop Stop</Text>
                </TouchableOpacity>
                {/* Pause / Resume toggle */}
                {activeLiveTrip.status === 'active' ? (
                  <TouchableOpacity style={styles.pauseFab} onPress={pauseLiveTrip}>
                    <Text style={styles.tripFabText}>⏸</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.resumeFab} onPress={resumeLiveTrip}>
                    <Text style={styles.tripFabText}>▶ Resume</Text>
                  </TouchableOpacity>
                )}
                {/* View stops */}
                <TouchableOpacity style={styles.viewStopsFab} onPress={() => setSummaryMode('view')}>
                  <Text style={styles.tripFabText}>👁 {activeLiveTrip.pins.length}</Text>
                </TouchableOpacity>
                {/* End */}
                <TouchableOpacity style={styles.endTripFab} onPress={() => setSummaryMode('end')}>
                  <Text style={styles.tripFabText}>■ End</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // ── Normal map controls ────────────────────────────────────
            <View style={styles.fabRow}>
              <View style={styles.liveActions}>
                <TouchableOpacity
                  style={styles.dropPinFab}
                  onPress={() => {
                    if (!userLocation) { Alert.alert('Location not available yet'); return; }
                    setAddPinModal({ lat: userLocation.latitude, lon: userLocation.longitude });
                    setPinLabel('');
                    setPinNote('');
                  }}
                >
                  <Text style={styles.tripFabText}>📍 Drop Here</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tripFab} onPress={() => setShowTripPlanner(true)}>
                  <Text style={styles.tripFabText}>✈️ Plan Trip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.liveStartFab} onPress={() => { setLiveTripName(''); setShowStartLiveTrip(true); }}>
                  <Text style={styles.tripFabText}>🔴 Go Live</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
              contentContainerStyle={[styles.grid, { paddingBottom: kbHeight + 16 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
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

      {/* Search dropdown — floats above map/grid, visible above the keyboard */}
      {query.trim().length > 0 && (
        <View style={styles.searchDropdown}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 300 }}
          >
            {searchLoading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ margin: 20 }} />
            ) : searchResults.length === 0 ? (
              <View style={styles.dropdownEmpty}>
                <Text style={styles.dropdownEmptyText}>No destinations found</Text>
              </View>
            ) : (
              searchResults.map((place) => (
                <TouchableOpacity
                  key={place.id}
                  style={styles.dropdownItem}
                  onPress={() => handleSearchResultSelect(place)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownItemName}>{place.name}</Text>
                    {!!place.country && <Text style={styles.dropdownItemCountry}>{place.country}</Text>}
                  </View>
                  <Text style={styles.dropdownItemArrow}>→</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}

      </View> {/* end content area */}

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
              <LeafletMapView
                style={{ flex: 1, width: SCREEN.width }}
                region={{
                  latitude: tripStops[tripStops.length - 1].lat,
                  longitude: tripStops[tripStops.length - 1].lon,
                  latitudeDelta: 50,
                  longitudeDelta: 60,
                }}
                markers={tripStops.map((stop, i) => ({
                  id: String(i),
                  latitude: stop.lat,
                  longitude: stop.lon,
                  color: '#6366f1',
                  label: `${i + 1}. ${stop.name}`,
                }))}
                polylineCoords={tripStops.map((s) => ({ latitude: s.lat, longitude: s.lon }))}
                polylineColor={theme.colors.primary}
              />
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

      {/* ═══ Add Pin Modal ═══ */}
      <Modal visible={addPinModal !== null} transparent animationType="fade">
        <View style={styles.pinOverlay}>
          <View style={styles.pinBox}>
            <Text style={styles.pinTitle}>📍 New Pin</Text>
            <TextInput
              style={styles.pinInput}
              placeholder="Label (e.g. Hidden beach)"
              placeholderTextColor={theme.colors.textMuted}
              value={pinLabel}
              onChangeText={setPinLabel}
              autoFocus
            />
            <TextInput
              style={[styles.pinInput, { marginTop: 8, minHeight: 60 }]}
              placeholder="Note (optional)"
              placeholderTextColor={theme.colors.textMuted}
              value={pinNote}
              onChangeText={setPinNote}
              multiline
            />
            <View style={styles.pinActions}>
              <TouchableOpacity style={styles.pinCancel} onPress={() => setAddPinModal(null)}>
                <Text style={styles.pinCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pinSave}
                onPress={() => {
                  if (!pinLabel.trim()) { Alert.alert('Add a label first'); return; }
                  addMapPin({
                    id: `pin_${Date.now()}`,
                    lat: addPinModal!.lat,
                    lon: addPinModal!.lon,
                    label: pinLabel.trim(),
                    note: pinNote.trim(),
                    createdAt: new Date().toISOString(),
                  });
                  setAddPinModal(null);
                }}
              >
                <Text style={styles.pinSaveText}>Save Pin</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ Edit Pin Modal ═══ */}
      <Modal visible={editPinModal !== null} transparent animationType="fade">
        <View style={styles.pinOverlay}>
          <View style={styles.pinBox}>
            <Text style={styles.pinTitle}>✏️ Edit Pin</Text>
            <TextInput
              style={styles.pinInput}
              placeholder="Label"
              placeholderTextColor={theme.colors.textMuted}
              value={pinLabel}
              onChangeText={setPinLabel}
            />
            <TextInput
              style={[styles.pinInput, { marginTop: 8, minHeight: 60 }]}
              placeholder="Note (optional)"
              placeholderTextColor={theme.colors.textMuted}
              value={pinNote}
              onChangeText={setPinNote}
              multiline
            />
            <View style={styles.pinActions}>
              <TouchableOpacity
                style={styles.pinDelete}
                onPress={() => { deleteMapPin(editPinModal!.id); setEditPinModal(null); }}
              >
                <Text style={styles.pinDeleteText}>🗑️ Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pinSave}
                onPress={() => {
                  if (!pinLabel.trim()) { Alert.alert('Add a label first'); return; }
                  updateMapPin(editPinModal!.id, pinLabel.trim(), pinNote.trim());
                  setEditPinModal(null);
                }}
              >
                <Text style={styles.pinSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ Start Live Trip Modal ═══ */}
      <Modal visible={showStartLiveTrip} transparent animationType="slide">
        <View style={styles.pinOverlay}>
          <View style={styles.pinBox}>
            <Text style={styles.pinTitle}>🔴 Start Live Trip</Text>
            <Text style={styles.liveModalSub}>
              Followers can watch your pins + photos appear on the map in real time.
            </Text>
            <TextInput
              style={styles.pinInput}
              placeholder="Trip name (e.g. Road Trip Germany 🚗)"
              placeholderTextColor={theme.colors.textMuted}
              value={liveTripName}
              onChangeText={setLiveTripName}
              autoFocus
            />
            {/* Privacy picker */}
            <Text style={styles.livePrivacyLabel}>Who can follow?</Text>
            <View style={styles.livePrivacyRow}>
              {(['public', 'followers', 'close-friends'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.livePrivacyBtn, liveTripPrivacy === p && styles.livePrivacyBtnActive]}
                  onPress={() => setLiveTripPrivacy(p)}
                >
                  <Text style={[styles.livePrivacyText, liveTripPrivacy === p && styles.livePrivacyTextActive]}>
                    {p === 'public' ? '🌍 Everyone' : p === 'followers' ? '👥 Followers' : '⭐ Close friends'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.pinActions}>
              <TouchableOpacity style={styles.pinCancel} onPress={() => setShowStartLiveTrip(false)}>
                <Text style={styles.pinCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pinSave, { backgroundColor: '#ef4444' }]}
                onPress={() => {
                  if (!liveTripName.trim()) { Alert.alert('Name your trip first'); return; }
                  startLiveTrip(liveTripName.trim(), liveTripPrivacy);
                  setShowStartLiveTrip(false);
                  Alert.alert('🔴 You\'re live!', 'Drop your first photo stop using the "📸 Drop Stop" button.');
                }}
              >
                <Text style={styles.pinSaveText}>Go Live 🔴</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ Drop Photo + Pin Modal ═══ */}
      <Modal visible={showDropPhotoPin} transparent animationType="slide">
        <View style={styles.pinOverlay}>
          <View style={styles.pinBox}>
            <Text style={styles.pinTitle}>� Drop a Stop</Text>
            {/* Photo preview (already picked before modal opened) */}
            {photoPinUri ? (
              <Image source={{ uri: photoPinUri }} style={styles.photoPickerPreview} resizeMode="cover" />
            ) : (
              <View style={[styles.photoPickerBtn, styles.photoPickerEmpty]}>
                <Text style={{ fontSize: 28 }}>📍</Text>
                <Text style={styles.photoPickerHint}>No photo — pin only</Text>
              </View>
            )}
            <TextInput
              style={[styles.pinInput, { marginTop: 10 }]}
              placeholder="Place name (e.g. Brandenburg Gate)"
              placeholderTextColor={theme.colors.textMuted}
              value={photoPinName}
              onChangeText={setPhotoPinName}
              autoFocus
            />
            <TextInput
              style={[styles.pinInput, { marginTop: 8, minHeight: 60 }]}
              placeholder="Caption / note (optional)"
              placeholderTextColor={theme.colors.textMuted}
              value={photoPinNote}
              onChangeText={setPhotoPinNote}
              multiline
            />
            {/* Add to visited options */}
            <Text style={[styles.pinInput, { borderWidth: 0, paddingHorizontal: 0, marginTop: 12, marginBottom: 4, fontSize: 13, color: theme.colors.textMuted }]}>
              Add to visited places?
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {(['now', 'end', 'no'] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setAddToVisitedMode(opt)}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                    backgroundColor: addToVisitedMode === opt ? theme.colors.accent : theme.colors.background,
                    borderWidth: 1,
                    borderColor: addToVisitedMode === opt ? theme.colors.accent : theme.colors.border,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: addToVisitedMode === opt ? '#fff' : theme.colors.textMuted }}>
                    {opt === 'now' ? '✅ Now' : opt === 'end' ? '⏳ At end' : '✖ Skip'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.pinActions}>
              <TouchableOpacity style={styles.pinCancel} onPress={() => setShowDropPhotoPin(false)}>
                <Text style={styles.pinCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pinSave, { backgroundColor: '#ef4444' }]}
                onPress={() => {
                  if (!photoPinName.trim()) { Alert.alert('Add a place name'); return; }
                  const pin = {
                    id: `lpin_${Date.now()}`,
                    latitude: userLocation!.latitude,
                    longitude: userLocation!.longitude,
                    photoUri: photoPinUri ?? undefined,
                    note: photoPinNote.trim(),
                    placeName: photoPinName.trim(),
                    timestamp: Date.now(),
                    addToVisited: addToVisitedMode,
                  };
                  addLiveTripPin(pin);
                  // Add to visited places based on user's choice
                  if (addToVisitedMode === 'now') {
                    markVisited({
                      id: `livepin_${pin.id}`,
                      name: pin.placeName,
                      country: '',
                      lat: pin.latitude,
                      lon: pin.longitude,
                      coverImage: pin.photoUri ?? '',
                      visitedAt: new Date().toISOString(),
                    });
                  }
                  // 'end' mode pins are handled in LiveTripSummarySheet.onEnd
                  setShowDropPhotoPin(false);
                  Alert.alert(
                    '📍 Stop dropped!',
                    `"${photoPinName.trim()}" has been added to your live trip.`,
                    [{ text: 'Keep going!', style: 'default' }],
                  );
                }}
              >
                <Text style={styles.pinSaveText}>📍 Drop Pin</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* ═══ Live Trip Summary / End Sheet ═══ */}
      {activeLiveTrip && summaryMode && (
        <LiveTripSummarySheet
          trip={activeLiveTrip}
          mode={summaryMode}
          onClose={() => setSummaryMode(null)}
          onEnd={() => {
            // Mark 'end'-mode pins as visited now that the trip is finishing
            if (activeLiveTrip) {
              activeLiveTrip.pins
                .filter((p) => p.addToVisited === 'end')
                .forEach((p) => markVisited({
                  id: `livepin_${p.id}`,
                  name: p.placeName,
                  country: '',
                  lat: p.latitude,
                  lon: p.longitude,
                  coverImage: p.photoUri ?? '',
                  visitedAt: new Date().toISOString(),
                }));
            }
            endLiveTrip();
            setSummaryMode(null);
          }}
        />
      )}
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
  searchResultsBadge: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderRadius: 8,
    marginHorizontal: theme.spacing.md,
    marginBottom: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    alignItems: 'center',
  },
  searchResultsBadgeText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  searchDropdown: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface ?? theme.colors.background,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    zIndex: 999,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border ?? 'rgba(255,255,255,0.08)',
  },
  dropdownItemName: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  dropdownItemCountry: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  dropdownItemArrow: {
    color: theme.colors.primary,
    fontSize: 18,
    marginLeft: 8,
  },
  dropdownEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  dropdownEmptyText: {
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
  fabRow: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  dropPinFab: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  liveStartFab: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  photoPinFab: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  viewStopsFab: {
    backgroundColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 28,
    elevation: 8,
  },
  endTripFab: {
    backgroundColor: '#374151',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    elevation: 8,
  },
  // Live trip badge
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(239,68,68,0.92)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 10,
    gap: 6,
  },
  liveBadgePaused: {
    backgroundColor: 'rgba(180,83,9,0.92)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  liveDotPaused: {
    backgroundColor: '#fbbf24',
  },
  liveBadgeText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  pauseFab: {
    backgroundColor: '#b45309',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 28,
    elevation: 8,
  },
  resumeFab: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 28,
    elevation: 8,
  },
  fabDisabled: {
    opacity: 0.35,
  },
  liveActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  // Live trip modals
  liveModalSub: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  livePrivacyLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 8,
  },
  livePrivacyRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  livePrivacyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  livePrivacyBtnActive: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  livePrivacyText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  livePrivacyTextActive: { color: '#fff' },
  // Photo pin modal
  photoPickerBtn: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  photoPickerPreview: { width: '100%', height: 140, borderRadius: 14, overflow: 'hidden' },
  photoPickerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    gap: 8,
  },
  photoPickerHint: { color: theme.colors.textMuted, fontSize: 13 },
  // Pin modals
  pinOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pinBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
  },
  pinTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  pinInput: {
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
    textAlignVertical: 'top',
  },
  pinActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  pinCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pinCancelText: { color: theme.colors.textMuted, fontWeight: '600' },
  pinSave: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  pinSaveText: { color: '#fff', fontWeight: '700' },
  pinDelete: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  pinDeleteText: { color: '#ef4444', fontWeight: '600' },
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
