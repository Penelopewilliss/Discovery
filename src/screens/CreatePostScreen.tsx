import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  Image,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { theme } from '../theme';
import { addPost, mockPlaces } from '../data/mockData';
import { Post, PostDelay, PrivacyLevel, TravelMood, TravelTag, MediaItem } from '../types';
import GlassCard from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { scheduleLocalNotification, scheduleDelayedPostNotification } from '../utils/notifications';
import { searchFsqPlaces, FsqPlace } from '../utils/foursquare';

const TAGS: TravelTag[] = ['beach', 'food', 'hidden gem', 'city', 'nature', 'budget', 'luxury', 'adventure', 'culture', 'solo'];
const MOODS: TravelMood[] = ['wanderlust', 'relaxed', 'adventurous', 'romantic', 'spiritual', 'thrilled'];
const DELAY_OPTIONS: { label: string; value: PostDelay }[] = [
  { label: '🟢 Post Now', value: 'now' },
  { label: '⏱ After 6 Hours', value: '6h' },
  { label: '⏳ After 24 Hours', value: '24h' },
  { label: '⏰ After 48 Hours', value: '48h' },
  { label: '🚗 After I Leave', value: 'after leaving' },
  { label: '✈️ After Trip Ends', value: 'after trip' },
];
const PRIVACY_OPTIONS: { label: string; value: PrivacyLevel }[] = [
  { label: '🌐 Public', value: 'public' },
  { label: '👥 Followers Only', value: 'followers' },
  { label: '🔒 Private Group Only', value: 'group' },
];

let postCounter = 100;

