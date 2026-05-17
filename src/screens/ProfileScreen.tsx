import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  FlatList,
  Share,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LeafletMapView from '../components/LeafletMapView';
import TripShareSheet from '../components/TripShareSheet';
import LiveTripSummarySheet from '../components/LiveTripSummarySheet';

const SCREEN = Dimensions.get('window');
import { theme } from '../theme';
import { mockUser, mockStamps, mockPosts, mockFollowers, mockFollowing } from '../data/mockData';
import GlassCard from '../components/GlassCard';
import { useUser, Trip, CompletedLiveTrip } from '../context/UserContext';
import { PostDelay } from '../types';

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

const DELAY_LABELS: Record<PostDelay, string> = {
  now: 'Post Immediately',
  '6h': '6 Hours Later',
  '24h': '24 Hours Later',
  '48h': '48 Hours Later',
  'after leaving': 'After Leaving',
  'after trip': 'After Trip Ends',
};

const BADGE_COLORS = [
  theme.colors.gradientPrimary,
  theme.colors.gradientCool,
  theme.colors.gradientWarm,
  ['#11998e', '#38ef7d'],
  ['#F7971E', '#FFD200'],
];

export default function ProfileScreen() {
  const { user: loggedInUser, setUser, visitedPlaces, trips, deleteTrip, completedLiveTrips, deleteCompletedTrip } = useUser();
  const [reviewingTrip, setReviewingTrip] = useState<CompletedLiveTrip | null>(null);
  const [sharingTrip, setSharingTrip] = useState<Trip | null>(null);
  const user = mockUser;
  const [privateProfile, setPrivateProfile] = useState(user.privateProfile);
  const [hideLocation, setHideLocation] = useState(user.hideExactLocation);
  const [defaultDelay, setDefaultDelay] = useState<PostDelay>(user.defaultDelayedPosting);
  const [showDelayPicker, setShowDelayPicker] = useState(false);
  const [showFollowersList, setShowFollowersList] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);
  const [selectedSavedPost, setSelectedSavedPost] = useState<typeof savedPosts[0] | null>(null);
  const [showTravelMap, setShowTravelMap] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  // Edit profile
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(loggedInUser?.name ?? '');
  const [editUsername, setEditUsername] = useState(loggedInUser?.username ?? '');
  const [editBio, setEditBio] = useState(loggedInUser?.bio ?? '');
  const [editAvatar, setEditAvatar] = useState(loggedInUser?.avatarUri ?? null);

  // Countries
  const [stamps, setStamps] = useState(() => [...mockStamps]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const displayName = loggedInUser?.name || '';
  const rawUsername = loggedInUser?.username || '';
  const username = rawUsername.includes('@') ? (rawUsername.split('@')[0].replace(/[^a-zA-Z0-9._]/g, '') || '') : rawUsername;
  const bio = loggedInUser?.bio || '';
  const avatarUri = loggedInUser?.avatarUri || null;

  const openEdit = () => {
    setEditName(loggedInUser?.name ?? displayName);
    setEditUsername(loggedInUser?.username ?? username);
    setEditBio(loggedInUser?.bio ?? '');
    setEditAvatar(loggedInUser?.avatarUri ?? null);
    setShowEdit(true);
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access in your device settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setEditAvatar(result.assets[0].uri);
    }
  };

  const takeAvatar = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access in your device settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setEditAvatar(result.assets[0].uri);
    }
  };

  const saveProfile = async () => {
    const updated = {
      name: editUsername.trim().replace(/@/g, '') || username,
      username: editUsername.trim().replace(/@/g, '') || username,
      email: loggedInUser?.email ?? '',
      bio: editBio.trim(),
      avatarUri: editAvatar,
      homeCountry: loggedInUser?.homeCountry ?? '',
      interests: loggedInUser?.interests ?? [],
    };
    setUser(updated);
    try {
      await AsyncStorage.setItem('@travlora_user', JSON.stringify(updated));
    } catch (_) {}
    setShowEdit(false);
  };

  const savedPosts = mockPosts.filter((p) => user.savedPosts.includes(p.id));

  // ── Edit Profile view ──────────────────────────────────────────────────────
  if (showEdit) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.editHeader}>
            <TouchableOpacity onPress={() => setShowEdit(false)}>
              <Text style={styles.editCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.editTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={saveProfile}>
              <Text style={styles.editSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: theme.spacing.md }}>
            {/* Avatar */}
            <View style={styles.editAvatarSection}>
              {editAvatar ? (
                <Image source={{ uri: editAvatar }} style={styles.editAvatar} />
              ) : (
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.accent]}
                  style={[styles.editAvatar, styles.editAvatarFallback]}
                >
                  <Text style={styles.editAvatarInitial}>{displayName[0]?.toUpperCase() ?? '?'}</Text>
                </LinearGradient>
              )}
              <View style={styles.editAvatarBtns}>
                <TouchableOpacity style={styles.editAvatarBtn} onPress={pickAvatar}>
                  <Text style={styles.editAvatarBtnText}>📷  Choose Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editAvatarBtn} onPress={takeAvatar}>
                  <Text style={styles.editAvatarBtnText}>📸  Take Photo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bio */}
            <Text style={styles.editLabel}>Username</Text>
            <View style={styles.editUsernameRow}>
              <Text style={styles.editAtSign}>@</Text>
              <TextInput
                style={[styles.editFieldInput, { flex: 1 }]}
                value={editUsername}
                onChangeText={(t) => setEditUsername(t.replace(/@/g, '').replace(/\s/g, '').toLowerCase())}
                placeholder="yourusername"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
              />
            </View>

            <Text style={[styles.editLabel, { marginTop: theme.spacing.md }]}>Bio</Text>
            <TextInput
              style={styles.editBioInput}
              value={editBio}
              onChangeText={(t) => setEditBio(t.slice(0, 150))}
              placeholder="Tell the world about your travels…"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              maxLength={150}
            />
            <Text style={styles.editCharCount}>{editBio.length}/150</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Normal profile view ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero / Avatar */}
        <LinearGradient
          colors={theme.colors.gradientPrimary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.avatarWrapper}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.accent]}
                style={[styles.avatar, styles.avatarFallback]}
              >
                <Text style={styles.avatarInitial}>{displayName[0]?.toUpperCase() ?? '?'}</Text>
              </LinearGradient>
            )}
            <View style={styles.avatarBorder} />
          </View>
        </LinearGradient>

        <View style={styles.profileContent}>
          {/* Identity */}
          <Text style={styles.displayName}>{username ? `@${username}` : 'Set your username'}</Text>
          {!!bio && <Text style={styles.bio}>{bio}</Text>}

          {/* Edit Profile button */}
          <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
            <Text style={styles.editBtnText}>✏️  Edit Profile</Text>
          </TouchableOpacity>

          {/* Stats rows */}
          <View style={styles.statsBlock}>
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.stat} onPress={() => setShowFollowersList(true)}>
                <Text style={styles.statValue}>{mockFollowers.length}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity style={styles.stat} onPress={() => setShowFollowingList(true)}>
                <Text style={styles.statValue}>{mockFollowing.length}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.statsRow, { marginTop: 1 }]}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{stamps.length}</Text>
                <Text style={styles.statLabel}>Countries</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{savedPosts.length}</Text>
                <Text style={styles.statLabel}>Saved</Text>
              </View>
            </View>
          </View>

          {/* Travel style badges */}
          <View style={styles.badgesSection}>
            <Text style={styles.sectionTitle}>Travel Style</Text>
            <View style={styles.badgeRow}>
              {user.travelStyleBadges.map((badge, i) => (
                <LinearGradient
                  key={badge}
                  colors={BADGE_COLORS[i % BADGE_COLORS.length] as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.badge}
                >
                  <Text style={styles.badgeText}>{badge}</Text>
                </LinearGradient>
              ))}
            </View>
          </View>

          {/* Travel Passport */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>✈️ Travel Passport</Text>
            <TouchableOpacity onPress={() => { setCountrySearch(''); setShowCountryPicker(true); }} style={styles.addCountryBtn}>
              <Text style={styles.addCountryBtnText}>+ Add Country</Text>
            </TouchableOpacity>
          </View>
          <GlassCard style={styles.passportCard}>
            <Text style={styles.passportHeader}>Visited Countries</Text>
            {stamps.length === 0 && (
              <Text style={styles.noCountriesText}>Tap "+ Add Country" to log your travels 🌍</Text>
            )}
            <View style={styles.stampsGrid}>
              {stamps.map((stamp) => (
                <TouchableOpacity
                  key={stamp.country}
                  style={styles.stamp}
                  onLongPress={() => {
                    Alert.alert('Remove country', `Remove ${stamp.country}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => setStamps((prev) => prev.filter((s) => s.country !== stamp.country)) },
                    ]);
                  }}
                >
                  <Text style={styles.stampEmoji}>{stamp.emoji}</Text>
                  <Text style={styles.stampCountry}>{stamp.country}</Text>
                  <Text style={styles.stampDate}>{stamp.visitedAt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </GlassCard>

          {/* My Travel Map */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>🗺️ My Travel Map</Text>
            {visitedPlaces.length > 0 && (
              <TouchableOpacity
                onPress={async () => {
                  const names = visitedPlaces.map((p) => p.country ? `${p.name}, ${p.country}` : p.name).join('  ·  ');
                  await Share.share({
                    message: `Places I've visited on Discovery:\n${names}\n\nDownload Discovery to build yours! 🌍`,
                    title: 'My Discovery Travel Map',
                  });
                }}
                style={styles.addCountryBtn}
              >
                <Text style={styles.addCountryBtnText}>Share 🔗</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={() => setShowTravelMap(true)} activeOpacity={0.85}>
            <GlassCard style={styles.travelMapPreview}>
              {visitedPlaces.length === 0 ? (
                <View style={styles.travelMapEmpty}>
                  <Text style={styles.travelMapEmptyEmoji}>🌍</Text>
                  <Text style={styles.travelMapEmptyTitle}>No places visited yet</Text>
                  <Text style={styles.travelMapEmptySub}>
                    Drop a pin on the map, tag a place in a post, or drop stops on a live trip to start building your collection.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.travelMapStatsRow}>
                    <View style={styles.travelMapStat}>
                      <Text style={styles.travelMapStatNum}>{visitedPlaces.length}</Text>
                      <Text style={styles.travelMapStatLabel}>Places</Text>
                    </View>
                    <View style={styles.travelMapStat}>
                      <Text style={styles.travelMapStatNum}>
                        {new Set(visitedPlaces.map((p) => p.country)).size}
                      </Text>
                      <Text style={styles.travelMapStatLabel}>Countries</Text>
                    </View>
                    <View style={styles.travelMapStat}>
                      <Text style={styles.travelMapStatNum}>
                        {new Set(visitedPlaces.map((p) => p.visitedAt.slice(0, 4))).size}
                      </Text>
                      <Text style={styles.travelMapStatLabel}>Years</Text>
                    </View>
                  </View>
                  {/* place list hidden — visible in full map */}
                  <Text style={styles.travelMapTap}>Tap to open full map →</Text>
                </>
              )}
            </GlassCard>
          </TouchableOpacity>

          {/* ═══ Live Trip History ═══ */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>🔴 Live Trip History</Text>
          </View>
          {completedLiveTrips.length === 0 ? (
            <GlassCard style={styles.tripsEmptyCard}>
              <Text style={styles.tripsEmptyEmoji}>🗺️</Text>
              <Text style={styles.tripsEmptyTitle}>No live trips yet</Text>
              <Text style={styles.tripsEmptySub}>
                Go to Explore → tap "🔴 Go Live" to start your first road trip.
              </Text>
            </GlassCard>
          ) : (
            completedLiveTrips.map((trip) => {
              const durationMs = trip.endedAt - trip.startedAt;
              const hours = Math.floor(durationMs / 3_600_000);
              const mins = Math.floor((durationMs % 3_600_000) / 60_000);
              const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
              const photos = trip.pins.filter((p) => p.photoUri);
              const date = new Date(trip.endedAt).toLocaleDateString(undefined, {
                day: 'numeric', month: 'short', year: 'numeric',
              });
              return (
                <TouchableOpacity
                  key={trip.id}
                  activeOpacity={0.85}
                  onPress={() => setReviewingTrip(trip)}
                >
                  <GlassCard style={styles.liveTripCard}>
                    <View style={styles.liveTripCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.liveTripCardName}>{trip.name}</Text>
                        <Text style={styles.liveTripCardMeta}>
                          {date} · {trip.pins.length} stop{trip.pins.length !== 1 ? 's' : ''} · {durationStr} · {photos.length} photo{photos.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert('Delete trip?', `Remove "${trip.name}" from your history?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => deleteCompletedTrip(trip.id) },
                          ])
                        }
                        style={styles.tripCardDelete}
                      >
                        <Text style={{ color: theme.colors.textMuted, fontSize: 18 }}>⋮</Text>
                      </TouchableOpacity>
                    </View>
                    {/* Photo thumbnail strip */}
                    {photos.length > 0 && (
                      <View style={styles.liveTripPhotoRow}>
                        {photos.slice(0, 4).map((pin, i) => (
                          <Image
                            key={pin.id}
                            source={{ uri: pin.photoUri! }}
                            style={[styles.liveTripThumb, i > 0 && { marginLeft: 6 }]}
                            resizeMode="cover"
                          />
                        ))}
                        {photos.length > 4 && (
                          <View style={[styles.liveTripThumb, styles.liveTripThumbMore, { marginLeft: 6 }]}>
                            <Text style={styles.liveTripThumbMoreText}>+{photos.length - 4}</Text>
                          </View>
                        )}
                      </View>
                    )}
                    {/* Stop names */}
                    <Text style={styles.liveTripStops} numberOfLines={1}>
                      {trip.pins.map((p) => p.placeName).join('  →  ')}
                    </Text>
                    <Text style={styles.liveTripTap}>Tap to view map + photos →</Text>
                  </GlassCard>
                </TouchableOpacity>
              );
            })
          )}

          {/* My Trips — planned journeys */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>✈️ My Trips</Text>
          </View>
          {trips.length === 0 ? (
            <GlassCard style={styles.tripsEmptyCard}>
              <Text style={styles.tripsEmptyEmoji}>✈️</Text>
              <Text style={styles.tripsEmptyTitle}>No trips planned yet</Text>
              <Text style={styles.tripsEmptySub}>
                Go to Explore → tap the map → press “✈️ Plan Trip” to build your first journey.
              </Text>
            </GlassCard>
          ) : (
            trips.map((trip) => (
              <TouchableOpacity key={trip.id} onPress={() => setSelectedTrip(trip)} activeOpacity={0.85}>
                <GlassCard style={styles.tripCard}>
                  <View style={styles.tripCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tripCardName}>{trip.name}</Text>
                      <Text style={styles.tripCardMeta}>
                        {trip.stops.length} stop{trip.stops.length !== 1 ? 's' : ''} · {new Set(trip.stops.map((s) => s.country)).size} countr{new Set(trip.stops.map((s) => s.country)).size !== 1 ? 'ies' : 'y'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => Alert.alert('Delete trip', `Delete “${trip.name}”?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteTrip(trip.id) },
                      ])}
                      style={styles.tripCardDelete}
                    >
                      <Text style={{ color: theme.colors.textMuted, fontSize: 18 }}>⋮</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.tripCardRoute}>
                    {trip.stops.slice(0, 4).map((stop, i) => (
                      <View key={i} style={styles.tripCardStop}>
                        {i > 0 && <Text style={styles.tripCardArrow}>→</Text>}
                        <Text style={styles.tripCardStopName} numberOfLines={1}>{stop.name}</Text>
                      </View>
                    ))}
                    {trip.stops.length > 4 && (
                      <Text style={styles.tripCardMore}>+{trip.stops.length - 4}</Text>
                    )}
                  </View>
                  <View style={styles.tripCardFooter}>
                    <Text style={styles.tripCardTap}>Tap to view on map →</Text>
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation?.(); setSharingTrip(trip); }}
                      style={styles.tripShareBtn}
                    >
                      <Text style={styles.tripShareBtnText}>↗ Share</Text>
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            ))
          )}

          {/* Trip Share Sheet */}
          <TripShareSheet trip={sharingTrip} onClose={() => setSharingTrip(null)} />

          {/* Country Picker Modal */}
          <Modal visible={showCountryPicker} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.pickerModal}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Add Country</Text>
                <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                  <Text style={styles.pickerClose}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.pickerSearch}>
                <Text style={{ fontSize: 16 }}>🔍</Text>
                <TextInput
                  style={styles.pickerSearchInput}
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
                  !stamps.find((s) => s.country === c.name)
                )}
                keyExtractor={(item) => item.name}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.pickerItem}
                    onPress={() => {
                      const now = new Date();
                      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                      setStamps((prev) => [...prev, { country: item.name, emoji: item.emoji, visitedAt: month }]);
                      setShowCountryPicker(false);
                    }}
                  >
                    <Text style={styles.pickerItemEmoji}>{item.emoji}</Text>
                    <Text style={styles.pickerItemName}>{item.name}</Text>
                    <Text style={styles.pickerItemAdd}>+</Text>
                  </TouchableOpacity>
                )}
                keyboardShouldPersistTaps="handled"
              />
            </View>
          </Modal>

          {/* Saved Posts */}
          {savedPosts.length > 0 && (
            <View style={styles.savedSection}>
              <Text style={styles.sectionTitle}>🔖 Saved Posts</Text>
              {savedPosts.map((post) => (
                <TouchableOpacity key={post.id} onPress={() => setSelectedSavedPost(post)} activeOpacity={0.8}>
                  <GlassCard style={styles.savedCard}>
                    <Image source={{ uri: post.imageUrl }} style={styles.savedImage} resizeMode="cover" />
                    <View style={styles.savedInfo}>
                      <Text style={styles.savedDestination}>{post.destination}</Text>
                      <Text style={styles.savedCaption} numberOfLines={2}>{post.caption}</Text>
                    </View>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 18, paddingRight: 4 }}>›</Text>
                  </GlassCard>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Privacy settings */}
          <Text style={[styles.sectionTitle, { marginTop: theme.spacing.lg }]}>🔒 Privacy Settings</Text>
          <GlassCard style={styles.privacyCard}>
            <View style={styles.privacyRow}>
              <View style={styles.privacyInfo}>
                <Text style={styles.privacyLabel}>Private Profile</Text>
                <Text style={styles.privacySub}>Only approved followers see your posts</Text>
              </View>
              <Switch
                value={privateProfile}
                onValueChange={setPrivateProfile}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={[styles.privacyRow, styles.borderTop]}>
              <View style={styles.privacyInfo}>
                <Text style={styles.privacyLabel}>Hide Exact Location</Text>
                <Text style={styles.privacySub}>Default for all new posts</Text>
              </View>
              <Switch
                value={hideLocation}
                onValueChange={setHideLocation}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={[styles.privacyRow, styles.borderTop]}>
              <View style={styles.privacyInfo}>
                <Text style={styles.privacyLabel}>Default Posting Delay</Text>
                <TouchableOpacity onPress={() => setShowDelayPicker((v) => !v)}>
                  <Text style={styles.privacyValue}>{DELAY_LABELS[defaultDelay]} ▾</Text>
                </TouchableOpacity>
              </View>
            </View>

            {showDelayPicker && (
              <View style={styles.delayPicker}>
                {(Object.entries(DELAY_LABELS) as [PostDelay, string][]).map(([val, label]) => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.delayOption, defaultDelay === val && styles.delayOptionActive]}
                    onPress={() => {
                      setDefaultDelay(val);
                      setShowDelayPicker(false);
                    }}
                  >
                    <Text style={[styles.delayOptionText, defaultDelay === val && styles.delayOptionTextActive]}>
                      {label}
                    </Text>
                    {defaultDelay === val && <Text style={styles.delayCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </GlassCard>
        </View>

        <View style={{ height: theme.spacing.xxl }} />
      </ScrollView>

      {/* Followers Modal */}
      <Modal visible={showFollowersList} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Followers</Text>
            <TouchableOpacity onPress={() => setShowFollowersList(false)}>
              <Text style={styles.pickerClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={mockFollowers}
            keyExtractor={(item) => item}
            renderItem={({ item, index }) => (
              <View style={styles.userListRow}>
                <View style={styles.userListAvatar}>
                  <Text style={{ fontSize: 20 }}>👤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userListName}>Traveller {index + 1}</Text>
                  <Text style={styles.userListHandle}>@traveller_{item.slice(-1)}</Text>
                </View>
              </View>
            )}
          />
        </View>
      </Modal>

      {/* Following Modal */}
      <Modal visible={showFollowingList} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Following</Text>
            <TouchableOpacity onPress={() => setShowFollowingList(false)}>
              <Text style={styles.pickerClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={mockFollowing}
            keyExtractor={(item) => item}
            renderItem={({ item, index }) => (
              <View style={styles.userListRow}>
                <View style={styles.userListAvatar}>
                  <Text style={{ fontSize: 20 }}>👤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userListName}>Traveller {index + 1}</Text>
                  <Text style={styles.userListHandle}>@traveller_{item.slice(-1)}</Text>
                </View>
              </View>
            )}
          />
        </View>
      </Modal>

      {/* Saved Post Detail Modal */}
      <Modal visible={!!selectedSavedPost} animationType="slide" presentationStyle="pageSheet">
        {selectedSavedPost && (
          <View style={[styles.pickerModal, { backgroundColor: theme.colors.background }]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{selectedSavedPost.destination ?? 'Saved Post'}</Text>
              <TouchableOpacity onPress={() => setSelectedSavedPost(null)}>
                <Text style={styles.pickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Image source={{ uri: selectedSavedPost.imageUrl }} style={{ width: '100%', aspectRatio: 1 }} resizeMode="cover" />
              <View style={{ padding: theme.spacing.md }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginBottom: 8 }}>@{selectedSavedPost.username} · 📍 {selectedSavedPost.locationArea}</Text>
                <Text style={{ color: theme.colors.text, fontSize: 15, lineHeight: 22 }}>{selectedSavedPost.caption}</Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>❤️ {selectedSavedPost.likes}</Text>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>💬 {selectedSavedPost.comments}</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* My Travel Map Modal */}
      <Modal visible={showTravelMap} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.travelMapModal}>
          {/* Header */}
          <View style={styles.travelMapHeader}>
            <View>
              <Text style={styles.travelMapTitle}>🗺️ My Travel Map</Text>
              <Text style={styles.travelMapSubtitle}>
                {visitedPlaces.length} places · {new Set(visitedPlaces.map((p) => p.country)).size} countries
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowTravelMap(false)}
              style={styles.travelMapCloseBtn}
            >
              <Text style={styles.travelMapClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Map */}
          {visitedPlaces.length === 0 ? (
            <View style={styles.travelMapEmptyFull}>
              <Text style={{ fontSize: 64 }}>🌍</Text>
              <Text style={styles.travelMapEmptyTitle}>No places yet</Text>
              <Text style={styles.travelMapEmptySub}>
                Go to Explore, open a destination and tap{'\n'}"📍 I've been here!" to add it here.
              </Text>
            </View>
          ) : (
            <LeafletMapView
              style={{ flex: 1, width: SCREEN.width }}
              region={{
                latitude: visitedPlaces[0].lat,
                longitude: visitedPlaces[0].lon,
                latitudeDelta: 60,
                longitudeDelta: 80,
              }}
              markers={visitedPlaces.map((place, i) => ({
                id: place.id,
                latitude: place.lat,
                longitude: place.lon,
                color: '#22c55e',
                label: place.name,
                sublabel: `${place.country} · Stop #${i + 1}`,
              }))}
              polylineCoords={visitedPlaces.map((p) => ({ latitude: p.lat, longitude: p.lon }))}
              polylineColor={theme.colors.primary}
            />
          )}

          {/* Bottom strip — journey list */}
          {visitedPlaces.length > 0 && (
            <View style={styles.travelMapBottomStrip}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: theme.spacing.sm }}>
                {visitedPlaces.map((place, i) => (
                  <View key={place.id} style={styles.travelMapStopChip}>
                    <Text style={styles.travelMapStopNum}>{i + 1}</Text>
                    <Text style={styles.travelMapStopName} numberOfLines={1}>{place.name}</Text>
                    <Text style={styles.travelMapStopCountry} numberOfLines={1}>{place.country || 'Pinned location'}</Text>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.travelMapShareBtn}
                onPress={async () => {
                  const names = visitedPlaces.map((p, i) => `${i + 1}. ${p.name}${p.country ? ', ' + p.country : ''}`).join('\n');
                  await Share.share({
                    message: `🗺️ My travel journey on Discovery:\n\n${names}\n\nDiscover yours at discoveryapp.com 🌍`,
                    title: 'My Discovery Travel Map',
                  });
                }}
              >
                <Text style={styles.travelMapShareBtnText}>📤 Share My Journey</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ═══ Trip Detail Modal ═══ */}
      <Modal visible={selectedTrip !== null} animationType="slide" presentationStyle="fullScreen">
        {selectedTrip && (
          <View style={styles.tripDetailModal}>
            <View style={styles.tripModalHeader}>
              <TouchableOpacity onPress={() => setSelectedTrip(null)}>
                <Text style={styles.tripModalClose}>✕ Close</Text>
              </TouchableOpacity>
              <Text style={styles.tripModalName} numberOfLines={1}>{selectedTrip.name}</Text>
              <TouchableOpacity
                onPress={async () => {
                  const stops = selectedTrip.stops.map((s, i) => `${i + 1}. ${s.name}, ${s.country}`).join('\n');
                  await Share.share({
                    message: `✈️ ${selectedTrip.name}\n\nMy planned route:\n${stops}\n\nPlanning with Discovery 🌍`,
                  });
                }}
              >
                <Text style={styles.tripModalShare}>📤</Text>
              </TouchableOpacity>
            </View>

            {/* Map with route */}
            <View style={{ height: 300 }}>
              <LeafletMapView
                style={{ flex: 1 }}
                region={{
                  latitude: selectedTrip.stops[0]?.lat ?? 20,
                  longitude: selectedTrip.stops[0]?.lon ?? 10,
                  latitudeDelta: 60,
                  longitudeDelta: 70,
                }}
                markers={selectedTrip.stops.map((stop, i) => ({
                  id: String(i),
                  latitude: stop.lat,
                  longitude: stop.lon,
                  color: '#6366f1',
                  label: `${i + 1}. ${stop.name}`,
                }))}
                polylineCoords={selectedTrip.stops.map((s) => ({ latitude: s.lat, longitude: s.lon }))}
                polylineColor={theme.colors.primary}
              />
            </View>

            {/* Stop list */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: theme.spacing.md }}>
              <Text style={styles.tripDetailStopsLabel}>
                {selectedTrip.stops.length} stop{selectedTrip.stops.length !== 1 ? 's' : ''}
              </Text>
              {selectedTrip.stops.map((stop, i) => (
                <View key={i} style={styles.tripDetailStopRow}>
                  <View style={styles.tripDetailBadge}>
                    <Text style={styles.tripDetailBadgeText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripDetailStopName}>{stop.name}</Text>
                    <Text style={styles.tripDetailStopCountry}>{stop.country}</Text>
                  </View>
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}
      </Modal>
      {reviewingTrip && (
        <LiveTripSummarySheet
          trip={reviewingTrip}
          mode="view"
          onClose={() => setReviewingTrip(null)}
          onEnd={() => setReviewingTrip(null)}
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
  heroBanner: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  avatarWrapper: {
    position: 'absolute',
    bottom: -44,
    alignSelf: 'center',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: theme.colors.background,
  },
  avatarBorder: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 47,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
  },
  profileContent: {
    marginTop: 56,
    paddingHorizontal: theme.spacing.md,
  },
  displayName: {
    color: theme.colors.text,
    ...theme.typography.h1,
    textAlign: 'center',
  },
  username: {
    color: theme.colors.textMuted,
    ...theme.typography.body,
    textAlign: 'center',
    marginTop: 2,
  },
  bio: {
    color: theme.colors.textSecondary,
    ...theme.typography.body,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  statsBlock: {
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.md,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: theme.colors.text,
    ...theme.typography.h1,
  },
  statLabel: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.colors.border,
  },
  badgesSection: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.colors.text,
    ...theme.typography.h2,
    marginBottom: theme.spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  addCountryBtn: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addCountryBtnText: {
    color: theme.colors.primaryLight,
    ...theme.typography.caption,
    fontWeight: '700',
  },
  noCountriesText: {
    color: theme.colors.textMuted,
    ...theme.typography.body,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
  pickerModal: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerTitle: {
    color: theme.colors.text,
    ...theme.typography.h3,
  },
  pickerClose: {
    color: theme.colors.primaryLight,
    ...theme.typography.body,
    fontWeight: '600',
  },
  pickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.full,
    margin: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  pickerSearchInput: {
    flex: 1,
    color: theme.colors.text,
    ...theme.typography.body,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  pickerItemEmoji: {
    fontSize: 24,
  },
  pickerItemName: {
    flex: 1,
    color: theme.colors.text,
    ...theme.typography.body,
  },
  pickerItemAdd: {
    color: theme.colors.primaryLight,
    fontSize: 22,
    fontWeight: '300',
  },
  userListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  userListAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userListName: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  userListHandle: { color: theme.colors.textMuted, fontSize: 13, marginTop: 1 },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  badge: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  badgeText: {
    color: '#fff',
    ...theme.typography.caption,
    fontWeight: '700',
  },
  passportCard: {
    marginBottom: theme.spacing.lg,
  },
  passportHeader: {
    color: theme.colors.text,
    ...theme.typography.h3,
    marginBottom: theme.spacing.md,
  },
  stampsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  stamp: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    minWidth: 72,
  },
  stampEmoji: {
    fontSize: 24,
  },
  stampCountry: {
    color: theme.colors.text,
    ...theme.typography.tiny,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  stampDate: {
    color: theme.colors.textMuted,
    fontSize: 9,
    marginTop: 2,
  },
  savedSection: {
    marginBottom: theme.spacing.lg,
  },
  savedCard: {
    flexDirection: 'row',
    padding: 0,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  savedImage: {
    width: 80,
    height: 70,
    borderTopLeftRadius: theme.borderRadius.md,
    borderBottomLeftRadius: theme.borderRadius.md,
  },
  savedInfo: {
    flex: 1,
    padding: theme.spacing.sm,
    justifyContent: 'center',
  },
  savedDestination: {
    color: theme.colors.text,
    ...theme.typography.caption,
    fontWeight: '700',
    marginBottom: 3,
  },
  savedCaption: {
    color: theme.colors.textMuted,
    ...theme.typography.tiny,
    lineHeight: 15,
  },
  privacyCard: {
    padding: 0,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  privacyInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  privacyLabel: {
    color: theme.colors.text,
    ...theme.typography.body,
    fontWeight: '500',
  },
  privacySub: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    marginTop: 2,
  },
  privacyValue: {
    color: theme.colors.primary,
    ...theme.typography.caption,
    fontWeight: '600',
    marginTop: 4,
  },
  delayPicker: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  delayOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  delayOptionActive: {
    backgroundColor: 'rgba(124,92,252,0.1)',
  },
  delayOptionText: {
    color: theme.colors.textSecondary,
    ...theme.typography.body,
  },
  delayOptionTextActive: {
    color: theme.colors.primaryLight,
    fontWeight: '600',
  },
  delayCheck: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  editBtn: {
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  editBtnText: {
    color: theme.colors.primaryLight,
    ...theme.typography.caption,
    fontWeight: '700',
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  editTitle: {
    color: theme.colors.text,
    ...theme.typography.h3,
  },
  editCancel: {
    color: theme.colors.textMuted,
    ...theme.typography.body,
  },
  editSave: {
    color: theme.colors.primary,
    ...theme.typography.body,
    fontWeight: '700',
  },
  editAvatarSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  editAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.colors.primary,
  },
  editAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarInitial: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '800',
  },
  editAvatarBtns: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  editAvatarBtn: {
    backgroundColor: theme.colors.glass,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  editAvatarBtnText: {
    color: theme.colors.textSecondary,
    ...theme.typography.caption,
    fontWeight: '600',
  },
  editLabel: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
  },
  editFieldInput: {
    backgroundColor: theme.colors.glass,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    color: theme.colors.text,
    ...theme.typography.body,
    padding: theme.spacing.sm,
    height: 44,
  },
  editUsernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editAtSign: {
    color: theme.colors.primaryLight,
    ...theme.typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  editBioInput: {
    backgroundColor: theme.colors.glass,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    color: theme.colors.text,
    ...theme.typography.body,
    padding: theme.spacing.sm,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  editCharCount: {
    color: theme.colors.textMuted,
    ...theme.typography.tiny,
    textAlign: 'right',
    marginTop: 4,
  },
  // Travel Map
  travelMapPreview: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  travelMapEmpty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  travelMapEmptyEmoji: { fontSize: 40, marginBottom: theme.spacing.sm },
  travelMapEmptyTitle: {
    color: theme.colors.text,
    ...theme.typography.h3,
    marginBottom: 4,
  },
  travelMapEmptySub: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    textAlign: 'center',
  },
  travelMapStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.md,
  },
  travelMapStat: { alignItems: 'center' },
  travelMapStatNum: {
    color: theme.colors.primary,
    fontSize: 28,
    fontWeight: '800',
  },
  travelMapStatLabel: {
    color: theme.colors.textMuted,
    ...theme.typography.tiny,
    marginTop: 2,
  },
  travelMapChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  travelMapChip: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  travelMapChipText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 120,
  },
  travelMapTap: {
    color: theme.colors.primary,
    ...theme.typography.caption,
    textAlign: 'right',
    marginTop: 4,
  },
  // Full Travel Map Modal
  travelMapModal: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  travelMapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    paddingTop: 56,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  travelMapTitle: {
    color: theme.colors.text,
    ...theme.typography.h2,
    fontWeight: '800',
  },
  travelMapSubtitle: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    marginTop: 2,
  },
  travelMapCloseBtn: {
    backgroundColor: theme.colors.glass,
    borderRadius: theme.borderRadius.full,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  travelMapClose: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  travelMapEmptyFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  travelMapBottomStrip: {
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingBottom: 24,
  },
  travelMapStopChip: {
    backgroundColor: theme.colors.glass,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    minWidth: 90,
    alignItems: 'center',
  },
  travelMapStopNum: {
    color: theme.colors.primary,
    fontWeight: '800',
    fontSize: 18,
  },
  travelMapStopName: {
    color: theme.colors.text,
    ...theme.typography.caption,
    fontWeight: '700',
    maxWidth: 90,
    textAlign: 'center',
  },
  travelMapStopCountry: {
    color: theme.colors.textMuted,
    ...theme.typography.tiny,
    maxWidth: 90,
    textAlign: 'center',
  },
  travelMapShareBtn: {
    margin: theme.spacing.md,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  travelMapShareBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  // My Trips section
  tripsEmptyCard: { alignItems: 'center', padding: theme.spacing.xl, marginBottom: theme.spacing.md },
  tripsEmptyEmoji: { fontSize: 48, marginBottom: theme.spacing.sm },
  tripsEmptyTitle: { color: theme.colors.text, fontWeight: '700', fontSize: 16, marginBottom: 6 },
  tripsEmptySub: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  // Live trip history cards
  liveTripCard: { marginBottom: theme.spacing.sm },
  liveTripCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  liveTripCardName: { color: theme.colors.text, fontWeight: '700', fontSize: 16 },
  liveTripCardMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  liveTripPhotoRow: { flexDirection: 'row', marginBottom: 8 },
  liveTripThumb: { width: 60, height: 60, borderRadius: 10, overflow: 'hidden' as const },
  liveTripThumbMore: { backgroundColor: theme.colors.background, alignItems: 'center' as const, justifyContent: 'center' as const },
  liveTripThumbMoreText: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  liveTripStops: { color: theme.colors.textMuted, fontSize: 12, marginBottom: 6 },
  liveTripTap: { color: theme.colors.accent, fontSize: 12, fontWeight: '600' },
  tripCard: { marginBottom: theme.spacing.sm },
  tripCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tripCardName: { color: theme.colors.text, fontWeight: '700', fontSize: 16 },
  tripCardMeta: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  tripCardDelete: { padding: 8, marginLeft: 8 },
  tripCardRoute: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  tripCardStop: { flexDirection: 'row', alignItems: 'center' },
  tripCardArrow: { color: theme.colors.textMuted, marginHorizontal: 4, fontSize: 13 },
  tripCardStopName: { color: theme.colors.textSecondary, fontSize: 13, maxWidth: 80 },
  tripCardMore: { color: theme.colors.primary, fontSize: 13, fontWeight: '700', marginLeft: 4 },
  tripCardTap: { color: theme.colors.textMuted, fontSize: 12, flex: 1 },
  tripCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tripShareBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tripShareBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  // Trip Detail Modal
  tripDetailModal: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 56 },
  tripModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tripModalClose: { color: theme.colors.textMuted, fontSize: 15 },
  tripModalName: { color: theme.colors.text, fontWeight: '700', fontSize: 16, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  tripModalShare: { fontSize: 22 },
  tripDetailStopsLabel: { color: theme.colors.text, fontWeight: '700', fontSize: 15, marginBottom: theme.spacing.md },
  tripDetailStopRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  tripDetailBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  tripDetailBadgeText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  tripDetailStopName: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  tripDetailStopCountry: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
});
