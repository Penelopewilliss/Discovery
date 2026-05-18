import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Alert,
  Share,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

import GlassCard from '../components/GlassCard';
import LeafletMapView from '../components/LeafletMapView';
import TripShareSheet from '../components/TripShareSheet';
import LiveTripSummarySheet from '../components/LiveTripSummarySheet';
import CreateTripModal from '../components/CreateTripModal';
import ExploreScreen from './ExploreScreen';
import { useUser, Trip, CompletedLiveTrip, VisitedPlace } from '../context/UserContext';
import { Stamp } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');

const ALL_COUNTRIES: { name: string; emoji: string }[] = [
  { name: 'Albania', emoji: '🇦🇱' }, { name: 'Argentina', emoji: '🇦🇷' },
  { name: 'Australia', emoji: '🇦🇺' }, { name: 'Austria', emoji: '🇦🇹' },
  { name: 'Bali (Indonesia)', emoji: '🇮🇩' }, { name: 'Belgium', emoji: '🇧🇪' },
  { name: 'Brazil', emoji: '🇧🇷' }, { name: 'Canada', emoji: '🇨🇦' },
  { name: 'China', emoji: '🇨🇳' }, { name: 'Colombia', emoji: '🇨🇴' },
  { name: 'Croatia', emoji: '🇭🇷' }, { name: 'Czech Republic', emoji: '🇨🇿' },
  { name: 'Denmark', emoji: '🇩🇰' }, { name: 'Egypt', emoji: '🇪🇬' },
  { name: 'France', emoji: '🇫🇷' }, { name: 'Germany', emoji: '🇩🇪' },
  { name: 'Greece', emoji: '🇬🇷' }, { name: 'Hungary', emoji: '🇭🇺' },
  { name: 'Iceland', emoji: '🇮🇸' }, { name: 'India', emoji: '🇮🇳' },
  { name: 'Indonesia', emoji: '🇮🇩' }, { name: 'Ireland', emoji: '🇮🇪' },
  { name: 'Israel', emoji: '🇮🇱' }, { name: 'Italy', emoji: '🇮🇹' },
  { name: 'Japan', emoji: '🇯🇵' }, { name: 'Jordan', emoji: '🇯🇴' },
  { name: 'Kenya', emoji: '🇰🇪' }, { name: 'Malaysia', emoji: '🇲🇾' },
  { name: 'Maldives', emoji: '🇲🇻' }, { name: 'Mexico', emoji: '🇲🇽' },
  { name: 'Montenegro', emoji: '🇲🇪' }, { name: 'Morocco', emoji: '🇲🇦' },
  { name: 'Netherlands', emoji: '🇳🇱' }, { name: 'New Zealand', emoji: '🇳🇿' },
  { name: 'Norway', emoji: '🇳🇴' }, { name: 'Peru', emoji: '🇵🇪' },
  { name: 'Philippines', emoji: '🇵🇭' }, { name: 'Poland', emoji: '🇵🇱' },
  { name: 'Portugal', emoji: '🇵🇹' }, { name: 'Romania', emoji: '🇷🇴' },
  { name: 'Singapore', emoji: '🇸🇬' }, { name: 'Slovenia', emoji: '🇸🇮' },
  { name: 'South Africa', emoji: '🇿🇦' }, { name: 'South Korea', emoji: '🇰🇷' },
  { name: 'Spain', emoji: '🇪🇸' }, { name: 'Sweden', emoji: '🇸🇪' },
  { name: 'Switzerland', emoji: '🇨🇭' }, { name: 'Thailand', emoji: '🇹🇭' },
  { name: 'Turkey', emoji: '🇹🇷' }, { name: 'Ukraine', emoji: '🇺🇦' },
  { name: 'United Kingdom', emoji: '🇬🇧' }, { name: 'United States', emoji: '🇺🇸' },
  { name: 'Vietnam', emoji: '🇻🇳' }, { name: 'Serbia', emoji: '🇷🇸' },
];

