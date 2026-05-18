import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { LiveTrip } from '../context/UserContext';
import { useUser } from '../context/UserContext';
import { createPostInFirestore } from '../services/postsService';
import LeafletMapView, { LMarker, LRegion } from './LeafletMapView';

const STOP_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#14b8a6'];

function buildStaticMapUrl(pins: LiveTrip['pins']): string {
  if (pins.length === 0) return '';
  const lats = pins.map((p) => p.latitude);
  const lons = pins.map((p) => p.longitude);
  const cLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const cLon = lons.reduce((a, b) => a + b, 0) / lons.length;
  const spread = Math.max(
    Math.max(...lats) - Math.min(...lats),
    Math.max(...lons) - Math.min(...lons),
  );
  const zoom = spread < 2 ? 9 : spread < 10 ? 6 : spread < 30 ? 5 : spread < 80 ? 3 : 2;
  const markers = pins
    .slice(0, 10)
    .map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)},red`)
    .join('|');
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${cLat.toFixed(4)},${cLon.toFixed(4)}&zoom=${zoom}&size=600x300&markers=${markers}`;
}

function pinsToRegion(pins: LiveTrip['pins']): LRegion {
  if (pins.length === 0) {
    return { latitude: 20, longitude: 10, latitudeDelta: 80, longitudeDelta: 100 };
  }
  const lats = pins.map((p) => p.latitude);
  const lons = pins.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const padLat = Math.max(0.08, (maxLat - minLat) * 0.5);
  const padLon = Math.max(0.12, (maxLon - minLon) * 0.5);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.3, maxLat - minLat + padLat * 2),
    longitudeDelta: Math.max(0.4, maxLon - minLon + padLon * 2),
  };
}

interface Props {
  trip: LiveTrip;
  /** 'view' = read-only during trip; 'end' = confirm + share before ending */
  mode: 'view' | 'end';
  onClose: () => void;
  onEnd: () => void;
  userAvatar?: string | null;
  username?: string;
}

