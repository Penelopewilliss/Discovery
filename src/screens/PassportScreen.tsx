import React, { useState, useEffect } from 'react';
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
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import GlassCard from '../components/GlassCard';
import LeafletMapView from '../components/LeafletMapView';
import TripShareSheet from '../components/TripShareSheet';
import LiveTripSummarySheet from '../components/LiveTripSummarySheet';
import CreateTripModal from '../components/CreateTripModal';
import ExploreScreen from './ExploreScreen';
import { useUser, Trip, CompletedLiveTrip } from '../context/UserContext';
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

// ─── Inner tab type ────────────────────────────────────────────────────────────
type InnerTab = 'countries' | 'explore' | 'trips' | 'planned';

export default function PassportScreen() {
  const {
    visitedPlaces, trips, deleteTrip, completedLiveTrips, deleteCompletedTrip,
  } = useUser();

  // Tabs / navigation
  const [innerTab, setInnerTab] = useState<InnerTab>('countries');

  // Countries (stamps)
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // Map modals
  const [showTravelMap, setShowTravelMap] = useState(false);

  // Other sheets
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [sharingTrip, setSharingTrip] = useState<Trip | null>(null);
  const [reviewingTrip, setReviewingTrip] = useState<CompletedLiveTrip | null>(null);

  // Load stamps from Firestore
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, 'users', uid)).then((snap) => {
      const data = snap.data() ?? {};
      if (Array.isArray(data.stamps)) setStamps(data.stamps as Stamp[]);
    }).catch(() => {});
  }, []);

  const saveStamps = async (next: Stamp[]) => {
    setStamps(next);
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try { await updateDoc(doc(db, 'users', uid), { stamps: next }); } catch (_) {}
  };

  const addCountry = (item: { name: string; emoji: string }) => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    saveStamps([...stamps, { country: item.name, emoji: item.emoji, visitedAt: month }]);
    setShowCountryPicker(false);
  };

  const deleteCountry = (country: string) => {
    Alert.alert('Remove country', `Remove ${country} from your passport?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => saveStamps(stamps.filter((s) => s.country !== country)) },
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
              <Text style={s.statNum}>{new Set(stamps.map((s) => s.visitedAt?.slice(0, 4))).size || 0}</Text>
              <Text style={s.statLabel}>Years</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statNum}>{visitedPlaces.length}</Text>
              <Text style={s.statLabel}>Places</Text>
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

      {/* Country picker */}
      <Modal visible={showCountryPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={s.pickerModal}>
          <View style={s.pickerHeader}>
            <Text style={s.pickerTitle}>Add Country</Text>
            <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
              <Text style={s.pickerClose}>Done</Text>
            </TouchableOpacity>
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
            renderItem={({ item }) => (
              <TouchableOpacity style={s.pickerItem} onPress={() => addCountry(item)}>
                <Text style={s.pickerItemEmoji}>{item.emoji}</Text>
                <Text style={s.pickerItemName}>{item.name}</Text>
                <Text style={s.pickerItemAdd}>+</Text>
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
          />
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
  pickerItemName: { flex: 1, color: '#fff', fontSize: 15 },
  pickerItemAdd: { color: theme.colors.primary, fontSize: 22, fontWeight: '300' },
});