// Approximate country centroids for map pins
const COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
  'Albania': { lat: 41.15, lon: 20.17 },
  'Argentina': { lat: -38.42, lon: -63.62 },
  'Australia': { lat: -25.27, lon: 133.77 },
  'Austria': { lat: 47.52, lon: 14.55 },
  'Bali (Indonesia)': { lat: -8.34, lon: 115.09 },
  'Belgium': { lat: 50.50, lon: 4.47 },
  'Brazil': { lat: -14.24, lon: -51.93 },
  'Canada': { lat: 56.13, lon: -106.35 },
  'China': { lat: 35.86, lon: 104.20 },
  'Colombia': { lat: 4.57, lon: -74.30 },
  'Croatia': { lat: 45.10, lon: 15.20 },
  'Czech Republic': { lat: 49.82, lon: 15.47 },
  'Denmark': { lat: 56.26, lon: 9.50 },
  'Egypt': { lat: 26.82, lon: 30.80 },
  'France': { lat: 46.23, lon: 2.21 },
  'Germany': { lat: 51.17, lon: 10.45 },
  'Greece': { lat: 39.07, lon: 21.82 },
  'Hungary': { lat: 47.16, lon: 19.50 },
  'Iceland': { lat: 64.96, lon: -19.02 },
  'India': { lat: 20.59, lon: 78.96 },
  'Indonesia': { lat: -0.79, lon: 113.92 },
  'Ireland': { lat: 53.41, lon: -8.24 },
  'Israel': { lat: 31.05, lon: 34.85 },
  'Italy': { lat: 41.87, lon: 12.57 },
  'Japan': { lat: 36.20, lon: 138.25 },
  'Jordan': { lat: 30.59, lon: 36.24 },
  'Kenya': { lat: -0.02, lon: 37.91 },
  'Malaysia': { lat: 4.21, lon: 101.98 },
  'Maldives': { lat: 3.20, lon: 73.22 },
  'Mexico': { lat: 23.63, lon: -102.55 },
  'Montenegro': { lat: 42.71, lon: 19.37 },
  'Morocco': { lat: 31.79, lon: -7.09 },
  'Netherlands': { lat: 52.13, lon: 5.29 },
  'New Zealand': { lat: -40.90, lon: 174.89 },
  'Norway': { lat: 60.47, lon: 8.47 },
  'Peru': { lat: -9.19, lon: -75.02 },
  'Philippines': { lat: 12.88, lon: 121.77 },
  'Poland': { lat: 51.92, lon: 19.15 },
  'Portugal': { lat: 39.40, lon: -8.22 },
  'Romania': { lat: 45.94, lon: 24.97 },
  'Singapore': { lat: 1.35, lon: 103.82 },
  'Slovenia': { lat: 46.15, lon: 14.99 },
  'South Africa': { lat: -30.56, lon: 22.94 },
  'South Korea': { lat: 35.91, lon: 127.77 },
  'Spain': { lat: 40.46, lon: -3.75 },
  'Sweden': { lat: 60.13, lon: 18.64 },
  'Switzerland': { lat: 46.82, lon: 8.23 },
  'Thailand': { lat: 15.87, lon: 100.99 },
  'Turkey': { lat: 38.96, lon: 35.24 },
  'Ukraine': { lat: 48.38, lon: 31.17 },
  'United Kingdom': { lat: 55.38, lon: -3.44 },
  'United States': { lat: 37.09, lon: -95.71 },
  'Vietnam': { lat: 14.06, lon: 108.28 },
  'Serbia': { lat: 44.02, lon: 21.01 },
};

// ─── Inner tab type ────────────────────────────────────────────────────────────
type InnerTab = 'countries' | 'explore' | 'trips' | 'planned';

