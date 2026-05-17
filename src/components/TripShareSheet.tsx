import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { Trip, useUser } from '../context/UserContext';
import { addPost } from '../data/mockData';

const BG_IMAGES = [
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80',
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80',
  'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=800&q=80',
];

interface Props {
  trip: Trip | null;
  onClose: () => void;
}

export default function TripShareSheet({ trip, onClose }: Props) {
  const { user, addTripStory } = useUser();
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'followers'>('public');

  if (!trip) return null;

  const stopNames = trip.stops.map((s) => s.name);
  const countries = [...new Set(trip.stops.map((s) => s.country))];
  const bgImage = BG_IMAGES[trip.id.length % BG_IMAGES.length];

  const shareToFeed = () => {
    addPost({
      id: `trip_post_${Date.now()}`,
      userId: 'user_1',
      username: user?.username ?? 'traveler',
      userAvatar:
        user?.avatarUri ??
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80',
      imageUrl: bgImage,
      caption: caption.trim() || `Just planned my trip: ${trip.name} ✈️`,
      locationArea: stopNames[0] ?? 'Unknown',
      destination: stopNames.join(' → '),
      tags: ['adventure'],
      mood: 'wanderlust',
      likes: 0,
      comments: 0,
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
      tripShare: {
        tripName: trip.name,
        stops: stopNames,
        countries,
        stopCount: trip.stops.length,
      },
    });
    Alert.alert('Posted! 🎉', 'Your trip card is live on the feed.', [
      { text: 'OK', onPress: onClose },
    ]);
  };

  const shareAsStory = () => {
    addTripStory({
      id: `trip_story_${Date.now()}`,
      username: user?.username ?? 'traveler',
      avatar: user?.avatarUri ?? null,
      bgImage,
      tripName: trip.name,
      stops: stopNames,
      caption: caption.trim(),
      createdAt: Date.now(),
    });
    Alert.alert('Story shared! 📸', 'Your trip story will appear at the top of the feed.', [
      { text: 'OK', onPress: onClose },
    ]);
  };

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />
          <Text style={styles.title}>Share Trip</Text>

          {/* Trip card preview */}
          <LinearGradient
            colors={['#6366f1', '#8b5cf6', '#a78bfa']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.previewCard}
          >
            <Text style={styles.previewEmoji}>✈️</Text>
            <Text style={styles.previewTripName} numberOfLines={2}>
              {trip.name}
            </Text>
            <Text style={styles.previewMeta}>
              {trip.stops.length} stop{trip.stops.length !== 1 ? 's' : ''} ·{' '}
              {countries.length} countr{countries.length !== 1 ? 'ies' : 'y'}
            </Text>

            {/* Route stops */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.routeScroll}
              contentContainerStyle={styles.routeRow}
            >
              {stopNames.slice(0, 5).map((name, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {i > 0 && <Text style={styles.arrow}>  →  </Text>}
                  <View style={styles.stopPill}>
                    <Text style={styles.stopName} numberOfLines={1}>
                      {name}
                    </Text>
                  </View>
                </View>
              ))}
              {trip.stops.length > 5 && (
                <Text style={styles.more}>  +{trip.stops.length - 5} more</Text>
              )}
            </ScrollView>

            <Text style={styles.watermark}>HiddenGems · Trip Plan</Text>
          </LinearGradient>

          {/* Caption input */}
          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption... (optional)"
            placeholderTextColor={theme.colors.textMuted}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={280}
          />

          {/* Privacy toggle */}
          <View style={styles.privacyRow}>
            <Text style={styles.privacyLabel}>Audience:</Text>
            {(['public', 'followers'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.privacyBtn, privacy === p && styles.privacyBtnActive]}
                onPress={() => setPrivacy(p)}
              >
                <Text
                  style={[styles.privacyText, privacy === p && styles.privacyTextActive]}
                >
                  {p === 'public' ? '🌍 Public' : '👥 Followers'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Action buttons */}
          <TouchableOpacity style={styles.feedBtn} onPress={shareToFeed}>
            <Text style={styles.feedBtnText}>📰  Post to Feed</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.storyBtn} onPress={shareAsStory}>
            <Text style={styles.storyBtnText}>📸  Share as Story</Text>
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
    marginBottom: 16,
    textAlign: 'center',
  },
  // Preview card
  previewCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  previewEmoji: { fontSize: 28, marginBottom: 6 },
  previewTripName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  previewMeta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginBottom: 12,
  },
  routeScroll: { marginBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center' },
  stopPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 120,
  },
  stopName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  arrow: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  more: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  watermark: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  // Caption
  captionInput: {
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  // Privacy
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  privacyLabel: { color: theme.colors.textMuted, fontSize: 14, marginRight: 4 },
  privacyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  privacyBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  privacyText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  privacyTextActive: { color: '#fff' },
  // Buttons
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
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { color: theme.colors.textMuted, fontSize: 15 },
});
