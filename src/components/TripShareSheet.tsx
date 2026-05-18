import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { Trip, TripStop, useUser } from '../context/UserContext';
import { createPostInFirestore, saveStory } from '../services/postsService';
import LeafletMapView, { LMarker, LRegion } from './LeafletMapView';

const BG_IMAGES = [
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80',
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80',
  'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=800&q=80',
];

const STOP_COLORS = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6'];

function buildStaticMapUrl(stops: TripStop[]): string {
  const valid = stops.filter((s) => s.lat && s.lon);
  if (valid.length === 0) return '';
  const lats = valid.map((s) => s.lat);
  const lons = valid.map((s) => s.lon);
  const cLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const cLon = lons.reduce((a, b) => a + b, 0) / lons.length;
  const spread = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lons) - Math.min(...lons));
  const zoom = spread < 2 ? 9 : spread < 10 ? 6 : spread < 30 ? 5 : spread < 80 ? 3 : 2;
  const markers = valid
    .slice(0, 10)
    .map((s) => `${s.lat.toFixed(4)},${s.lon.toFixed(4)},lightblue`)
    .join('|');
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${cLat.toFixed(4)},${cLon.toFixed(4)}&zoom=${zoom}&size=600x280&markers=${markers}`;
}

function stopsToRegion(stops: TripStop[]): LRegion {
  const valid = stops.filter((s) => s.lat && s.lon);
  if (valid.length === 0) return { latitude: 20, longitude: 10, latitudeDelta: 80, longitudeDelta: 100 };
  const lats = valid.map((s) => s.lat);
  const lons = valid.map((s) => s.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const padLat = Math.max(10, (maxLat - minLat) * 0.5);
  const padLon = Math.max(15, (maxLon - minLon) * 0.5);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(20, maxLat - minLat + padLat * 2),
    longitudeDelta: Math.max(30, maxLon - minLon + padLon * 2),
  };
}

interface Props {
  trip: Trip | null;
  onClose: () => void;
}

export default function TripShareSheet({ trip, onClose }: Props) {
  const { user } = useUser();
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'followers'>('public');
  const [includeMap, setIncludeMap] = useState(true);

  if (!trip) return null;

  const stopNames = trip.stops.map((s) => s.name);
  const countries = [...new Set(trip.stops.map((s) => s.country))];
  const bgImage = BG_IMAGES[trip.id.length % BG_IMAGES.length];
  const staticMapUrl = buildStaticMapUrl(trip.stops);
  const mapRegion = stopsToRegion(trip.stops);
  const mapMarkers: LMarker[] = trip.stops
    .filter((s) => s.lat && s.lon)
    .map((s, i) => ({
      id: `preview_${i}`,
      latitude: s.lat,
      longitude: s.lon,
      color: STOP_COLORS[i % STOP_COLORS.length],
      label: s.name,
      sublabel: s.country,
    }));
  const polyline = trip.stops
    .filter((s) => s.lat && s.lon)
    .map((s) => ({ latitude: s.lat, longitude: s.lon }));

  const postImageUrl = includeMap && staticMapUrl ? staticMapUrl : bgImage;

  const shareToFeed = async () => {
    await createPostInFirestore({
      id: `trip_post_${Date.now()}`,
      userId: user?.id ?? 'user_1',
      username: user?.username ?? 'traveler',
      userAvatar: user?.avatarUri ?? null,
      imageUrl: postImageUrl,
      caption: caption.trim() || `Just shared my trip: ${trip.name} ✈️`,
      locationArea: stopNames[0] ?? 'Unknown',
      destination: stopNames.join(' → '),
      tags: ['adventure'],
      mood: ['wanderlust'],
      likes: 0,
      likesCount: 0,
      comments: 0,
      commentsCount: 0,
      delay: 'now',
      privacy,
      hideExactLocation: false,
      blurLocation: false,
      hideStayLocation: false,
      createdAt: new Date().toISOString(),
      liked: false,
      saved: false,
      reactions: {},
      userReaction: null,
      reactionsEnabled: true,
      media: postImageUrl ? [{ uri: postImageUrl, type: 'photo' }] : [],
      tripShare: {
        tripName: trip.name,
        stops: stopNames,
        countries,
        stopCount: trip.stops.length,
        mapIncluded: includeMap && !!staticMapUrl,
        mapImageUrl: includeMap && staticMapUrl ? staticMapUrl : undefined,
        stopCoords: trip.stops
          .filter((s) => s.lat && s.lon)
          .map((s) => ({ lat: s.lat, lon: s.lon })),
      },
    });
    Alert.alert('Posted! 🎉', 'Your trip card is live on the feed.', [
      { text: 'OK', onPress: onClose },
    ]);
  };

  const shareAsStory = async () => {
    try {
      await saveStory({
        userId: user?.id ?? '',
        username: user?.username ?? 'traveler',
        userAvatar: user?.avatarUri ?? null,
        image: postImageUrl || null,
        videoUri: null,
        overlayText: `${trip.name}\n${stopNames.slice(0, 3).join(' → ')}${stopNames.length > 3 ? ` +${stopNames.length - 3}` : ''}`,
        location: countries[0] ?? stopNames[0] ?? null,
        music: null,
        mentions: [],
      });
      Alert.alert('Story shared! 📸', 'Your trip story will appear at the top of the feed.', [
        { text: 'OK', onPress: onClose },
      ]);
    } catch (e: any) {
      Alert.alert('Failed', e.message ?? 'Could not share story. Try again.');
    }
  };

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Share Trip</Text>

          {/* Map toggle */}
          <View style={styles.mapToggleRow}>
            <Text style={styles.mapToggleLabel}>\ud83d\uddfa\ufe0f  Include map with route</Text>
            <Switch
              value={includeMap}
              onValueChange={setIncludeMap}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {/* Preview */}
          {includeMap && mapMarkers.length > 0 ? (
            <View style={styles.mapPreview}>
              <LeafletMapView
                style={{ flex: 1 }}
                region={mapRegion}
                markers={mapMarkers}
                polylineCoords={polyline}
                polylineColor="#6366f1"
                interactive={false}
              />
              <View style={styles.mapOverlay}>
                <Text style={styles.mapOverlayName} numberOfLines={1}>\u2708\ufe0f  {trip.name}</Text>
                <Text style={styles.mapOverlayMeta}>
                  {trip.stops.length} stops \u00b7 {countries.length} countr{countries.length !== 1 ? 'ies' : 'y'} \u00b7 HiddenGems
                </Text>
              </View>
            </View>
          ) : (
            <LinearGradient
              colors={['#6366f1', '#8b5cf6', '#a78bfa']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.previewCard}
            >
              <Text style={styles.previewEmoji}>\u2708\ufe0f</Text>
              <Text style={styles.previewTripName} numberOfLines={1}>{trip.name}</Text>
              <Text style={styles.previewMeta}>
                {trip.stops.length} stops \u00b7 {countries.length} countr{countries.length !== 1 ? 'ies' : 'y'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                {stopNames.slice(0, 4).map((name, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {i > 0 && <Text style={styles.arrow}>  \u2192  </Text>}
                    <View style={styles.stopPill}>
                      <Text style={styles.stopName} numberOfLines={1}>{name}</Text>
                    </View>
                  </View>
                ))}
                {trip.stops.length > 4 && <Text style={styles.more}>  +{trip.stops.length - 4}</Text>}
              </View>
              <Text style={styles.watermark}>HiddenGems \u00b7 Trip Plan</Text>
            </LinearGradient>
          )}

          {/* Caption */}
          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption... (optional)"
            placeholderTextColor={theme.colors.textMuted}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={280}
          />

          {/* Privacy */}
          <View style={styles.privacyRow}>
            <Text style={styles.privacyLabel}>Audience:</Text>
            {(['public', 'followers'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.privacyBtn, privacy === p && styles.privacyBtnActive]}
                onPress={() => setPrivacy(p)}
              >
                <Text style={[styles.privacyText, privacy === p && styles.privacyTextActive]}>
                  {p === 'public' ? '\ud83c\udf0d Public' : '\ud83d\udc65 Followers'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.feedBtn} onPress={shareToFeed}>
            <Text style={styles.feedBtnText}>\ud83d\udcf0  Post to Feed</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.storyBtn} onPress={shareAsStory}>
            <Text style={styles.storyBtnText}>\ud83d\udcf8  Share as Story</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    maxHeight: '92%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  mapToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  mapToggleLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  mapPreview: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapOverlayName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  mapOverlayMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  previewCard: { borderRadius: 16, padding: 18, marginBottom: 14 },
  previewEmoji: { fontSize: 26, marginBottom: 4 },
  previewTripName: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  previewMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 10 },
  stopPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 120,
    marginBottom: 6,
  },
  stopName: { color: '#fff', fontSize: 12, fontWeight: '600' },
  arrow: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  more: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  watermark: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontStyle: 'italic', textAlign: 'right', marginTop: 8 },
  captionInput: {
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 52,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  privacyLabel: { color: theme.colors.textMuted, fontSize: 14, marginRight: 4 },
  privacyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  privacyBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  privacyText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  privacyTextActive: { color: '#fff' },
  feedBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  feedBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  storyBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  storyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: theme.colors.textMuted, fontSize: 15 },
});
