import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Modal,
  TouchableWithoutFeedback,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { theme } from '../theme';
import { uploadPostMedia, createPostInFirestore, createOrSchedulePostInFirestore } from '../services/postsService';
import { saveDraft as saveDraftLocal } from '../services/draftService';
import { Post, PostDelay, PrivacyLevel, TravelMood, TravelTag, MediaItem, UserTag, PhotoTag, VibeTag } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, limit } from 'firebase/firestore';
import GlassCard from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { scheduleLocalNotification, scheduleDelayedPostNotification } from '../utils/notifications';
import { searchFsqPlaces, FsqPlace } from '../utils/foursquare';

const TAGS: TravelTag[] = ['beach', 'food', 'hidden gem', 'city', 'nature', 'budget', 'luxury', 'adventure', 'culture', 'solo', 'family', 'road trip', 'hiking', 'photography', 'nightlife', 'wellness', 'history', 'wildlife', 'backpacking', 'island', 'mountains', 'skiing', 'volunteering', 'digital nomad'];
const MOODS: TravelMood[] = ['wanderlust', 'relaxed', 'adventurous', 'romantic', 'spiritual', 'thrilled', 'nostalgic', 'energized', 'peaceful', 'curious', 'grateful', 'inspired', 'excited', 'reflective'];
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

const VIBE_OPTIONS: VibeTag[] = ['quiet','local','romantic','adventurous','budget','family','foodie','party','offbeat','nature','safety','hidden gem','photography','relaxation'];

let postCounter = 100;

