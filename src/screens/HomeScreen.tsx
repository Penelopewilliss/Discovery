import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { theme } from '../theme';
import { listenToFeed, listenToStories, saveStory, uploadStoryMedia, deleteStory, FirestoreStory } from '../services/postsService';
import { getDocs, query, collection, where } from 'firebase/firestore';
import { db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import PostCard from '../components/PostCard';
import { PostCardSkeleton } from '../components/SkeletonLoader';
import { Post, PostDelay } from '../types';
import { useUser, LiveTrip } from '../context/UserContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STORY_DURATION = 5000; // ms per story

const TAGS = ['All', 'beach', 'food', 'hidden gem', 'city', 'nature', 'budget', 'luxury'];

type Mention = { id: string; name: string; handle: string; type: 'user' | 'business' };

type Story = {
  id: string;
  username: string;
  avatar: string | null;
  image: string | null;
  videoUri?: string | null;
  isOwn: boolean;
  isOwnPlaceholder?: boolean; // permanent "+" add-story button, never expires
  createdAt?: number;         // ms timestamp; used for 18 h expiry
  timestamp: string;
  overlayText?: string | null;
  location?: string | null;
  music?: { title: string; artist: string; previewUrl?: string } | null;
  mentions?: Mention[];
};

const MOCK_MUSIC = [
  { title: 'Cruel Summer', artist: 'Taylor Swift', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { title: 'Levitating', artist: 'Dua Lipa', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { title: 'Blinding Lights', artist: 'The Weeknd', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { title: 'Watermelon Sugar', artist: 'Harry Styles', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { title: 'Golden Hour', artist: 'JVKE', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { title: 'Firestone', artist: 'Kygo ft. Conrad', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
  { title: 'Dreams', artist: 'Fleetwood Mac', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
  { title: 'Upside Down', artist: 'Jack Johnson', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { title: 'Sunflower', artist: 'Rex Orange County', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
  { title: 'As It Was', artist: 'Harry Styles', previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
];

const PRESET_LOCATIONS = [
  'Amsterdam', 'Bali', 'Bangkok', 'Barcelona', 'Cape Town',
  'Dubai', 'Istanbul', 'Lisbon', 'Maldives', 'New York',
  'Paris', 'Rome', 'Santorini', 'Sydney', 'Tokyo',
];



const OWN_PLACEHOLDER: Story = { id: 's0', username: 'Your Story', avatar: null, image: null, isOwn: true, isOwnPlaceholder: true, timestamp: '' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatStoryAge(story: Story): string | null {
  if (story.createdAt) {
    const mins = Math.floor((Date.now() - story.createdAt) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }
  return story.timestamp ? `${story.timestamp} ago` : null;
}

// ── Shared video player component ────────────────────────────────────────────

function VideoStoryPlayer({ uri, style }: { uri: string; style: object }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={style} contentFit="cover" nativeControls={false} />;
}

// ── Story Viewer ─────────────────────────────────────────────────────────────

function StoryViewer({
  stories,
  startIndex,
  seenIds,
  onClose,
  onSeen,
  onDelete,
}: {
  stories: Story[];
  startIndex: number;
  seenIds: string[];
  onClose: () => void;
  onSeen: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  // Use a plain object ref — avoids importing the Audio type at module level
  const soundRef = useRef<{ unloadAsync: () => Promise<void> } | null>(null);

  const story = stories[index];

  const goNext = useCallback(() => {
    if (index < stories.length - 1) {
      setIndex((i) => i + 1);
    } else {
      onClose();
    }
  }, [index, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (index > 0) setIndex((i) => i - 1);
  }, [index]);

  // Start/restart progress animation whenever index changes
  useEffect(() => {
    if (story) onSeen(story.id);

    progress.setValue(0);
    if (animRef.current) animRef.current.stop();
    if (timerRef.current) clearTimeout(timerRef.current);

    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) goNext();
    });

    return () => {
      if (animRef.current) animRef.current.stop();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index]);

  // Play music preview whenever the story changes
  useEffect(() => {
    let mounted = true;
    const loadAudio = async () => {
      // Unload any previous sound
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      const url = story?.music?.previewUrl;
      if (!url) return;
      try {
        // Lazy-import so a missing ExponentAV native module never crashes the app
        const { Audio } = await import('expo-av');
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true, volume: 0.7, isLooping: true },
        );
        if (mounted) soundRef.current = sound;
        else await sound.unloadAsync().catch(() => {});
      } catch (_) {
        // expo-av unavailable (e.g. Expo Go without the module) — skip audio silently
      }
    };
    loadAudio();
    return () => {
      mounted = false;
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, [index]);

  // Stop audio when viewer unmounts
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  const handleDelete = () => {
    Alert.alert('Delete Story', 'Remove this story?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          deleteStory(story.id).catch(() => {});
          onDelete?.(story.id);
          if (index < stories.length - 1) {
            setIndex((i) => i + 1);
          } else {
            onClose();
          }
        },
      },
    ]);
  };

  if (!story) return null;

  return (
    <View style={sv.container}>
      {/* Background image / video */}
      {story.videoUri ? (
        <VideoStoryPlayer uri={story.videoUri} style={sv.bg} />
      ) : story.image ? (
        <Image source={{ uri: story.image }} style={sv.bg} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.accent]}
          style={sv.bg}
        />
      )}
      <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.3)']} style={sv.overlay} />

      {/* Progress bars */}
      <View style={[sv.progressRow, { top: insets.top + 8 }]}>
        {stories.map((s, i) => (
          <View key={s.id} style={sv.progressTrack}>
            <Animated.View
              style={[
                sv.progressFill,
                {
                  width: i < index
                    ? '100%'
                    : i === index
                    ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                    : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={[sv.header, { top: insets.top + 24 }]}>
        <View style={sv.headerLeft}>
          {story.avatar ? (
            <Image source={{ uri: story.avatar }} style={sv.headerAvatar} />
          ) : (
            <LinearGradient colors={[theme.colors.primary, theme.colors.accent]} style={sv.headerAvatar} />
          )}
          <View>
            <Text style={sv.headerUsername}>@{story.username}</Text>
            {!!formatStoryAge(story) && <Text style={sv.headerTime}>{formatStoryAge(story)}</Text>}
          </View>
        </View>
        <View style={sv.headerRight}>
          {story.isOwn && !story.isOwnPlaceholder && (
            <TouchableOpacity onPress={handleDelete} style={sv.deleteBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={sv.deleteTxt}>🗑️</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={sv.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={sv.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tap areas */}
      <View style={sv.tapRow}>
        <TouchableWithoutFeedback onPress={goPrev}>
          <View style={sv.tapLeft} />
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback onPress={goNext}>
          <View style={sv.tapRight} />
        </TouchableWithoutFeedback>
      </View>

      {/* Own story empty state */}
      {story.isOwn && !story.image && !story.videoUri && (
        <View style={sv.ownEmpty}>
          <Text style={sv.ownEmptyIcon}>📸</Text>
          <Text style={sv.ownEmptyText}>Your story will appear here</Text>
        </View>
      )}

      {/* Text overlay */}
      {!!story.overlayText && (
        <View style={sv.overlayTextWrap}>
          <Text style={sv.overlayTextView}>{story.overlayText}</Text>
        </View>
      )}

      {/* Location + music + mentions stickers at bottom */}
      <View style={[sv.stickersBottom, { bottom: insets.bottom + 28 }]}>
        {!!story.music && (
          <View style={sv.musicBar}>
            <Text style={sv.musicNote}>🎵</Text>
            <Text style={sv.musicText} numberOfLines={1}>
              {story.music.artist} · {story.music.title}
            </Text>
          </View>
        )}
        {!!story.location && (
          <View style={sv.locationPill}>
            <Text style={sv.locationPillText}>📍 {story.location}</Text>
          </View>
        )}
        {story.mentions && story.mentions.length > 0 && (
          <View style={sv.mentionsRow}>
            {story.mentions.map((m) => (
              <View key={m.id} style={sv.mentionPill}>
                <Text style={sv.mentionPillText}>
                  {m.type === 'business' ? '🏢' : '👤'} @{m.handle}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const sv = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bg: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject },
  progressRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  header: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff' },
  headerUsername: { color: '#fff', fontSize: 14, fontWeight: '700' },
  headerTime: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  closeBtn: { padding: 4 },
  closeTxt: { color: '#fff', fontSize: 20, fontWeight: '300' },
  deleteBtn: { padding: 4 },
  deleteTxt: { fontSize: 20 },
  tapRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 5 },
  tapLeft: { flex: 3 },
  tapRight: { flex: 7 },
  ownEmpty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ownEmptyIcon: { fontSize: 56, marginBottom: 12 },
  ownEmptyText: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },
  // Text overlay
  overlayTextWrap: {
    position: 'absolute', top: '40%', left: 20, right: 20, zIndex: 8, alignItems: 'center',
  },
  overlayTextView: {
    backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff',
    fontSize: 22, fontWeight: '700', textAlign: 'center',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12,
  },
  // Stickers at bottom
  stickersBottom: {
    position: 'absolute', left: 16, right: 16, zIndex: 8, gap: 8,
  },
  musicBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  musicNote: { fontSize: 16 },
  musicText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  locationPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  locationPillText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  // Mention pills in viewer
  mentionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mentionPill: {
    backgroundColor: 'rgba(124,92,252,0.75)', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16,
  },
  mentionPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

// ── Story Editor ─────────────────────────────────────────────────────────────

type StoryOverlay = {
  text: string | null;
  location: string | null;
  music: { title: string; artist: string; previewUrl?: string } | null;
  mentions: Mention[];
  delay: PostDelay;
};

const STORY_DELAY_OPTIONS: { label: string; value: PostDelay }[] = [
  { label: '⚡ Now',  value: 'now' },
  { label: '6h later', value: '6h' },
  { label: '24h later', value: '24h' },
  { label: '48h later', value: '48h' },
];

// Format a Nominatim display_name into readable parts
function formatPlace(displayName: string): { primary: string; secondary: string } {
  const parts = displayName.split(',').map((s) => s.trim());
  return { primary: parts[0], secondary: parts.slice(1, 3).join(', ') };
}

function StoryEditor({
  imageUri,
  mediaType,
  suggestedAccounts,
  onDone,
  onCancel,
}: {
  imageUri: string;
  mediaType: 'photo' | 'video';
  suggestedAccounts: Mention[];
  onDone: (overlay: StoryOverlay) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [overlayText, setOverlayText] = useState('');
  const [textActive, setTextActive] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [music, setMusic] = useState<{ title: string; artist: string } | null>(null);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [showLocation, setShowLocation] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [showTagging, setShowTagging] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [locationResults, setLocationResults] = useState<string[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedDelay, setSelectedDelay] = useState<PostDelay>('now');

  // Live place search — OpenStreetMap Nominatim (free, no API key)
  useEffect(() => {
    const q = locationQuery.trim();
    if (q.length < 2) { setLocationResults([]); setLocationLoading(false); return; }
    setLocationLoading(true);
    const timer = setTimeout(async () => {
      try {
        const url =
          `https://nominatim.openstreetmap.org/search` +
          `?q=${encodeURIComponent(q)}&format=json&limit=8&addressdetails=0`;
        const res = await fetch(url, {
          headers: { 'Accept-Language': 'en', 'User-Agent': 'DiscoveryTravelApp/1.0' },
        });
        const data: Array<{ display_name: string }> = await res.json();
        setLocationResults(data.map((d) => d.display_name));
      } catch {
        setLocationResults([]);
      } finally {
        setLocationLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [locationQuery]);

  const filteredAccounts = tagQuery.trim()
    ? suggestedAccounts.filter(
        (a) =>
          a.name.toLowerCase().includes(tagQuery.toLowerCase()) ||
          a.handle.toLowerCase().includes(tagQuery.toLowerCase())
      )
    : suggestedAccounts;

  const toggleMention = (account: Mention) =>
    setMentions((prev) =>
      prev.some((m) => m.id === account.id)
        ? prev.filter((m) => m.id !== account.id)
        : [...prev, account]
    );

  const handleShare = () =>
    onDone({ text: overlayText.trim() || null, location, music, mentions, delay: selectedDelay });

  return (
    <View style={se.container}>
      {mediaType === 'video' ? (
        <VideoStoryPlayer uri={imageUri} style={se.bg} />
      ) : (
        <Image source={{ uri: imageUri }} style={se.bg} resizeMode="cover" />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.25)']}
        style={se.overlay}
      />

      {/* Top toolbar */}
      <View style={[se.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={onCancel} style={se.toolBtn}>
          <Text style={se.toolTxt}>✕</Text>
        </TouchableOpacity>
        <View style={se.tools}>
          <TouchableOpacity
            onPress={() => setTextActive(true)}
            style={[se.toolBtn, !!overlayText && se.toolBtnActive]}
          >
            <Text style={se.toolTxt}>Aa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowLocation(true)}
            style={[se.toolBtn, !!location && se.toolBtnActive]}
          >
            <Text style={se.toolTxt}>📍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowTagging(true)}
            style={[se.toolBtn, mentions.length > 0 && se.toolBtnActive]}
          >
            <Text style={se.toolTxt}>👤</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowMusic(true)}
            style={[se.toolBtn, !!music && se.toolBtnActive]}
          >
            <Text style={se.toolTxt}>🎵</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Text overlay preview (tap to edit) */}
      {!textActive && !!overlayText && (
        <TouchableOpacity style={se.overlayTextWrap} onPress={() => setTextActive(true)}>
          <Text style={se.overlayTextPreview}>{overlayText}</Text>
        </TouchableOpacity>
      )}

      {/* Text input overlay */}
      {textActive && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={se.textInputLayer}
        >
          <TouchableWithoutFeedback onPress={() => setTextActive(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={se.textInputBox}>
            <TextInput
              style={se.textInput}
              value={overlayText}
              onChangeText={setOverlayText}
              placeholder="Type something..."
              placeholderTextColor="rgba(255,255,255,0.45)"
              multiline
              autoFocus
            />
            <TouchableOpacity style={se.textDoneBtn} onPress={() => setTextActive(false)}>
              <Text style={se.textDoneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Stickers preview at bottom */}
      <View style={[se.stickerBar, { bottom: insets.bottom + 148 }]}>
        {!!music && (
          <View style={se.musicSticker}>
            <Text style={se.musicStickerTxt}>🎵 {music.artist} · {music.title}</Text>
            <TouchableOpacity onPress={() => setMusic(null)}>
              <Text style={se.stickerRemove}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        {!!location && (
          <View style={se.locationSticker}>
            <Text style={se.locationStickerTxt}>📍 {location}</Text>
            <TouchableOpacity onPress={() => setLocation(null)}>
              <Text style={se.stickerRemove}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        {mentions.length > 0 && (
          <View style={se.mentionsRow}>
            {mentions.map((m) => (
              <TouchableOpacity key={m.id} style={se.mentionPill} onPress={() => toggleMention(m)}>
                <Text style={se.mentionPillTxt}>
                  {m.type === 'business' ? '🏢' : '👤'} @{m.handle}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Delay selector + Share button */}
      <View style={[se.shareWrap, { bottom: insets.bottom + 16 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={se.delayRow}
        >
          {STORY_DELAY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[se.delayPill, selectedDelay === opt.value && se.delayPillActive]}
              onPress={() => setSelectedDelay(opt.value)}
            >
              <Text style={[se.delayPillTxt, selectedDelay === opt.value && se.delayPillTxtActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity onPress={handleShare} activeOpacity={0.85} style={{ marginTop: 10 }}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={se.shareBtn}
          >
            <Text style={se.shareBtnTxt}>
              {selectedDelay === 'now' ? 'Share to Story ✨' : `Schedule Story · ${selectedDelay}`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Location picker sheet — powered by OpenStreetMap Nominatim */}
      {showLocation && (
        <View style={se.sheet}>
          <View style={se.sheetHandle} />
          <Text style={se.sheetTitle}>Add Location</Text>
          <TextInput
            style={se.sheetSearch}
            placeholder="City, town, park, mountain, restaurant…"
            placeholderTextColor={theme.colors.textMuted}
            value={locationQuery}
            onChangeText={setLocationQuery}
            returnKeyType="done"
            autoFocus
            onSubmitEditing={() => {
              const val = locationQuery.trim();
              if (val) { setLocation(val); setShowLocation(false); setLocationQuery(''); }
            }}
          />
          <ScrollView keyboardShouldPersistTaps="handled">
            {/* Always offer "use exactly what I typed" */}
            {locationQuery.trim().length > 0 && (
              <TouchableOpacity
                style={se.customLocationRow}
                onPress={() => { setLocation(locationQuery.trim()); setShowLocation(false); setLocationQuery(''); }}
              >
                <Text style={se.customLocationTxt}>📍 Use "{locationQuery.trim()}"</Text>
                <Text style={se.customLocationHint}>Custom location</Text>
              </TouchableOpacity>
            )}

            {/* Nominatim live results */}
            {locationLoading && (
              <View style={se.loadingRow}>
                <ActivityIndicator color={theme.colors.primary} size="small" />
                <Text style={se.loadingTxt}>Searching real places…</Text>
              </View>
            )}
            {!locationLoading && locationResults.map((displayName, idx) => {
              const { primary, secondary } = formatPlace(displayName);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[se.sheetItem, location === primary && se.sheetItemActive]}
                  onPress={() => { setLocation(primary); setShowLocation(false); setLocationQuery(''); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[se.sheetItemTxt, location === primary && se.sheetItemTxtActive]}>
                      📍 {primary}
                    </Text>
                    {!!secondary && <Text style={se.sheetItemSub}>{secondary}</Text>}
                  </View>
                  {location === primary && <Text style={se.sheetItemCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}

            {/* Popular destinations shown when no query */}
            {locationQuery.trim().length === 0 && (
              <>
                <Text style={se.sheetSubheading}>Popular destinations</Text>
                {PRESET_LOCATIONS.map((loc) => (
                  <TouchableOpacity
                    key={loc}
                    style={[se.sheetItem, location === loc && se.sheetItemActive]}
                    onPress={() => { setLocation(loc); setShowLocation(false); }}
                  >
                    <Text style={[se.sheetItemTxt, location === loc && se.sheetItemTxtActive]}>
                      📍 {loc}
                    </Text>
                    {location === loc && <Text style={se.sheetItemCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
          <TouchableOpacity
            style={se.sheetClose}
            onPress={() => { setShowLocation(false); setLocationQuery(''); }}
          >
            <Text style={se.sheetCloseTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tag people & businesses sheet */}
      {showTagging && (
        <View style={se.sheet}>
          <View style={se.sheetHandle} />
          <Text style={se.sheetTitle}>Tag People & Places</Text>
          <TextInput
            style={se.sheetSearch}
            placeholder="Search accounts…"
            placeholderTextColor={theme.colors.textMuted}
            value={tagQuery}
            onChangeText={setTagQuery}
            autoFocus
          />
          <ScrollView keyboardShouldPersistTaps="handled">
            {filteredAccounts.map((account) => {
              const selected = mentions.some((m) => m.id === account.id);
              return (
                <TouchableOpacity
                  key={account.id}
                  style={[se.tagAccountRow, selected && se.sheetItemActive]}
                  onPress={() => toggleMention(account)}
                >
                  <View style={se.tagAccountIcon}>
                    <Text style={{ fontSize: 20 }}>
                      {account.type === 'business' ? '🏢' : '👤'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={se.tagAccountName}>{account.name}</Text>
                    <Text style={se.tagAccountHandle}>
                      @{account.handle} · {account.type === 'business' ? 'Business' : 'Traveller'}
                    </Text>
                  </View>
                  {selected && <Text style={se.sheetItemCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={se.sheetClose}
            onPress={() => { setShowTagging(false); setTagQuery(''); }}
          >
            <Text style={se.sheetCloseTxt}>
              {mentions.length > 0 ? `Done (${mentions.length} tagged)` : 'Cancel'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Music picker sheet */}
      {showMusic && (
        <View style={se.sheet}>
          <View style={se.sheetHandle} />
          <Text style={se.sheetTitle}>Choose Music 🎵</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            {MOCK_MUSIC.map((track) => (
              <TouchableOpacity
                key={`${track.artist}-${track.title}`}
                style={[se.musicItem, music?.title === track.title && se.sheetItemActive]}
                onPress={() => { setMusic(track); setShowMusic(false); }}
              >
                <View style={se.musicItemIcon}>
                  <Text style={{ fontSize: 20 }}>🎵</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={se.musicItemTitle}>{track.title}</Text>
                  <Text style={se.musicItemArtist}>{track.artist}</Text>
                </View>
                {music?.title === track.title && (
                  <Text style={se.sheetItemCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={se.sheetClose} onPress={() => setShowMusic(false)}>
            <Text style={se.sheetCloseTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Stories Bar ──────────────────────────────────────────────────────────────

function StoriesBar({
  stories,
  seenIds,
  onPress,
  activeLiveTrip,
}: {
  stories: Story[];
  seenIds: string[];
  onPress: (index: number) => void;
  activeLiveTrip: LiveTrip | null;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.storiesList}
    >
      {/* Live trip bubble — pinned first when trip is active */}
      {activeLiveTrip && (
        <TouchableOpacity
          style={styles.storyItem}
          activeOpacity={0.8}
          onPress={() =>
            Alert.alert(
              `🔴 LIVE · ${activeLiveTrip.name}`,
              `${activeLiveTrip.pins.length} stop${activeLiveTrip.pins.length !== 1 ? 's' : ''} dropped so far.\n` +
                (activeLiveTrip.pins.length > 0
                  ? activeLiveTrip.pins.map((p) => `📍 ${p.placeName}`).join('\n')
                  : 'No stops yet — go to Explore to drop your first pin!'),
            )
          }
        >
          <LinearGradient
            colors={['#ef4444', '#dc2626']}
            style={[styles.storyRing, { borderWidth: 0 }]}
          >
            <View style={[styles.storyAvatarWrap, { backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 20 }}>📍</Text>
            </View>
          </LinearGradient>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.livePillBadge}>
              <Text style={styles.livePillText}>LIVE</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
      {/* Regular stories */}
      {stories.map((item, index) => {
        const seen = seenIds.includes(item.id);
        const hasOwnMedia = item.isOwn && !!(item.image || item.videoUri);
        return (
          <TouchableOpacity
            key={item.id}
            style={styles.storyItem}
            onPress={() => onPress(index)}
            activeOpacity={0.8}
          >
            {item.isOwn ? (
              hasOwnMedia ? (
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.accent]}
                  style={styles.storyRing}
                >
                  <View style={styles.storyAvatarWrap}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.storyAvatar} />
                    ) : (
                      <View style={[styles.storyAvatarWrap, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 22 }}>🎥</Text>
                      </View>
                    )}
                  </View>
                </LinearGradient>
              ) : (
                <LinearGradient
                  colors={[theme.colors.surface, theme.colors.surfaceElevated ?? theme.colors.surface]}
                  style={[styles.storyRing, styles.ownStoryRing]}
                >
                  <View style={styles.storyAvatarWrap}>
                    <Text style={styles.addStoryPlus}>+</Text>
                  </View>
                </LinearGradient>
              )
            ) : (
              <LinearGradient
                colors={seen ? ['#444', '#333'] : [theme.colors.primary, theme.colors.accent]}
                style={styles.storyRing}
              >
                <View style={styles.storyAvatarWrap}>
                  <Image source={{ uri: item.avatar! }} style={styles.storyAvatar} />
                </View>
              </LinearGradient>
            )}
            <Text style={[styles.storyName, seen && !item.isOwn && styles.storyNameSeen]} numberOfLines={1}>
              {item.isOwnPlaceholder
                ? 'Your Story'
                : item.isOwn
                ? formatStoryAge(item) ?? 'Your Story'
                : item.username}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { tripStories, activeLiveTrip, user } = useUser();
  const seenTripStoryIds = useRef(new Set<string>());
  const [stories, setStories] = useState<Story[]>([OWN_PLACEHOLDER]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [editorUri, setEditorUri] = useState<string | null>(null);
  const [editorMediaType, setEditorMediaType] = useState<'photo' | 'video'>('photo');
  const [activeTag, setActiveTag] = useState('All');
  const [tick, setTick] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [suggestedAccounts, setSuggestedAccounts] = useState<Mention[]>([]);
  const storyCounterRef = useRef(0);

  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  const markSeen = useCallback((id: string) => {
    setSeenIds((prev) => [...new Set([...prev, id])]);
  }, []);

  // Firestore real-time feed
  useEffect(() => {
    if (!user?.id) { setIsLoading(false); return; }
    const unsub = listenToFeed(user.id, (posts) => {
      setFeedPosts(posts);
      setIsLoading(false);
    });
    return unsub;
  }, [user?.id]);

  // Firestore real-time stories (followed users + self)
  useEffect(() => {
    if (!user?.id) return;
    const unsub = listenToStories(user.id, (fsStories: FirestoreStory[]) => {
      setStories((prev) => {
        const placeholder = prev.find((s) => s.isOwnPlaceholder) ?? OWN_PLACEHOLDER;
        // Once the user's story exists in Firestore, drop the local own_* copy to avoid duplicates.
        // Keep local own_* stories only while the upload/save is still in flight.
        const hasRemoteOwn = fsStories.some((s) => s.userId === user.id);
        const localOwn = hasRemoteOwn
          ? []
          : prev.filter((s) => !s.isOwnPlaceholder && s.isOwn && s.id.startsWith('own_'));
        // Deduplicate: one bubble per user (most recent story wins; list is already sorted desc)
        const seen = new Set<string>();
        const uniqueStories = fsStories.filter((s) => {
          if (seen.has(s.userId)) return false;
          seen.add(s.userId);
          return true;
        });
        const remote: Story[] = uniqueStories.map((s) => ({
          id: s.id,
          username: s.username,
          avatar: s.userAvatar,
          image: s.image,
          videoUri: s.videoUri,
          isOwn: s.userId === user.id,
          isOwnPlaceholder: false,
          createdAt: s.createdAt,
          timestamp: '',
          overlayText: s.overlayText,
          location: s.location,
          music: s.music,
          mentions: s.mentions as Mention[],
        }));
        return [placeholder, ...localOwn, ...remote];
      });
    });
    return unsub;
  }, [user?.id]);

  // Load followed users for mention suggestions in StoryEditor
  useEffect(() => {
    if (!user?.id) return;
    getDocs(query(collection(db, 'follows'), where('followerId', '==', user.id)))
      .then(async (snap) => {
        const ids = snap.docs.map((d) => d.data().followeeId as string);
        if (ids.length === 0) return;
        const usersSnap = await getDocs(query(collection(db, 'users'), where('__name__', 'in', ids.slice(0, 30))));
        const accounts: Mention[] = usersSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name ?? d.data().username ?? '',
          handle: d.data().username ?? '',
          type: 'user' as const,
        }));
        setSuggestedAccounts(accounts);
      })
      .catch(() => {});
  }, [user?.id]);

  // Inject new trip stories shared from the Trips tab into the stories row
  useEffect(() => {
    const fresh = tripStories.filter((s) => !seenTripStoryIds.current.has(s.id));
    if (fresh.length === 0) return;
    fresh.forEach((s) => seenTripStoryIds.current.add(s.id));
    setStories((prev) => [
      prev[0], // keep the "Your Story" + bubble
      ...fresh.map((s) => ({
        id: s.id,
        username: s.username,
        avatar: s.avatar,
        image: s.bgImage,
        isOwn: true,
        timestamp: 'now',
        createdAt: s.createdAt,
        overlayText: `✈️ ${s.tripName}\n${s.stops.slice(0, 3).join(' → ')}${s.stops.length > 3 ? ' +more' : ''}`,
        location: s.stops[0] ?? null,
      })),
      ...prev.slice(1),
    ]);
  }, [tripStories]);

  // Remove stories older than 18 hours (check every minute)
  useEffect(() => {
    const EXPIRY_MS = 18 * 60 * 60 * 1000;
    const check = () => {
      const now = Date.now();
      setStories((prev) =>
        prev.filter((s) => s.isOwnPlaceholder || !s.createdAt || now - s.createdAt < EXPIRY_MS)
      );
    };
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  const pickStoryMedia = async (type: 'photo' | 'video') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow media access to add a story.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(
      type === 'video'
        ? { mediaTypes: 'videos', quality: 0.85, videoMaxDuration: 30 }
        : { mediaTypes: 'images', allowsEditing: true, aspect: [9, 16] as [number, number], quality: 0.85 }
    );
    if (!result.canceled && result.assets[0]) {
      setEditorMediaType(type);
      setEditorUri(result.assets[0].uri);
    }
  };

  const handleStoryPress = (index: number) => {
    const story = stories[index];

    // Permanent "+" button → offer Photo or Video
    if (story.isOwnPlaceholder) {
      Alert.alert('Add to Story', 'What would you like to share?', [
        { text: 'Photo', onPress: () => pickStoryMedia('photo') },
        { text: 'Video', onPress: () => pickStoryMedia('video') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    // Open viewer – pass only viewable stories (no placeholder)
    const viewable = stories.filter((s) => !s.isOwnPlaceholder);
    const viewableIdx = viewable.findIndex((s) => s.id === story.id);
    setViewerIndex(viewableIdx >= 0 ? viewableIdx : 0);
  };

  const handleEditorDone = (overlay: StoryOverlay) => {
    if (!editorUri || !user?.id) return;

    const DELAY_MS: Record<PostDelay, number> = {
      now: 0,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '48h': 48 * 60 * 60 * 1000,
      'after leaving': 0,
      'after trip': 0,
    };

    const delayMs = DELAY_MS[overlay.delay] ?? 0;
    const localUri = editorUri;
    const localMediaType = editorMediaType;

    storyCounterRef.current += 1;
    const localId = `own_${storyCounterRef.current}`;
    const newStory: Story = {
      id: localId,
      username: user.username ?? 'me',
      avatar: user.avatar ?? null,
      image: localMediaType === 'photo' ? localUri : null,
      videoUri: localMediaType === 'video' ? localUri : null,
      isOwn: true,
      isOwnPlaceholder: false,
      createdAt: Date.now() + delayMs,
      timestamp: '',
      overlayText: overlay.text,
      location: overlay.location,
      music: overlay.music,
      mentions: overlay.mentions,
    };

    const publish = () => {
      setStories((prev) => {
        const placeholderIdx = prev.findIndex((s) => s.isOwnPlaceholder);
        const next = [...prev];
        next.splice(placeholderIdx + 1, 0, newStory);
        return next;
      });
      setViewerIndex(0);

      // Upload media + persist to Firestore in background
      uploadStoryMedia(user!.id, localUri, localMediaType)
        .then((remoteUrl) =>
          saveStory({
            userId: user!.id,
            username: user!.username ?? 'me',
            userAvatar: user!.avatar ?? null,
            image: localMediaType === 'photo' ? remoteUrl : null,
            videoUri: localMediaType === 'video' ? remoteUrl : null,
            overlayText: overlay.text,
            location: overlay.location,
            music: overlay.music,
            mentions: overlay.mentions,
          })
        )
        .catch(() => {}); // Fail silently — local story already visible
    };

    setEditorUri(null);

    if (delayMs === 0) {
      publish();
    } else {
      const label = overlay.delay === '6h' ? '6 hours' : overlay.delay === '24h' ? '24 hours' : '48 hours';
      Alert.alert(
        'Story scheduled 🕐',
        `Your story will go live in ${label}.`,
        [{ text: 'Got it' }]
      );
      setTimeout(publish, delayMs);
    }
  };

  const filtered: Post[] =
    activeTag === 'All'
      ? feedPosts
      : feedPosts.filter((p) => p.tags.includes(activeTag as any));

  // Stories passed to the viewer never include the permanent placeholder
  const viewableStories = stories.filter((s) => !s.isOwnPlaceholder);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlatList
        data={isLoading ? [] : filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
            <PostCard
              post={item}
              onUpdate={forceUpdate}
              onDelete={() => setFeedPosts((prev) => prev.filter((p) => p.id !== item.id))}
              onArchive={() => setFeedPosts((prev) => prev.filter((p) => p.id !== item.id))}
            />
          )}
        contentContainerStyle={styles.feed}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <StoriesBar stories={stories} seenIds={seenIds} onPress={handleStoryPress} activeLiveTrip={activeLiveTrip} />
            <FlatList
              horizontal
              data={TAGS}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagsList}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => setActiveTag(item)}>
                  {item === activeTag ? (
                    <LinearGradient
                      colors={theme.colors.gradientPrimary as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.tagActive}
                    >
                      <Text style={styles.tagTextActive}>{item}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.tagInactive}>
                      <Text style={styles.tagTextInactive}>{item}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <>
              <PostCardSkeleton />
              <PostCardSkeleton />
              <PostCardSkeleton />
            </>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🏖️</Text>
              <Text style={styles.emptyTitle}>No posts here yet</Text>
              <Text style={styles.emptyText}>Be the first to share your adventure!</Text>
            </View>
          )
        }
      />

      {/* Story Viewer Modal */}
      <Modal
        visible={viewerIndex !== null}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerIndex(null)}
      >
        {viewerIndex !== null && (
          <StoryViewer
            stories={viewableStories}
            startIndex={viewerIndex}
            seenIds={seenIds}
            onClose={() => setViewerIndex(null)}
            onSeen={markSeen}
            onDelete={(storyId) =>
              setStories((prev) => prev.filter((s) => s.id !== storyId))
            }
          />
        )}
      </Modal>

      {/* Story Editor Modal */}
      <Modal
        visible={editorUri !== null}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setEditorUri(null)}
      >
        {editorUri !== null && (
          <StoryEditor
            imageUri={editorUri}
            mediaType={editorMediaType}
            suggestedAccounts={suggestedAccounts}
            onDone={handleEditorDone}
            onCancel={() => setEditorUri(null)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  storiesList: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    gap: theme.spacing.md,
  },
  storyItem: { alignItems: 'center', width: 52 },
  storyRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  ownStoryRing: { borderWidth: 2, borderColor: theme.colors.border },
  storyAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  storyAvatar: { width: 42, height: 42, borderRadius: 21 },
  addStoryPlus: { fontSize: 20, color: theme.colors.textMuted, fontWeight: '300' },
  storyName: {
    color: theme.colors.text,
    fontSize: 9,
    marginTop: 4,
    textAlign: 'center',
    width: 52,
  },
  storyNameSeen: { color: theme.colors.textMuted },
  // Live trip LIVE badge under the bubble
  livePillBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 3,
  },
  livePillText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  tagsList: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  tagActive: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  tagInactive: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tagTextActive: {
    color: '#fff',
    ...theme.typography.caption,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  tagTextInactive: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    textTransform: 'capitalize',
  },
  feed: {
    paddingTop: 4,
    paddingBottom: 100,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: {
    color: theme.colors.textMuted,
    ...theme.typography.body,
    textAlign: 'center',
  },
});

// ── Story Editor Styles ───────────────────────────────────────────────────────
const se = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bg: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject },
  topBar: {
    position: 'absolute', left: 12, right: 12, zIndex: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  tools: { flexDirection: 'row', gap: 8 },
  toolBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  toolBtnActive: { backgroundColor: theme.colors.primary },
  toolTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  // Text overlay
  overlayTextWrap: {
    position: 'absolute', top: '40%', left: 24, right: 24, zIndex: 8, alignItems: 'center',
  },
  overlayTextPreview: {
    backgroundColor: 'rgba(0,0,0,0.52)', color: '#fff',
    fontSize: 22, fontWeight: '700', textAlign: 'center',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12,
  },
  textInputLayer: {
    ...StyleSheet.absoluteFillObject, zIndex: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  textInputBox: { alignItems: 'center' },
  textInput: {
    backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff',
    fontSize: 22, fontWeight: '700', textAlign: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, minWidth: 200, maxWidth: SCREEN_W - 48,
  },
  textDoneBtn: {
    marginTop: 14, backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20,
  },
  textDoneTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Stickers bar
  stickerBar: { position: 'absolute', left: 16, right: 16, zIndex: 10, gap: 8 },
  musicSticker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  musicStickerTxt: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  locationSticker: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  locationStickerTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  stickerRemove: { color: 'rgba(255,255,255,0.65)', fontSize: 14, marginLeft: 10 },
  // Share button
  shareWrap: { position: 'absolute', left: 20, right: 20, zIndex: 10 },
  shareBtn: { borderRadius: theme.borderRadius.full, paddingVertical: 16, alignItems: 'center' },
  shareBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  // Delay selector
  delayRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  delayPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  delayPillActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: '#fff',
  },
  delayPillTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  delayPillTxtActive: { color: '#fff', fontWeight: '800' },
  // Bottom sheet
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30,
    backgroundColor: theme.colors.surfaceElevated ?? '#18182A',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: theme.spacing.lg, maxHeight: SCREEN_H * 0.65,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14,
  },
  sheetTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  sheetSearch: {
    backgroundColor: theme.colors.surface, color: theme.colors.text,
    borderRadius: theme.borderRadius.md, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border, fontSize: 15,
  },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  sheetItemActive: { backgroundColor: 'rgba(124,92,252,0.08)' },
  sheetItemTxt: { color: theme.colors.text, fontSize: 15 },
  sheetItemTxtActive: { color: theme.colors.primary, fontWeight: '700' },
  sheetItemCheck: { color: theme.colors.primary, fontSize: 18, fontWeight: '700' },
  musicItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  musicItemIcon: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  musicItemTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  musicItemArtist: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  sheetClose: {
    marginTop: 14, alignItems: 'center', paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  sheetCloseTxt: { color: theme.colors.textMuted, fontSize: 15 },
  customLocationRow: {
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    borderLeftWidth: 3, borderLeftColor: theme.colors.primary,
    paddingLeft: 12, marginBottom: 4,
    backgroundColor: 'rgba(124,92,252,0.07)',
  },
  customLocationTxt: { color: theme.colors.primary, fontSize: 15, fontWeight: '700' },
  customLocationHint: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  // Nominatim result sub-text
  sheetItemSub: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  sheetSubheading: {
    color: theme.colors.textMuted, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    paddingVertical: 10, paddingHorizontal: 4,
  },
  // Loading row
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 4 },
  loadingTxt: { color: theme.colors.textMuted, fontSize: 14 },
  // Mention editor stickers
  mentionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mentionPill: {
    backgroundColor: 'rgba(124,92,252,0.75)', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16,
  },
  mentionPillTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  // Tag account rows
  tagAccountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  tagAccountIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  tagAccountName: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  tagAccountHandle: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
});