export default function PassportScreen() {
  const {
    visitedPlaces, trips, deleteTrip, completedLiveTrips, deleteCompletedTrip,
    stamps, addStamp, removeStamp, markVisited,
  } = useUser();

  // Tabs / navigation
  const [innerTab, setInnerTab] = useState<InnerTab>('countries');

  // Countries (stamps)
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());

  // Map modals
  const [showTravelMap, setShowTravelMap] = useState(false);

  // Other sheets
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [sharingTrip, setSharingTrip] = useState<Trip | null>(null);
  const [reviewingTrip, setReviewingTrip] = useState<CompletedLiveTrip | null>(null);

  const toggleCountry = (name: string) => {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const confirmAddCountries = () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    selectedCountries.forEach((name) => {
      const item = ALL_COUNTRIES.find((c) => c.name === name);
      if (!item) return;
      const stamp: Stamp = { country: item.name, emoji: item.emoji, visitedAt: month };
      addStamp(stamp);
      const coords = COUNTRY_COORDS[item.name];
      if (coords) {
        markVisited({
          id: `country_${item.name.replace(/\s+/g, '_')}`,
          name: item.name,
          country: item.name,
          lat: coords.lat,
          lon: coords.lon,
          coverImage: '',
          visitedAt: month,
        });
      }
    });
    setSelectedCountries(new Set());
    setShowCountryPicker(false);
  };

  const deleteCountry = (country: string) => {
    Alert.alert('Remove country', `Remove ${country} from your passport?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeStamp(country) },
    ]);
  };

  // ─── Inner tab pills ──────────────────────────────────────────────────────────
  const INNER_TABS: { key: InnerTab; label: string; emoji: string }[] = [
    { key: 'countries', label: 'Countries', emoji: '🌍' },
    { key: 'explore',   label: 'Explore',   emoji: '🧭' },
    { key: 'trips',     label: 'Trips',     emoji: '🔴' },
    { key: 'planned',   label: 'Planned',   emoji: '✈️' },
  ];

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      {/* Header */}
      <LinearGradient colors={['#0A0A0F', '#12121A']} style={s.header}>
        <Text style={s.headerTitle}>🛂 Travel Passport</Text>
        <Text style={s.headerSub}>
          {stamps.length} countr{stamps.length !== 1 ? 'ies' : 'y'} · {visitedPlaces.length} place{visitedPlaces.length !== 1 ? 's' : ''} · {completedLiveTrips.length + trips.length} trip{completedLiveTrips.length + trips.length !== 1 ? 's' : ''}
        </Text>
      </LinearGradient>

      {/* Inner tab bar */}
      <View style={s.innerTabBar}>
        {INNER_TABS.map((t) => {
          const active = innerTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.innerTab, active && s.innerTabActive]}
              onPress={() => setInnerTab(t.key)}
              activeOpacity={0.75}
            >
              <Text style={s.innerTabEmoji}>{t.emoji}</Text>
              <Text style={[s.innerTabLabel, active && s.innerTabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Countries ── */}
      {innerTab === 'countries' && (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statNum}>{stamps.length}</Text>
              <Text style={s.statLabel}>Countries</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statNum}>{completedLiveTrips.length + trips.length}</Text>
              <Text style={s.statLabel}>Trips</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statNum}>{visitedPlaces.length}</Text>
              <Text style={s.statLabel}>Map Pins</Text>
            </View>
          </View>

          <TouchableOpacity style={s.addBtn} onPress={() => { setCountrySearch(''); setShowCountryPicker(true); }}>
            <LinearGradient colors={theme.colors.gradientPrimary as [string,string]} style={s.addBtnGrad}>
              <Text style={s.addBtnText}>+ Add Country</Text>
            </LinearGradient>
          </TouchableOpacity>

          {stamps.length === 0 ? (
            <GlassCard style={s.emptyCard}>
              <Text style={s.emptyEmoji}>🌍</Text>
              <Text style={s.emptyTitle}>No countries yet</Text>
              <Text style={s.emptySub}>Tap "Add Country" to start building your passport.</Text>
            </GlassCard>
          ) : (
            <View style={s.stampsGrid}>
              {stamps.map((stamp) => (
                <GlassCard key={stamp.country} style={s.stampCard}>
                  <TouchableOpacity
                    style={s.stampDeleteBtn}
                    onPress={() => deleteCountry(stamp.country)}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <Text style={s.stampDeleteIcon}>✕</Text>
                  </TouchableOpacity>
                  <Text style={s.stampEmoji}>{stamp.emoji}</Text>
                  <Text style={s.stampCountry} numberOfLines={2}>{stamp.country}</Text>
                  <Text style={s.stampDate}>{stamp.visitedAt}</Text>
                </GlassCard>
              ))}
            </View>
          )}

          {/* Map Pins list — all visited places (countries shown with flag, others with pin) */}
          {(() => {
            const placePins = visitedPlaces.filter((p) => !p.id.startsWith('country_'));
            const countryPins = visitedPlaces.filter((p) => p.id.startsWith('country_'));
            const allPins = [...placePins, ...countryPins];
            if (allPins.length === 0) return null;
            return (
              <View style={{ marginTop: 24 }}>
                <Text style={s.sectionNote}>📍 All map pins ({visitedPlaces.length} total · {placePins.length} places · {countryPins.length} countries)</Text>
                {placePins.map((p) => (
                  <GlassCard key={p.id} style={{ marginBottom: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontSize: 22 }}>📍</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{p.name || 'Unnamed pin'}</Text>
                      {!!p.country && <Text style={{ color: '#a0a0b0', fontSize: 12, marginTop: 2 }}>{p.country}</Text>}
                    </View>
                    <Text style={{ color: '#a0a0b0', fontSize: 12 }}>{p.visitedAt?.slice(0, 7)}</Text>
                  </GlassCard>
                ))}
                {countryPins.map((p) => {
                  const stamp = stamps.find((s) => s.country === p.name);
                  return (
                    <GlassCard key={p.id} style={{ marginBottom: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Text style={{ fontSize: 22 }}>{stamp?.emoji ?? '🌍'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{p.name}</Text>
                        <Text style={{ color: '#8b5cf6', fontSize: 12, marginTop: 2 }}>Country pin</Text>
                      </View>
                      <Text style={{ color: '#a0a0b0', fontSize: 12 }}>{p.visitedAt?.slice(0, 7)}</Text>
                    </GlassCard>
                  );
                })}
              </View>
            );
          })()}
        </ScrollView>
      )}

      {/* ── Explore (full ExploreScreen embedded) ── */}
      {innerTab === 'explore' && (
        <View style={{ flex: 1 }}>
          <ExploreScreen embedded />
        </View>
      )}

      {/* ── Completed Trips ── */}
      {innerTab === 'trips' && (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          <Text style={s.sectionNote}>Trips recorded with the live tracker in Explore</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowCreateTrip(true)}>
            <LinearGradient colors={theme.colors.gradientCool as [string,string]} style={s.addBtnGrad}>
              <Text style={s.addBtnText}>+ Log a Past Trip</Text>
            </LinearGradient>
          </TouchableOpacity>
          {completedLiveTrips.length === 0 ? (
            <GlassCard style={s.emptyCard}>
              <Text style={s.emptyEmoji}>🔴</Text>
              <Text style={s.emptyTitle}>No recorded trips yet</Text>
              <Text style={s.emptySub}>Go to Explore → tap "🔴 Go Live" to record your next adventure.</Text>
            </GlassCard>
          ) : (
            completedLiveTrips.map((trip) => {
              const durationMs = trip.endedAt - trip.startedAt;
              const hours = Math.floor(durationMs / 3_600_000);
              const mins = Math.floor((durationMs % 3_600_000) / 60_000);
              const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
              const photos = trip.pins.filter((p) => p.photoUri);
              const date = new Date(trip.endedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <TouchableOpacity key={trip.id} activeOpacity={0.85} onPress={() => setReviewingTrip(trip)}>
                  <GlassCard style={s.tripCard}>
                    <View style={s.tripCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.tripCardName}>{trip.name}</Text>
                        <Text style={s.tripCardMeta}>
                          {date} · {trip.pins.length} stop{trip.pins.length !== 1 ? 's' : ''} · {durationStr} · {photos.length} photo{photos.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => Alert.alert('Delete trip?', `Remove "${trip.name}"?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteCompletedTrip(trip.id) },
                        ])}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={{ color: theme.colors.textMuted, fontSize: 20 }}>⋮</Text>
                      </TouchableOpacity>
                    </View>
                    {photos.length > 0 && (
                      <View style={s.photoRow}>
                        {photos.slice(0, 4).map((pin, i) => (
                          <Image key={pin.id} source={{ uri: pin.photoUri! }} style={[s.photoThumb, i > 0 && { marginLeft: 6 }]} resizeMode="cover" />
                        ))}
                        {photos.length > 4 && (
                          <View style={[s.photoThumb, s.photoThumbMore, { marginLeft: 6 }]}>
                            <Text style={s.photoThumbMoreText}>+{photos.length - 4}</Text>
                          </View>
                        )}
                      </View>
                    )}
                    <Text style={s.tripStops} numberOfLines={1}>{trip.pins.map((p) => p.placeName).join('  →  ')}</Text>
                    <Text style={s.tripTap}>Tap to view map + photos →</Text>
                  </GlassCard>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ── Planned Trips ── */}
      {innerTab === 'planned' && (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          <TouchableOpacity style={s.addBtn} onPress={() => setInnerTab('explore')}>
            <LinearGradient colors={theme.colors.gradientCool as [string,string]} style={s.addBtnGrad}>
              <Text style={s.addBtnText}>Plan a New Trip in Explore 🧭</Text>
            </LinearGradient>
          </TouchableOpacity>

          {trips.length === 0 ? (
            <GlassCard style={s.emptyCard}>
              <Text style={s.emptyEmoji}>✈️</Text>
              <Text style={s.emptyTitle}>No trips planned yet</Text>
              <Text style={s.emptySub}>Tap "Plan a New Trip" above or open the Explore tab → tap "✈️ Plan Trip" to build your route.</Text>
            </GlassCard>
          ) : (
            trips.map((trip) => (
              <GlassCard key={trip.id} style={s.tripCard}>
                <View style={s.tripCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.tripCardName}>{trip.name}</Text>
                    <Text style={s.tripCardMeta}>
                      {trip.stops.length} stop{trip.stops.length !== 1 ? 's' : ''} · {new Set(trip.stops.map((st) => st.country)).size} countr{new Set(trip.stops.map((st) => st.country)).size !== 1 ? 'ies' : 'y'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => Alert.alert('Delete trip', `Delete "${trip.name}"?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteTrip(trip.id) },
                    ])}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={{ color: theme.colors.textMuted, fontSize: 20 }}>⋮</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.routeRow}>
                  {trip.stops.slice(0, 4).map((stop, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {i > 0 && <Text style={s.arrow}>→</Text>}
                      <Text style={s.stopName} numberOfLines={1}>{stop.name}</Text>
                    </View>
                  ))}
                  {trip.stops.length > 4 && <Text style={s.moreStops}>+{trip.stops.length - 4}</Text>}
                </View>
                <TouchableOpacity style={s.shareBtn} onPress={() => setSharingTrip(trip)}>
                  <Text style={s.shareBtnText}>↗ Share</Text>
                </TouchableOpacity>
              </GlassCard>
            ))
          )}
        </ScrollView>
      )}

      {/* ─── Modals / sheets ──────────────────────────────────────────────────── */}

      {/* Country picker — multi-select */}
      <Modal visible={showCountryPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={s.pickerModal}>
          <View style={s.pickerHeader}>
            <TouchableOpacity onPress={() => { setSelectedCountries(new Set()); setShowCountryPicker(false); }}>
              <Text style={s.pickerClose}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.pickerTitle}>Add Countries</Text>
            {/* spacer to centre title */}
            <View style={{ width: 60 }} />
          </View>
          <View style={s.pickerSearch}>
            <Text style={{ fontSize: 16 }}>🔍</Text>
            <TextInput
              style={s.pickerSearchInput}
              placeholder="Search countries..."
              placeholderTextColor={theme.colors.textMuted}
              value={countrySearch}
              onChangeText={setCountrySearch}
              autoFocus
            />
          </View>
          <FlatList
            data={ALL_COUNTRIES.filter((c) =>
              c.name.toLowerCase().includes(countrySearch.toLowerCase()) &&
              !stamps.find((st) => st.country === c.name)
            )}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => {
              const selected = selectedCountries.has(item.name);
              return (
                <TouchableOpacity
                  style={[s.pickerItem, selected && s.pickerItemSelected]}
                  onPress={() => toggleCountry(item.name)}
                  activeOpacity={0.7}
                >
                  <Text style={s.pickerItemEmoji}>{item.emoji}</Text>
                  <Text style={[s.pickerItemName, selected && { color: '#fff', fontWeight: '700' }]}>{item.name}</Text>
                  <View style={[s.pickerCheckbox, selected && s.pickerCheckboxSelected]}>
                    {selected && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
            keyboardShouldPersistTaps="handled"
          />
          {/* Confirm button */}
          <View style={s.pickerFooter}>
            <TouchableOpacity
              style={[s.pickerConfirmBtn, selectedCountries.size === 0 && s.pickerConfirmBtnDisabled]}
              onPress={confirmAddCountries}
              disabled={selectedCountries.size === 0}
            >
              <Text style={s.pickerConfirmText}>
                {selectedCountries.size === 0
                  ? 'Select countries above'
                  : `Add ${selectedCountries.size} countr${selectedCountries.size === 1 ? 'y' : 'ies'}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full travel map */}
      <Modal visible={showTravelMap} animationType="slide" onRequestClose={() => setShowTravelMap(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={s.mapModalHeader}>
            <Text style={s.mapModalTitle}>My Travel Map</Text>
            <TouchableOpacity onPress={() => setShowTravelMap(false)}>
              <Text style={s.mapModalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <LeafletMapView places={visitedPlaces} style={{ flex: 1 }} />
        </SafeAreaView>
      </Modal>

      {/* Create planned trip */}
      <CreateTripModal
        visible={showCreateTrip}
        onClose={() => setShowCreateTrip(false)}
      />

      {/* Trip share sheet */}
      <TripShareSheet trip={sharingTrip} onClose={() => setSharingTrip(null)} />

      {/* Live trip review */}
      {reviewingTrip && (
        <LiveTripSummarySheet
          trip={reviewingTrip}
          onClose={() => setReviewingTrip(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { color: theme.colors.textMuted, fontSize: 13, marginTop: 4 },

  // Inner tabs
  innerTabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  innerTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  innerTabActive: { borderBottomColor: theme.colors.primary },
  innerTabEmoji: { fontSize: 16 },
  innerTabLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  innerTabLabelActive: { color: theme.colors.primary },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mapStatsRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 4,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: theme.colors.border },
  statNum: { color: '#fff', fontSize: 28, fontWeight: '800' },
  statLabel: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },

  // Add button
  addBtn: { borderRadius: 14, overflow: 'hidden' },
  addBtnGrad: { paddingVertical: 14, alignItems: 'center', borderRadius: 14 },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Empty state
  emptyCard: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  emptySub: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 },

  // Stamps grid
  stampsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stampCard: {
    width: (SCREEN_W - 32 - 10 * 2) / 3,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    position: 'relative',
  },
  stampDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,60,60,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stampDeleteIcon: { color: '#fff', fontSize: 10, fontWeight: '800' },
  stampEmoji: { fontSize: 30, marginBottom: 4 },
  stampCountry: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  stampDate: { color: theme.colors.textMuted, fontSize: 10, marginTop: 2 },

  // Map tab
  mapTabRoot: { flex: 1 },
  inlineMap: { height: 320, position: 'relative' },
  fullscreenBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(10,10,15,0.82)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fullscreenBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Map card (kept for styles ref, no longer used for the card but used elsewhere)
  mapCard: { padding: 18 },
  mapCardTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  mapCardSub: { color: theme.colors.textMuted, fontSize: 13, marginTop: 4 },
  mapCardCta: { marginTop: 12, backgroundColor: theme.colors.primary, borderRadius: 10, padding: 10, alignItems: 'center' },
  mapCardCtaText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  placeRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  placeEmoji: { fontSize: 20 },
  placeName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  placeCountry: { color: theme.colors.textMuted, fontSize: 12, marginTop: 1 },
  placeDate: { color: theme.colors.textMuted, fontSize: 12 },

  // Map modal
  mapModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#0A0A0F',
  },
  mapModalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  mapModalClose: { color: theme.colors.textMuted, fontSize: 22 },

  // Trips
  sectionNote: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 4 },
  tripCard: { padding: 16, gap: 8 },
  tripCardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  tripCardName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tripCardMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  tripStops: { color: theme.colors.textMuted, fontSize: 12 },
  tripTap: { color: theme.colors.primary, fontSize: 12 },

  photoRow: { flexDirection: 'row', marginTop: 4 },
  photoThumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: theme.colors.border },
  photoThumbMore: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,252,0.3)' },
  photoThumbMoreText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Planned trips
  routeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  arrow: { color: theme.colors.textMuted, marginHorizontal: 2 },
  stopName: { color: theme.colors.textSecondary, fontSize: 13, maxWidth: 80 },
  moreStops: { color: theme.colors.textMuted, fontSize: 12, marginLeft: 4 },
  shareBtn: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(124,92,252,0.2)',
    borderWidth: 1, borderColor: theme.colors.primary,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, marginTop: 4,
  },
  shareBtnText: { color: theme.colors.primary, fontSize: 13, fontWeight: '700' },

  // Country picker
  pickerModal: { flex: 1, backgroundColor: theme.colors.background },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  pickerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  pickerClose: { color: theme.colors.primary, fontSize: 16, fontWeight: '600' },
  pickerSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, backgroundColor: theme.colors.surface,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  pickerSearchInput: { flex: 1, color: '#fff', fontSize: 15 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  pickerItemEmoji: { fontSize: 24, width: 36 },
  pickerItemName: { flex: 1, color: theme.colors.textSecondary, fontSize: 15 },
  pickerItemSelected: { backgroundColor: 'rgba(124,92,252,0.15)' },
  pickerCheckbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  pickerCheckboxSelected: {
    backgroundColor: theme.colors.primary, borderColor: theme.colors.primary,
  },
  pickerFooter: {
    padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border,
    paddingBottom: 32,
  },
  pickerConfirmBtn: {
    backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.full,
    paddingVertical: 16, alignItems: 'center',
  },
  pickerConfirmBtnDisabled: { backgroundColor: theme.colors.surface },
  pickerConfirmText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  pickerItemAdd: { color: theme.colors.primary, fontSize: 22, fontWeight: '300' },
});