export default function CreatePostScreen() {
  const { markVisited, user } = useUser();
  const [caption, setCaption] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedPlaceFsq, setSelectedPlaceFsq] = useState<FsqPlace | null>(null);
  const [selectedTags, setSelectedTags] = useState<TravelTag[]>([]);
  const [vibeTags, setVibeTags] = useState<VibeTag[]>([]);
  const [selectedMood, setSelectedMood] = useState<TravelMood[]>(['wanderlust']);
  const [delay, setDelay] = useState<PostDelay>('24h');
  const [privacy, setPrivacy] = useState<PrivacyLevel>('public');
  const [hideExact, setHideExact] = useState(true);
  const [blurLocation, setBlurLocation] = useState(false);
  const [hideStay, setHideStay] = useState(true);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [reactionsEnabled, setReactionsEnabled] = useState(true);
  const [taggedUsers, setTaggedUsers] = useState<UserTag[]>([]);
  const [photoTags, setPhotoTags] = useState<PhotoTag[]>([]);
  // @mention
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<UserTag[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  // photo tag modal
  const [showPhotoTagModal, setShowPhotoTagModal] = useState(false);
  const [pendingTagPos, setPendingTagPos] = useState<{ xPct: number; yPct: number } | null>(null);
  const [photoTagSearch, setPhotoTagSearch] = useState('');
  const [photoTagSuggestions, setPhotoTagSuggestions] = useState<UserTag[]>([]);
  const [photoTagLoading, setPhotoTagLoading] = useState(false);
  const photoTagSearchTimer = useRef<ReturnType<typeof setTimeout>>();
  const photoImgRef = useRef<View>(null);
  const [photoImgLayout, setPhotoImgLayout] = useState<{ width: number; height: number } | null>(null);
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

  // Search users by username prefix (skipping those who opted out of tagging)
  const searchUsers = async (q: string): Promise<UserTag[]> => {
    if (!q || q.length < 1) return [];
    try {
      const snap = await getDocs(
        query(collection(db, 'users'),
          where('username', '>=', q.toLowerCase()),
          where('username', '<=', q.toLowerCase() + '\uf8ff'),
          limit(8))
      );
      return snap.docs
        .filter((d) => d.data().allowTagging !== false)
        .map((d) => ({
          userId: d.id,
          username: d.data().username ?? '',
          avatarUri: d.data().avatarUri ?? undefined,
        }));
    } catch { return []; }
  };

  // Handle caption changes and detect @mention trigger
  const handleCaptionChange = (text: string) => {
    setCaption(text);
    // Find the @word at the cursor (last @word in the text)
    const match = text.match(/@(\w*)$/);
    if (match) {
      const q = match[1];
      setMentionQuery(q);
      clearTimeout(searchTimer.current);
      setMentionLoading(true);
      searchTimer.current = setTimeout(async () => {
        const results = await searchUsers(q);
        setMentionSuggestions(results);
        setMentionLoading(false);
      }, 300);
    } else {
      setMentionQuery(null);
      setMentionSuggestions([]);
    }
  };

  const insertMention = (u: UserTag) => {
    // Replace the trailing @query with @username
    const replaced = caption.replace(/@(\w*)$/, `@${u.username} `);
    setCaption(replaced);
    setMentionQuery(null);
    setMentionSuggestions([]);
    setTaggedUsers((prev) => prev.find((t) => t.userId === u.userId) ? prev : [...prev, u]);
  };

  // Photo tag search
  useEffect(() => {
    if (photoTagSearch.length < 1) { setPhotoTagSuggestions([]); return; }
    clearTimeout(photoTagSearchTimer.current);
    setPhotoTagLoading(true);
    photoTagSearchTimer.current = setTimeout(async () => {
      const results = await searchUsers(photoTagSearch);
      setPhotoTagSuggestions(results);
      setPhotoTagLoading(false);
    }, 300);
    return () => clearTimeout(photoTagSearchTimer.current);
  }, [photoTagSearch]);

  const confirmPhotoTag = (u: UserTag) => {
    if (!pendingTagPos) return;
    setPhotoTags((prev) => [...prev, { ...u, xPct: pendingTagPos.xPct, yPct: pendingTagPos.yPct }]);
    setTaggedUsers((prev) => prev.find((t) => t.userId === u.userId) ? prev : [...prev, u]);
    setPendingTagPos(null);
    setPhotoTagSearch('');
    setPhotoTagSuggestions([]);
  };

  const handlePhotoPress = (e: GestureResponderEvent) => {
    if (!photoImgLayout) return;
    const xPct = e.nativeEvent.locationX / photoImgLayout.width;
    const yPct = e.nativeEvent.locationY / photoImgLayout.height;
    setPendingTagPos({ xPct, yPct });
    setPhotoTagSearch('');
    setPhotoTagSuggestions([]);
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
          mediaTypes: type === 'video' ? 'videos' : 'images',
          quality: 0.8,
          videoMaxDuration: 60,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: type === 'video' ? 'videos' : 'images',
          quality: 0.8,
          videoMaxDuration: 60,
          allowsMultipleSelection: type !== 'video',
          selectionLimit: type !== 'video' ? remaining : 1,
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

  const toggleVibe = (v: VibeTag) => {
    setVibeTags((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  };

  const [posting, setPosting] = useState(false);

  // Auto-save draft when leaving composer (unmount)
  useEffect(() => {
    return () => {
      // Save a lightweight draft if there's any content
      if (caption.trim() || mediaItems.length > 0 || destination.trim()) {
        const draft = {
          id: `draft_${Date.now()}`,
          userId: user?.id ?? 'anon',
          username: user?.username ?? 'traveler',
          userAvatar: user?.avatarUri ?? null,
          imageUrl: mediaItems[0]?.uri ?? '',
          mediaItems,
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
          reactions: {},
          userReaction: null,
          reactionsEnabled,
          taggedUsers,
          photoTags,
          syncStatus: 'local',
        } as any;
        saveDraftLocal(draft).catch(() => {});
      }
    };
  }, [caption, mediaItems, destination, selectedTags, selectedMood, delay, privacy, hideExact, blurLocation, hideStay, reactionsEnabled, taggedUsers, photoTags, user]);

  const handlePost = async () => {
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
    if (!user?.id) {
      Alert.alert('Not logged in', 'Please log in to post.');
      return;
    }

    setPosting(true);
    try {
      const postId = `post_${Date.now()}`;

      // Upload media to Firebase Storage
      let uploadedMedia: typeof mediaItems = [];
      if (mediaItems.length > 0) {
        try {
          uploadedMedia = await uploadPostMedia(user.id, postId, mediaItems);
        } catch (err: any) {
          setPosting(false);
          Alert.alert(
            'Photo upload failed',
            err?.message ?? 'Could not upload your photo. Check your connection and try again.',
          );
          return;
        }
      }

      // Determine scheduledAt and visibility
      const delayMap: Record<PostDelay, number> = {
        now: 0, '6h': 6 * 60 * 60, '24h': 24 * 60 * 60, '48h': 48 * 60 * 60,
        'after leaving': 12 * 60 * 60, 'after trip': 72 * 60 * 60,
      };
      const scheduledAt = delay === 'now' ? null : new Date(Date.now() + (delayMap[delay] * 1000)).toISOString();
      const visibilityStatus = delay === 'now' ? 'published' : 'scheduled';

      // Map privacy toggles to unified locationPrivacy
      let locationPrivacy = 'exact';
      if (hideExact) locationPrivacy = 'hidden';
      else if (blurLocation) locationPrivacy = 'approximate';

      const approximateLocation = selectedPlaceFsq?.geocodes?.main ? { lat: selectedPlaceFsq.geocodes.main.latitude, lon: selectedPlaceFsq.geocodes.main.longitude, radiusKm: 5 } : null;

      const postData = {
        id: postId,
        userId: user.id,
        username: user.username,
        userAvatar: user.avatarUri ?? null,
        imageUrl: uploadedMedia[0]?.uri ?? '',
        mediaItems: uploadedMedia,
        caption,
        locationArea: destination,
        destination,
        tags: selectedTags,
        vibeTags,
        mood: selectedMood,
        likes: 0,
        comments: 0,
        delay,
        privacy,
        hideExactLocation: hideExact,
        blurLocation,
        hideStayLocation: hideStay,
        scheduledAt,
        visibilityStatus,
        locationPrivacy,
        approximateLocation,
        createdAt: new Date().toISOString(),
        reactions: {},
        userReaction: null,
        reactionsEnabled,
        taggedUsers,
        photoTags,
      };

      // Use createOrSchedulePostInFirestore to persist scheduling metadata.
      await createOrSchedulePostInFirestore(postData as any);

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
            coverImage: uploadedMedia[0]?.uri ?? '',
            visitedAt: new Date().toISOString(),
          });
        }
      } else if (destination.trim()) {
        markVisited({
          id: `post_dest_${Date.now()}`,
          name: destination.trim(),
          country: '',
          lat: 0,
          lon: 0,
          coverImage: uploadedMedia[0]?.uri ?? '',
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
      setSelectedMood(['wanderlust']);
      setTaggedUsers([]);
      setPhotoTags([]);
      setMentionQuery(null);
      setMentionSuggestions([]);
      setDelay('24h');
      setPrivacy('public');
      setHideExact(true);
      setBlurLocation(false);
      setHideStay(true);
      setReactionsEnabled(true);
      setMediaItems([]);
      setSelectedPlaceFsq(null);
    } catch (e: any) {
      Alert.alert('Post failed', e.message ?? 'Something went wrong. Try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
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

        {/* Photo tag button — only shown when a photo is selected */}
        {mediaItems.some((m) => m.type === 'photo') && (
          <TouchableOpacity style={styles.photoTagBtn} onPress={() => setShowPhotoTagModal(true)}>
            <Text style={styles.photoTagBtnText}>👥 Tag people in photo</Text>
            {photoTags.length > 0 && (
              <Text style={styles.photoTagCount}>{photoTags.length} tagged</Text>
            )}
          </TouchableOpacity>
        )}

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
              placeholder="Tell your travel story... type @ to tag someone"
              placeholderTextColor={theme.colors.textMuted}
              value={caption}
              onChangeText={handleCaptionChange}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
          {/* @mention dropdown */}
          {mentionQuery !== null && (
            <View style={styles.mentionDropdown}>
              {mentionLoading && <ActivityIndicator size="small" color={theme.colors.primary} style={{ padding: 8 }} />}
              {mentionSuggestions.map((u) => (
                <TouchableOpacity key={u.userId} style={styles.mentionItem} onPress={() => insertMention(u)}>
                  {u.avatarUri
                    ? <Image source={{ uri: u.avatarUri }} style={styles.mentionAvatar} />
                    : <View style={[styles.mentionAvatar, { backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: '#fff', fontSize: 12 }}>{u.username[0]?.toUpperCase()}</Text>
                      </View>
                  }
                  <Text style={styles.mentionUsername}>@{u.username}</Text>
                </TouchableOpacity>
              ))}
              {!mentionLoading && mentionSuggestions.length === 0 && mentionQuery.length > 0 && (
                <Text style={styles.mentionEmpty}>No users found</Text>
              )}
            </View>
          )}
          {/* Tagged users chips */}
          {taggedUsers.length > 0 && (
            <View style={styles.taggedChips}>
              {taggedUsers.map((u) => (
                <View key={u.userId} style={styles.taggedChip}>
                  <Text style={styles.taggedChipText}>@{u.username}</Text>
                  <TouchableOpacity onPress={() => setTaggedUsers((prev) => prev.filter((t) => t.userId !== u.userId))}>
                    <Text style={styles.taggedChipRemove}> ✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
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
              const active = selectedMood.includes(mood);
              return (
                <TouchableOpacity key={mood} onPress={() => setSelectedMood((prev) => prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood])}>
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

        {/* Vibe Tags (semantic) */}
        <View style={styles.section}>
          <Text style={styles.label}>Vibe</Text>
          <View style={styles.chipGroup}>
            {VIBE_OPTIONS.map((v) => {
              const active = vibeTags.includes(v);
              return (
                <TouchableOpacity key={v} onPress={() => toggleVibe(v)}>
                  {active ? (
                    <LinearGradient
                      colors={theme.colors.gradientPrimary as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.chip}
                    >
                      <Text style={styles.chipTextActive}>{v}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.chipInactive}>
                      <Text style={styles.chipText}>{v}</Text>
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
        <TouchableOpacity onPress={handlePost} disabled={posting} style={styles.submitBtn}>
          <LinearGradient
            colors={theme.colors.gradientPrimary as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGradient}
          >
            <Text style={styles.submitText}>{posting ? '⏳ Uploading…' : '✈️ Share Your Journey'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: theme.spacing.xxl }} />
      </ScrollView>

      {/* Photo Tag Modal */}
      <Modal visible={showPhotoTagModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <TouchableWithoutFeedback onPress={() => { if (!pendingTagPos) setShowPhotoTagModal(false); }}>
          <View style={styles.photoTagOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.photoTagSheet}>
                <Text style={styles.photoTagTitle}>👥 Tag people in photo</Text>
                <Text style={styles.photoTagHint}>Tap anywhere on the photo to place a tag</Text>

                {/* Photo with existing tag dots */}
                <View
                  ref={photoImgRef}
                  style={styles.photoTagImg}
                  onLayout={(e) => setPhotoImgLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
                >
                  <TouchableOpacity activeOpacity={1} onPress={handlePhotoPress} style={{ flex: 1 }}>
                    <Image source={{ uri: mediaItems.find((m) => m.type === 'photo')?.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    {/* Existing photo tag dots */}
                    {photoTags.map((pt, i) => (
                      <View key={i} style={[styles.photoTagDot, { left: `${pt.xPct * 100}%`, top: `${pt.yPct * 100}%` }]}>
                        <Text style={styles.photoTagDotText}>@{pt.username}</Text>
                      </View>
                    ))}
                    {/* Pending dot */}
                    {pendingTagPos && (
                      <View style={[styles.photoTagDot, styles.photoTagDotPending, { left: `${pendingTagPos.xPct * 100}%`, top: `${pendingTagPos.yPct * 100}%` }]}>
                        <Text style={styles.photoTagDotText}>?</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Search for user after placing dot */}
                {pendingTagPos && (
                  <View style={styles.photoTagSearch}>
                    <TextInput
                      style={styles.photoTagInput}
                      placeholder="Search by username..."
                      placeholderTextColor={theme.colors.textMuted}
                      value={photoTagSearch}
                      onChangeText={setPhotoTagSearch}
                      autoFocus
                    />
                    {photoTagLoading && <ActivityIndicator size="small" color={theme.colors.primary} />}
                    {photoTagSuggestions.map((u) => (
                      <TouchableOpacity key={u.userId} style={styles.mentionItem} onPress={() => confirmPhotoTag(u)}>
                        {u.avatarUri
                          ? <Image source={{ uri: u.avatarUri }} style={styles.mentionAvatar} />
                          : <View style={[styles.mentionAvatar, { backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
                              <Text style={{ color: '#fff', fontSize: 12 }}>{u.username[0]?.toUpperCase()}</Text>
                            </View>
                        }
                        <Text style={styles.mentionUsername}>@{u.username}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => { setPendingTagPos(null); setPhotoTagSearch(''); setPhotoTagSuggestions([]); }}>
                      <Text style={[styles.mentionEmpty, { color: theme.colors.textMuted, paddingTop: 8 }]}>Cancel placement</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.photoTagActions}>
                  <TouchableOpacity style={styles.photoTagDoneBtn} onPress={() => { setShowPhotoTagModal(false); setPendingTagPos(null); }}>
                    <Text style={styles.photoTagDoneTxt}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
  // @mention
  mentionDropdown: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    marginTop: 4,
    maxHeight: 200,
    overflow: 'hidden',
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  mentionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  mentionUsername: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  mentionEmpty: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    padding: 8,
  },
  taggedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  taggedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  taggedChipText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  taggedChipRemove: {
    color: theme.colors.primary,
    fontSize: 13,
  },
  // Photo tag button
  photoTagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  photoTagBtnText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  photoTagCount: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  // Photo tag modal
  photoTagOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  photoTagSheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: theme.spacing.md,
    maxHeight: '90%',
  },
  photoTagTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  photoTagHint: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginBottom: 12,
  },
  photoTagImg: {
    width: '100%',
    height: 220,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    marginBottom: 12,
  },
  photoTagDot: {
    position: 'absolute',
    backgroundColor: 'rgba(139,92,246,0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    transform: [{ translateX: -30 }, { translateY: -12 }],
  },
  photoTagDotPending: {
    backgroundColor: 'rgba(252,92,125,0.9)',
  },
  photoTagDotText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  photoTagSearch: {
    marginBottom: 12,
  },
  photoTagInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: 8,
  },
  photoTagActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  photoTagDoneBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  photoTagDoneTxt: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