export default function LiveTripSummarySheet({
  trip,
  mode,
  onClose,
  onEnd,
  userAvatar,
  username,
}: Props) {
  const { user: loggedInUser } = useUser();
  const markers: LMarker[] = trip.pins.map((pin, i) => ({
    id: pin.id,
    latitude: pin.latitude,
    longitude: pin.longitude,
    color: STOP_COLORS[i % STOP_COLORS.length],
    label: `${i + 1}. ${pin.placeName}`,
    sublabel: pin.note || undefined,
  }));

  const polyline = trip.pins.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  const region = pinsToRegion(trip.pins);
  const withPhotos = trip.pins.filter((p) => p.photoUri);

  const shareToFeed = () => {
    const photoItems = withPhotos.map((p) => ({
      uri: p.photoUri!,
      type: 'photo' as const,
    }));
    const stopNames = trip.pins.map((p) => p.placeName);
    const staticMapUrl = buildStaticMapUrl(trip.pins);

    // Carousel: static map first, then each stop photo
    const allMedia = [
      ...(staticMapUrl ? [{ uri: staticMapUrl, type: 'photo' as const }] : []),
      ...photoItems,
    ];

    createPostInFirestore({
      id: '',
      userId: loggedInUser?.id ?? '',
      username: username ?? loggedInUser?.username ?? 'traveler',
      userAvatar:
        userAvatar ??
        loggedInUser?.avatarUri ??
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80',
      imageUrl: staticMapUrl || photoItems[0]?.uri ||
        'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
      mediaItems: allMedia.length > 0 ? allMedia : undefined,
      caption:
        `📍 Live trip recap: ${trip.name}\n` +
        stopNames.slice(0, 6).join(' → ') +
        (stopNames.length > 6 ? ` +${stopNames.length - 6} more` : ''),
      locationArea: stopNames[0] ?? 'On the road',
      destination: stopNames.join(' → '),
      tags: ['adventure'],
      mood: ['wanderlust'],
      likes: 0,
      comments: 0,
      delay: 'now',
      privacy: trip.privacy === 'close-friends' ? 'followers' : trip.privacy,
      hideExactLocation: false,
      blurLocation: false,
      hideStayLocation: false,
      createdAt: new Date().toISOString(),
      liked: false,
      saved: false,
      reactions: {},
      userReaction: null,
      reactionsEnabled: true,
      tripShare: {
        tripName: trip.name,
        stops: stopNames,
        countries: [],
        stopCount: trip.pins.length,
        mapIncluded: true,
      },
    });

    Alert.alert(
      '🎉 Shared to feed!',
      `Your live trip "${trip.name}" is live with ${photoItems.length} photo${photoItems.length !== 1 ? 's' : ''} + route map.`,
      [{ text: 'Awesome!', onPress: onEnd }],
    );
  };

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>
            {mode === 'end' ? '\ud83c\udfc1 End Live Trip' : '\ud83d\udccd Your Stops'}
          </Text>
          <Text style={styles.sub}>
            {trip.name} \u00b7 {trip.pins.length} stop
            {trip.pins.length !== 1 ? 's' : ''}
          </Text>

          {/* Map preview */}
          {trip.pins.length > 0 ? (
            <View style={styles.mapWrap}>
              <LeafletMapView
                style={{ flex: 1 }}
                region={region}
                markers={markers}
                polylineCoords={polyline.length > 1 ? polyline : undefined}
                polylineColor="#ef4444"
                interactive={false}
              />
            </View>
          ) : (
            <View style={[styles.mapWrap, styles.mapEmpty]}>
              <Text style={{ fontSize: 36 }}>\ud83d\uddfa\ufe0f</Text>
              <Text style={styles.mapEmptyText}>No stops dropped yet</Text>
            </View>
          )}

          {/* Photo + stop strip */}
          {trip.pins.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoStrip}
            >
              {trip.pins.map((pin, i) => (
                <View key={pin.id} style={styles.stopCard}>
                  {pin.photoUri ? (
                    <Image
                      source={{ uri: pin.photoUri }}
                      style={styles.stopPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.stopPhoto, styles.stopPhotoEmpty]}>
                      <Text style={{ fontSize: 24 }}>\ud83d\udccd</Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.stopNumBadge,
                      { backgroundColor: STOP_COLORS[i % STOP_COLORS.length] },
                    ]}
                  >
                    <Text style={styles.stopNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stopName} numberOfLines={1}>
                    {pin.placeName}
                  </Text>
                  {!!pin.note && (
                    <Text style={styles.stopNote} numberOfLines={1}>
                      {pin.note}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          {trip.pins.length === 0 && (
            <Text style={styles.emptyHint}>
              Go back to the map and tap "\ud83d\udcf8 Drop Stop" to add your first stop!
            </Text>
          )}

          {/* Action buttons */}
          {mode === 'end' ? (
            <>
              {trip.pins.length > 0 && (
                <TouchableOpacity style={styles.shareBtn} onPress={shareToFeed}>
                  <LinearGradient
                    colors={['#6366f1', '#8b5cf6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.shareBtnInner}
                  >
                    <Text style={styles.shareBtnText}>
                      \ud83d\udce4  Share to Feed
                      {withPhotos.length > 0
                        ? ` (${withPhotos.length} photo${withPhotos.length !== 1 ? 's' : ''})`
                        : ''}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.endBtn} onPress={onEnd}>
                <Text style={styles.endBtnText}>End trip without sharing</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Keep going</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.endBtn} onPress={onClose}>
              <Text style={styles.endBtnText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingBottom: 36,
    paddingTop: 12,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  sub: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  mapWrap: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mapEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    gap: 10,
  },
  mapEmptyText: { color: theme.colors.textMuted, fontSize: 14 },
  photoStrip: {
    paddingBottom: 4,
    gap: 10,
    paddingRight: 4,
    marginBottom: 14,
  },
  stopCard: { width: 120, position: 'relative' },
  stopPhoto: {
    width: 120,
    height: 100,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: theme.colors.background,
  },
  stopPhotoEmpty: { alignItems: 'center', justifyContent: 'center' },
  stopNumBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  stopNumText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stopName: { color: theme.colors.text, fontSize: 12, fontWeight: '600' },
  stopNote: { color: theme.colors.textMuted, fontSize: 11, marginTop: 1 },
  emptyHint: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    lineHeight: 20,
  },
  shareBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
  shareBtnInner: { paddingVertical: 15, alignItems: 'center' },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  endBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  endBtnText: { color: theme.colors.textMuted, fontWeight: '600', fontSize: 15 },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelBtnText: { color: theme.colors.primary, fontWeight: '700', fontSize: 15 },
});
