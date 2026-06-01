import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { theme } from '../theme';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { createPostInFirestore, saveStory, uploadPostMedia, uploadStoryMedia } from '../services/postsService';
import { MediaItem, Post } from '../types';

type GemHunt = {
  id: string;
  title: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  xp: number;
  time: string;
  vibe: string;
  prompt: string;
  proof: string;
  color: [string, string, string];
};

const HUNTS: GemHunt[] = [
  {
    id: 'quiet-view',
    title: 'Find the quietest view nearby',
    category: 'hidden gem',
    difficulty: 'easy',
    xp: 60,
    time: '20 min',
    vibe: 'solo reset',
    prompt: 'Find a view where you can hear the place instead of the crowd.',
    proof: 'Share the view and one sentence about the feeling.',
    color: ['#0f172a', '#0369a1', '#22c55e'],
  },
  {
    id: 'local-snack',
    title: 'Eat the local snack under 5',
    category: 'food',
    difficulty: 'easy',
    xp: 45,
    time: '15 min',
    vibe: 'cheap bite',
    prompt: 'Find a snack, pastry, fruit, or street bite that feels specific to where you are.',
    proof: 'Share the snack name or a photo before it disappears.',
    color: ['#431407', '#ea580c', '#facc15'],
  },
  {
    id: 'no-map-walk',
    title: 'Walk 10 minutes without Maps',
    category: 'adventure',
    difficulty: 'medium',
    xp: 85,
    time: '10 min',
    vibe: 'wander mode',
    prompt: 'Pick a direction, put Maps away, and notice what pulls you in.',
    proof: 'Share the best thing you found by accident.',
    color: ['#1e1b4b', '#7c3aed', '#ec4899'],
  },
  {
    id: 'local-sunday',
    title: 'Ask where locals go on Sunday',
    category: 'culture',
    difficulty: 'medium',
    xp: 100,
    time: '30 min',
    vibe: 'social',
    prompt: 'Ask a local where they go when they want a good slow day.',
    proof: 'Share the recommendation without exposing anyone private.',
    color: ['#052e16', '#16a34a', '#38bdf8'],
  },
  {
    id: 'under-500',
    title: 'Visit a place with under 500 reviews',
    category: 'hidden gem',
    difficulty: 'hard',
    xp: 130,
    time: '45 min',
    vibe: 'discovery',
    prompt: 'Find a place that has not been flattened by the internet yet.',
    proof: 'Share what made it worth finding.',
    color: ['#111827', '#0f766e', '#f59e0b'],
  },
  {
    id: 'street-soundtrack',
    title: 'Find the best street sound',
    category: 'nightlife',
    difficulty: 'easy',
    xp: 55,
    time: '20 min',
    vibe: 'city pulse',
    prompt: 'Find music, bells, waves, a market call, or any sound that belongs to the place.',
    proof: 'Share where you heard it and why it stuck.',
    color: ['#312e81', '#2563eb', '#06b6d4'],
  },
];

const FILTERS = ['All', 'Open', 'Completed'] as const;