export default function CreatePostScreen() {
  const { markVisited } = useUser();
  const [caption, setCaption] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedPlaceFsq, setSelectedPlaceFsq] = useState<FsqPlace | null>(null);
  const [selectedTags, setSelectedTags] = useState<TravelTag[]>([]);
  const [selectedMood, setSelectedMood] = useState<TravelMood>('wanderlust');
  const [delay, setDelay] = useState<PostDelay>('24h');
  const [privacy, setPrivacy] = useState<PrivacyLevel>('public');
  const [hideExact, setHideExact] = useState(true);
  const [blurLocation, setBlurLocation] = useState(false);
  const [hideStay, setHideStay] = useState(true);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [reactionsEnabled, setReactionsEnabled] = useState(true);
  const [suggestions, setSuggestions] = useState<FsqPlace[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [placesLoading, setPlacesLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (destination.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    clearTimeout(searchTimer.current);
    setPlacesLoading(true);
    searchTimer.current = setTimeout(async () => {
      const results = await searchFsqPlaces(destination);
      setSuggestions(results.slice(0, 5));
      setShowSuggestions(results.length > 0);
      setPlacesLoading(false);
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [destination]);

  const handleGPS = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow location access in settings.'); return; }
    setPlacesLoading(true);
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const results = await Location.reverseGeocodeAsync(loc.coords);
    if (results[0]) {
      const r = results[0];
      setDestination([r.city || r.district, r.country].filter(Boolean).join(', '));
    }
    setPlacesLoading(false);
  };

  const pickSuggestion = (place: FsqPlace) => {
    setDestination(`${place.name}${place.location.country ? ', ' + place.location.country : ''}`);
    setSelectedPlaceFsq(place);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const MAX_MEDIA = 10;

  const pickMedia = async (source: 'library' | 'camera', type: 'photo' | 'video') => {
    const remaining = MAX_MEDIA - mediaItems.length;
    if (remaining <= 0) {
      Alert.alert('Limit reached', `You can add up to ${MAX_MEDIA} photos/videos per post.`);
      return;
    }
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access in your device settings.');
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: type === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          videoMaxDuration: 60,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.8,
          videoMaxDuration: 60,
          allowsMultipleSelection: true,
          selectionLimit: remaining,
        });
    if (!result.canceled && result.assets.length > 0) {
      const newItems: MediaItem[] = result.assets.map((a) => ({
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'photo',
      }));
      setMediaItems((prev) => [...prev, ...newItems].slice(0, MAX_MEDIA));
    }
  };

  const removeMedia = (index: number) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleTag = (tag: TravelTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handlePost = () => {
    if (!caption.trim()) {
      Alert.alert('Missing caption', 'Please write a caption for your post.');
      return;
    }
    if (!destination.trim()) {
      Alert.alert('Missing destination', 'Please add a destination.');
      return;
    }
    if (selectedTags.length === 0) {
      Alert.alert('Missing category', 'Please select at least one travel tag.');
      return;
    }

    postCounter += 1;
    const newPost: Post = {
      id: `post_new_${postCounter}`,
      userId: 'user_1',
      username: 'aurora.travels',
      userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
      imageUrl: mediaItems.length > 0 ? mediaItems[0].uri : mockPlaces[Math.floor(Math.random() * mockPlaces.length)].coverImage,
      mediaItems: mediaItems.length > 0 ? mediaItems : undefined,
      caption,
      locationArea: destination,
      destination,
      tags: selectedTags,
      mood: selectedMood,
      likes: 0,
      comments: 0,
      delay,
      privacy,
      hideExactLocation: hideExact,
      blurLocation,
      hideStayLocation: hideStay,
      createdAt: new Date().toISOString(),
      liked: false,
      saved: false,
      reactions: {},
      userReaction: null,
      reactionsEnabled,
    };

    addPost(newPost);

    // Auto-mark the tagged place as visited
    if (selectedPlaceFsq) {
      const geo = selectedPlaceFsq.geocodes?.main;
      if (geo) {
        markVisited({
          id: selectedPlaceFsq.fsq_id ?? `post_place_${Date.now()}`,
          name: selectedPlaceFsq.name,
          country: selectedPlaceFsq.location.country ?? selectedPlaceFsq.location.locality ?? '',
          lat: geo.latitude,
          lon: geo.longitude,
          coverImage: mediaItems[0]?.uri ?? '',
          visitedAt: new Date().toISOString(),
        });
      }
    } else if (destination.trim()) {
      // Plain text destination typed (no suggestion picked) — still add as a visited entry
      markVisited({
        id: `post_dest_${Date.now()}`,
        name: destination.trim(),
        country: '',
        lat: 0,
        lon: 0,
        coverImage: mediaItems[0]?.uri ?? '',
        visitedAt: new Date().toISOString(),
      });
    }

    // Send local notification feedback
    if (delay === 'now') {
      scheduleLocalNotification('✈️ Post is live!', `Your memory from ${destination} is now on the feed.`);
    } else {
      const delayMap: Record<PostDelay, number> = {
        now: 0, '6h': 21600, '24h': 86400, '48h': 172800,
        'after leaving': 43200, 'after trip': 259200,
      };
      scheduleDelayedPostNotification(destination, delayMap[delay]);
    }

    Alert.alert(
      '✈️ Post created!',
      delay === 'now'
        ? 'Your post is now live on the feed.'
        : `Your post will be published ${DELAY_OPTIONS.find((d) => d.value === delay)?.label.replace(/^.+? /, 'after ')} for your privacy.`,
      [{ text: 'Got it' }]
    );

    // Reset form
    setCaption('');
    setDestination('');
    setSelectedTags([]);
    setSelectedMood('wanderlust');
    setDelay('24h');
    setPrivacy('public');
    setHideExact(true);
    setBlurLocation(false);
    setHideStay(true);
    setReactionsEnabled(true);
    setMediaItems([]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Post</Text>
          <Text style={styles.subtitle}>Share your travel story</Text>
        </View>

        {/* Media picker */}
        <View style={styles.section}>
          <View style={styles.mediaHeader}>
            <Text style={styles.label}>Photos & Videos</Text>
            <Text style={styles.mediaCount}>{mediaItems.length}/{MAX_MEDIA}</Text>
          </View>

          {/* Thumbnails strip */}
          {mediaItems.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip} contentContainerStyle={styles.thumbStripContent}>
              {mediaItems.map((item, index) => (
                <View key={index} style={styles.thumb}>
                  <Image source={{ uri: item.uri }} style={styles.thumbImg} resizeMode="cover" />
                  {item.type === 'video' && (
                    <View style={styles.thumbVideoBadge}>
                      <Text style={{ fontSize: 16 }}>▶</Text>
                    </View>
                  )}
                  {index === 0 && (
                    <View style={styles.thumbCoverBadge}>
                      <Text style={styles.thumbCoverText}>Cover</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.thumbRemove} onPress={() => removeMedia(index)}>
                    <Text style={styles.thumbRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Add media buttons */}
          {mediaItems.length < MAX_MEDIA && (
            <View style={styles.mediaButtons}>
              <TouchableOpacity style={styles.mediaBtn} onPress={() => pickMedia('library', 'photo')}>
                <Text style={styles.mediaBtnIcon}>🖼️</Text>
                <Text style={styles.mediaBtnLabel}>Add Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaBtn} onPress={() => pickMedia('library', 'video')}>
                <Text style={styles.mediaBtnIcon}>🎬</Text>
                <Text style={styles.mediaBtnLabel}>Add Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaBtn} onPress={() => pickMedia('camera', 'photo')}>
                <Text style={styles.mediaBtnIcon}>📷</Text>
                <Text style={styles.mediaBtnLabel}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaBtn} onPress={() => pickMedia('camera', 'video')}>
                <Text style={styles.mediaBtnIcon}>🎥</Text>
                <Text style={styles.mediaBtnLabel}>Record</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Safety notice */}
        <GlassCard style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>🛡️ Safety Reminder</Text>
          <Text style={styles.safetyText}>
            For your safety, avoid posting your exact location while you are still there. Use delayed posting to protect your privacy.
          </Text>
        </GlassCard>

        {/* Caption */}
        <View style={styles.section}>
          <Text style={styles.label}>Caption</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textArea}
              placeholder="Tell your travel story..."
              placeholderTextColor={theme.colors.textMuted}
              value={caption}
              onChangeText={setCaption}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Destination */}
        <View style={styles.section}>
          <Text style={styles.label}>📍 Destination</Text>
          <View style={styles.destinationRow}>
            <TextInput
              style={styles.destinationInput}
              placeholder="Search for a place..."
              placeholderTextColor={theme.colors.textMuted}
              value={destination}
              onChangeText={(t) => { setDestination(t); setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            />
            <TouchableOpacity style={styles.gpsBtn} onPress={handleGPS}>
              {placesLoading
                ? <ActivityIndicator size="small" color={theme.colors.primary} />
                : <Text style={{ fontSize: 18 }}>📡</Text>}
            </TouchableOpacity>
          </View>
          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {suggestions.map((place, i) => (
                <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => pickSuggestion(place)}>
                  <Text style={styles.suggestionName}>📍 {place.name}</Text>
                  <Text style={styles.suggestionSub}>{[place.location.locality, place.location.country].filter(Boolean).join(', ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Travel Category */}
        <View style={styles.section}>
          <Text style={styles.label}>Travel Category</Text>
          <View style={styles.chipGroup}>
            {TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <TouchableOpacity key={tag} onPress={() => toggleTag(tag)}>
                  {active ? (
                    <LinearGradient
                      colors={theme.colors.gradientPrimary as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.chip}
                    >
                      <Text style={styles.chipTextActive}>{tag}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.chipInactive}>
                      <Text style={styles.chipText}>{tag}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Mood */}
        <View style={styles.section}>
          <Text style={styles.label}>Mood</Text>
          <View style={styles.chipGroup}>
            {MOODS.map((mood) => {
              const active = selectedMood === mood;
              return (
                <TouchableOpacity key={mood} onPress={() => setSelectedMood(mood)}>
                  {active ? (
                    <LinearGradient
                      colors={theme.colors.gradientCool as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.chip}
                    >
                      <Text style={styles.chipTextActive}>{mood}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.chipInactive}>
                      <Text style={styles.chipText}>{mood}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Delayed Posting */}
        <View style={styles.section}>
          <Text style={styles.label}>Safety Posting</Text>
          <View style={styles.optionGroup}>
            {DELAY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionBtn, delay === opt.value && styles.optionBtnActive]}
                onPress={() => setDelay(opt.value)}
              >
                <Text style={[styles.optionText, delay === opt.value && styles.optionTextActive]}>
                  {opt.label}
                </Text>
                {delay === opt.value && (
                  <Text style={styles.optionCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.label}>Privacy Level</Text>
          <View style={styles.optionGroup}>
            {PRIVACY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionBtn, privacy === opt.value && styles.optionBtnActive]}
                onPress={() => setPrivacy(opt.value)}
              >
                <Text style={[styles.optionText, privacy === opt.value && styles.optionTextActive]}>
                  {opt.label}
                </Text>
                {privacy === opt.value && (
                  <Text style={styles.optionCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Location privacy toggles */}
        <View style={styles.section}>
          <Text style={styles.label}>Location Privacy</Text>
          <GlassCard style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Hide Exact Location</Text>
                <Text style={styles.toggleSub}>Only show a general region</Text>
              </View>
              <Switch
                value={hideExact}
                onValueChange={setHideExact}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#fff"
              />
            </View>
            <View style={[styles.toggleRow, styles.toggleBorder]}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Blur to City Only</Text>
                <Text style={styles.toggleSub}>Show city name, not area</Text>
              </View>
              <Switch
                value={blurLocation}
                onValueChange={setBlurLocation}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#fff"
              />
            </View>
            <View style={[styles.toggleRow, styles.toggleBorder]}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Hide Hotel / Stay Location</Text>
                <Text style={styles.toggleSub}>Do not reveal where you are staying</Text>
              </View>
              <Switch
                value={hideStay}
                onValueChange={setHideStay}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#fff"
              />
            </View>
            <View style={[styles.toggleRow, styles.toggleBorder]}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Allow Reactions</Text>
                <Text style={styles.toggleSub}>Let others react with emoji to your post</Text>
              </View>
              <Switch
                value={reactionsEnabled}
                onValueChange={setReactionsEnabled}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </GlassCard>
        </View>

        {/* Submit */}
        <TouchableOpacity onPress={handlePost} style={styles.submitBtn}>
          <LinearGradient
            colors={theme.colors.gradientPrimary as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGradient}
          >
            <Text style={styles.submitText}>✈️ Share Your Journey</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: theme.spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    padding: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.md,
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
  safetyCard: {
    borderColor: 'rgba(252,92,125,0.4)',
    backgroundColor: 'rgba(252,92,125,0.08)',
    marginBottom: theme.spacing.lg,
  },
  safetyTitle: {
    color: theme.colors.accent,
    ...theme.typography.h3,
    marginBottom: 6,
  },
  safetyText: {
    color: theme.colors.textSecondary,
    ...theme.typography.body,
    lineHeight: 20,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    color: theme.colors.text,
    ...theme.typography.h3,
    marginBottom: theme.spacing.sm,
  },
  inputWrapper: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  destinationInput: {
    flex: 1,
    color: theme.colors.text,
    ...theme.typography.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  gpsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionsBox: {
    marginTop: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  suggestionName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionSub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  input: {
    color: theme.colors.text,
    ...theme.typography.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  textArea: {
    color: theme.colors.text,
    ...theme.typography.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    minHeight: 100,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipInactive: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipText: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: '#fff',
    ...theme.typography.caption,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  optionGroup: {
    gap: theme.spacing.sm,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  optionBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(124,92,252,0.12)',
  },
  optionText: {
    color: theme.colors.textMuted,
    ...theme.typography.body,
  },
  optionTextActive: {
    color: theme.colors.primaryLight,
    fontWeight: '600',
  },
  optionCheck: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  toggleCard: {
    padding: 0,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  toggleBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  toggleInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  toggleLabel: {
    color: theme.colors.text,
    ...theme.typography.body,
    fontWeight: '500',
  },
  toggleSub: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    marginTop: 2,
  },
  submitBtn: {
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: theme.borderRadius.full,
  },
  submitText: {
    color: '#fff',
    ...theme.typography.h3,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  mediaCount: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
  },
  thumbStrip: {
    marginBottom: theme.spacing.sm,
  },
  thumbStripContent: {
    gap: 10,
    paddingRight: 4,
  },
  thumb: {
    width: 90,
    height: 90,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbVideoBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  thumbCoverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  thumbCoverText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  mediaButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mediaBtn: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  mediaBtnIcon: {
    fontSize: 28,
  },
  mediaBtnLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
});