export default function GemHuntsScreen() {
  const { user } = useUser();
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('All');
  const [activeHuntId, setActiveHuntId] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [selectedHunt, setSelectedHunt] = useState<GemHunt | null>(null);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState('');
  const [shareToFeed, setShareToFeed] = useState(true);
  const [shareToStory, setShareToStory] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    getDocs(collection(db, 'users', user.id, 'gemHuntCompletions'))
      .then((snap) => setCompletedIds(snap.docs.map((d) => d.id)))
      .catch(() => {});
  }, [user?.id]);

  const stats = useMemo(() => {
    const completed = HUNTS.filter((hunt) => completedIds.includes(hunt.id));
    return {
      completed: completed.length,
      xp: completed.reduce((sum, hunt) => sum + hunt.xp, 0),
    };
  }, [completedIds]);

  const visibleHunts = HUNTS.filter((hunt) => {
    const done = completedIds.includes(hunt.id);
    if (activeFilter === 'Completed') return done;
    if (activeFilter === 'Open') return !done;
    return true;
  });

  const resetModal = () => {
    setSelectedHunt(null);
    setProofUri(null);
    setProofNote('');
    setShareToFeed(true);
    setShareToStory(false);
    setSaving(false);
  };

  const pickProof = async (source: 'camera' | 'library') => {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to add proof.');
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85 });

    if (!result.canceled && result.assets[0]) {
      setProofUri(result.assets[0].uri);
    }
  };

  const completeHunt = async () => {
    if (!selectedHunt || !user?.id) {
      Alert.alert('Not logged in', 'Please log in to complete a Gem Hunt.');
      return;
    }

    const note = proofNote.trim();
    if (!note && !proofUri) {
      Alert.alert('Add proof', 'Add a quick note or photo before completing the hunt.');
      return;
    }

    setSaving(true);
    const completionId = `gem_${selectedHunt.id}_${Date.now()}`;
    let uploadedMedia: MediaItem[] = [];
    let storyImage: string | null = null;

    try {
      if (proofUri && shareToFeed) {
        uploadedMedia = await uploadPostMedia(user.id, completionId, [{ uri: proofUri, type: 'photo' }]);
        storyImage = uploadedMedia[0]?.uri ?? null;
      } else if (proofUri && shareToStory) {
        storyImage = await uploadStoryMedia(user.id, proofUri, 'photo');
      }

      if (shareToFeed) {
        const postData: Omit<Post, 'liked' | 'saved'> = {
          id: completionId,
          userId: user.id,
          username: user.username ?? 'traveler',
          userAvatar: user.avatarUri ?? '',
          imageUrl: uploadedMedia[0]?.uri ?? '',
          mediaItems: uploadedMedia,
          caption: note
            ? `Completed Gem Hunt: ${selectedHunt.title}\n\n${note}`
            : `Completed Gem Hunt: ${selectedHunt.title}`,
          locationArea: 'Gem Hunt',
          destination: selectedHunt.category,
          tags: ['hidden gem', 'adventure'],
          vibeTags: ['hidden gem', 'adventurous'],
          mood: ['adventurous', 'curious'],
          likes: 0,
          comments: 0,
          delay: 'now',
          privacy: 'public',
          hideExactLocation: true,
          blurLocation: true,
          hideStayLocation: true,
          createdAt: new Date().toISOString(),
          reactions: {},
          userReaction: null,
          reactionsEnabled: true,
          gemHuntShare: {
            huntId: selectedHunt.id,
            title: selectedHunt.title,
            category: selectedHunt.category,
            difficulty: selectedHunt.difficulty,
            xp: selectedHunt.xp,
            proofNote: note || undefined,
            completedAt: new Date().toISOString(),
          },
        };
        await createPostInFirestore(postData);
      }

      if (shareToStory) {
        await saveStory({
          userId: user.id,
          username: user.username ?? 'traveler',
          userAvatar: user.avatarUri ?? null,
          image: storyImage,
          videoUri: null,
          overlayText: `Gem Hunt complete\n${selectedHunt.title}${note ? `\n${note}` : ''}`,
          location: 'Gem Hunt',
          music: null,
          mentions: [],
        });
      }

      await setDoc(doc(db, 'users', user.id, 'gemHuntCompletions', selectedHunt.id), {
        huntId: selectedHunt.id,
        title: selectedHunt.title,
        xp: selectedHunt.xp,
        proofNote: note,
        sharedToFeed: shareToFeed,
        sharedToStory: shareToStory,
        completedAt: serverTimestamp(),
      }).catch(() => {});

      setCompletedIds((prev) => [...new Set([...prev, selectedHunt.id])]);
      setActiveHuntId(null);
      Alert.alert('Gem Hunt complete', `You earned ${selectedHunt.xp} XP.`);
      resetModal();
    } catch (e: any) {
      Alert.alert('Could not complete hunt', e.message ?? 'Try again in a moment.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>HiddenGems</Text>
            <Text style={styles.title}>Gem Hunts</Text>
          </View>
          <View style={styles.scorePill}>
            <Text style={styles.scoreValue}>{stats.xp}</Text>
            <Text style={styles.scoreLabel}>XP</Text>
          </View>
        </View>

        <LinearGradient
          colors={['#083344', '#0f766e', '#f59e0b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.featured}
        >
          <Text style={styles.featuredBadge}>TODAY'S HUNT</Text>
          <Text style={styles.featuredTitle}>{HUNTS[0].title}</Text>
          <Text style={styles.featuredText}>{HUNTS[0].prompt}</Text>
          <TouchableOpacity
            style={styles.featuredButton}
            onPress={() => {
              setActiveHuntId(HUNTS[0].id);
              setSelectedHunt(HUNTS[0]);
            }}
            activeOpacity={0.86}
          >
            <Text style={styles.featuredButtonText}>
              {completedIds.includes(HUNTS[0].id) ? 'Share Again' : 'Start Hunt'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{HUNTS.length - stats.completed}</Text>
            <Text style={styles.statLabel}>Open</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{activeHuntId ? '1' : '0'}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((filter) => {
            const active = activeFilter === filter;
            return (
              <TouchableOpacity key={filter} onPress={() => setActiveFilter(filter)} activeOpacity={0.85}>
                <View style={[styles.filterPill, active && styles.filterPillActive]}>
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.huntList}>
          {visibleHunts.map((hunt) => {
            const done = completedIds.includes(hunt.id);
            const active = activeHuntId === hunt.id;
            return (
              <TouchableOpacity
                key={hunt.id}
                activeOpacity={0.9}
                onPress={() => setActiveHuntId(active ? null : hunt.id)}
              >
                <View style={[styles.huntCard, active && styles.huntCardActive]}>
                  <LinearGradient colors={hunt.color} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.huntStripe} />
                  <View style={styles.huntContent}>
                    <View style={styles.huntTop}>
                      <View style={styles.huntTitleBlock}>
                        <Text style={styles.huntCategory}>{hunt.category}</Text>
                        <Text style={styles.huntTitle}>{hunt.title}</Text>
                      </View>
                      <View style={[styles.statusBadge, done && styles.statusDone]}>
                        <Text style={styles.statusText}>{done ? 'Done' : `${hunt.xp} XP`}</Text>
                      </View>
                    </View>
                    <Text style={styles.huntPrompt}>{hunt.prompt}</Text>
                    <View style={styles.huntMeta}>
                      <Text style={styles.metaPill}>{hunt.difficulty}</Text>
                      <Text style={styles.metaPill}>{hunt.time}</Text>
                      <Text style={styles.metaPill}>{hunt.vibe}</Text>
                    </View>
                    {active && (
                      <View style={styles.activePanel}>
                        <Text style={styles.proofLabel}>Proof</Text>
                        <Text style={styles.proofText}>{hunt.proof}</Text>
                        <TouchableOpacity
                          style={styles.completeButton}
                          onPress={() => setSelectedHunt(hunt)}
                          activeOpacity={0.86}
                        >
                          <Text style={styles.completeButtonText}>{done ? 'Share Completion' : 'Complete Hunt'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={!!selectedHunt} transparent animationType="slide" onRequestClose={resetModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complete Gem Hunt</Text>
              <TouchableOpacity onPress={resetModal} disabled={saving}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            {selectedHunt && (
              <>
                <Text style={styles.modalHuntTitle}>{selectedHunt.title}</Text>
                <TextInput
                  value={proofNote}
                  onChangeText={setProofNote}
                  placeholder="What did you find?"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.noteInput}
                  multiline
                />
                {proofUri ? (
                  <View style={styles.proofPreviewWrap}>
                    <Image source={{ uri: proofUri }} style={styles.proofPreview} />
                    <TouchableOpacity style={styles.removeProof} onPress={() => setProofUri(null)} disabled={saving}>
                      <Text style={styles.removeProofText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.proofActions}>
                    <TouchableOpacity style={styles.proofButton} onPress={() => pickProof('camera')} disabled={saving}>
                      <Text style={styles.proofButtonText}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.proofButton} onPress={() => pickProof('library')} disabled={saving}>
                      <Text style={styles.proofButtonText}>Library</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.shareBox}>
                  <TouchableOpacity
                    style={[styles.shareToggle, shareToFeed && styles.shareToggleActive]}
                    onPress={() => setShareToFeed((v) => !v)}
                    disabled={saving}
                  >
                    <Text style={[styles.shareToggleText, shareToFeed && styles.shareToggleTextActive]}>Feed</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.shareToggle, shareToStory && styles.shareToggleActive]}
                    onPress={() => setShareToStory((v) => !v)}
                    disabled={saving}
                  >
                    <Text style={[styles.shareToggleText, shareToStory && styles.shareToggleTextActive]}>Story</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.publishButton} onPress={completeHunt} disabled={saving}>
                  <LinearGradient
                    colors={[theme.colors.primary, theme.colors.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.publishGradient}
                  >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishText}>Complete & Share</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 18, paddingBottom: 34 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  kicker: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '900', marginTop: 2 },
  scorePill: {
    minWidth: 74,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scoreValue: { color: theme.colors.accentGold, fontSize: 18, fontWeight: '900' },
  scoreLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '800', marginTop: 2 },
  featured: {
    minHeight: 210,
    borderRadius: 8,
    padding: 22,
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  featuredBadge: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  featuredTitle: { color: '#fff', fontSize: 26, lineHeight: 31, fontWeight: '900', marginTop: 10 },
  featuredText: { color: 'rgba(255,255,255,0.84)', fontSize: 14, lineHeight: 20, marginTop: 8 },
  featuredButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    marginTop: 18,
  },
  featuredButtonText: { color: '#0f172a', fontSize: 14, fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statBlock: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statNumber: { color: theme.colors.text, fontSize: 19, fontWeight: '900' },
  statLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 4 },
  filters: { gap: 8, paddingBottom: 14 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterPillActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '800' },
  filterTextActive: { color: '#fff' },
  huntList: { gap: 12 },
  huntCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  huntCardActive: { borderColor: theme.colors.primaryLight },
  huntStripe: { width: 7 },
  huntContent: { flex: 1, padding: 15 },
  huntTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  huntTitleBlock: { flex: 1 },
  huntCategory: { color: theme.colors.accentGold, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  huntTitle: { color: theme.colors.text, fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 3 },
  statusBadge: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDone: { backgroundColor: '#14532d' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  huntPrompt: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 10 },
  huntMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  metaPill: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  activePanel: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  proofLabel: { color: theme.colors.text, fontSize: 12, fontWeight: '900' },
  proofText: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  completeButton: {
    backgroundColor: theme.colors.text,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 12,
  },
  completeButtonText: { color: theme.colors.background, fontSize: 14, fontWeight: '900' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.borderLight,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '900' },
  modalClose: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '800' },
  modalHuntTitle: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 10 },
  noteInput: {
    minHeight: 92,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    textAlignVertical: 'top',
    marginTop: 14,
  },
  proofActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  proofButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  proofButtonText: { color: theme.colors.text, fontSize: 13, fontWeight: '900' },
  proofPreviewWrap: { marginTop: 12 },
  proofPreview: { width: '100%', height: 150, borderRadius: 8 },
  removeProof: { alignSelf: 'flex-end', marginTop: 8 },
  removeProofText: { color: theme.colors.accent, fontSize: 12, fontWeight: '900' },
  shareBox: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  shareToggle: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  shareToggleActive: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  shareToggleText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '900' },
  shareToggleTextActive: { color: '#14532d' },
  publishButton: { borderRadius: 999, overflow: 'hidden', marginTop: 16 },
  publishGradient: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  publishText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
