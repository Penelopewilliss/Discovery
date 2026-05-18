import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { Place, Post } from '../types';
import { auth, db } from '../firebase';
import { collection, query as fsQuery, orderBy, limit, getDocs } from 'firebase/firestore';
import { followUser, unfollowUser, checkFollowing } from '../services/postsService';
import { useUser } from '../context/UserContext';
import GlassCard from '../components/GlassCard';
import { getFeaturedPlaces, searchFsqPlaces, FsqPlace, FsqPlaceWithPhoto } from '../utils/foursquare';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

function fsqToPlace(raw: FsqPlace, photoUrl: string): Place {
  return {
    id: raw.fsq_id,
    name: raw.name,
    country: raw.location.country ?? raw.location.locality ?? '',
    coverImage: photoUrl,
    followersCount: raw.stats?.total_ratings ?? 0,
    trendingPosts: [], travelTips: [], safetyNotes: [],
    followed: false,
    lat: raw.geocodes?.main?.latitude,
    lon: raw.geocodes?.main?.longitude,
  };
}

const { width } = Dimensions.get('window');

// Build searchable users from Firestore (populated at runtime)
const TRENDING_TAGS = ['hidden gem', 'beach', 'food', 'city', 'nature', 'adventure', 'budget', 'luxury'];

type Tab = 'All' | 'People' | 'Places' | 'Posts';
const TABS: Tab[] = ['All', 'People', 'Places', 'Posts'];
type SortOrder = 'popular' | 'newest';

export default function SearchScreen() {
  const { user: loggedInUser } = useUser();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [sortOrder, setSortOrder] = useState<SortOrder>('popular');
  const [followedUsers, setFollowedUsers] = useState<string[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; username: string; name: string; avatar: string | null; bio: string }>>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const placeSearchTimer = React.useRef<ReturnType<typeof setTimeout>>();
  const placeAbortRef = React.useRef<AbortController>();
  // Load featured places on mount
  useEffect(() => {
    getFeaturedPlaces().then((results: FsqPlaceWithPhoto[]) => {
      setPlaces(results.map((r) => fsqToPlace(r, r.photoUrl)));
      setPlacesLoading(false);
    }).catch(() => setPlacesLoading(false));
  }, []);

  // Search places via Foursquare when query changes
  useEffect(() => {
    if (!q) {
      // Reset to featured when query clears
      setPlacesLoading(true);
      getFeaturedPlaces().then((results: FsqPlaceWithPhoto[]) => {
        setPlaces(results.map((r) => fsqToPlace(r, r.photoUrl)));
        setPlacesLoading(false);
      }).catch(() => setPlacesLoading(false));
      return;
    }
    clearTimeout(placeSearchTimer.current);
    placeSearchTimer.current = setTimeout(async () => {
      placeAbortRef.current?.abort();
      placeAbortRef.current = new AbortController();
      const { signal } = placeAbortRef.current;
      setPlacesLoading(true);
      try {
        const results = await searchFsqPlaces(q, signal);
        if (!signal.aborted) {
          setPlaces(results.map((r) => fsqToPlace(r, '')));
          setPlacesLoading(false);
        }
      } catch {
        if (!placeAbortRef.current?.signal.aborted) setPlacesLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(placeSearchTimer.current);
      placeAbortRef.current?.abort();
    };
  }, [q]);

  // Load posts from Firestore on mount
  useEffect(() => {
    getDocs(fsQuery(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100))).then((snap) => {
      const posts: Post[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id, userId: data.userId ?? '', username: data.username ?? '',
          userAvatar: data.userAvatar ?? '', imageUrl: data.mediaItems?.[0]?.uri ?? data.imageUrl ?? '',
          mediaItems: data.mediaItems ?? [], caption: data.caption ?? '',
          locationArea: data.locationArea ?? '', destination: data.destination ?? '',
          tags: data.tags ?? [], mood: data.mood ?? 'wanderlust',
          likes: data.likesCount ?? 0, comments: data.commentsCount ?? 0,
          delay: data.delay ?? 'now', privacy: data.privacy ?? 'public',
          hideExactLocation: data.hideExactLocation ?? false, blurLocation: data.blurLocation ?? false,
          hideStayLocation: data.hideStayLocation ?? false,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          liked: false, saved: false, reactions: data.reactions ?? {}, userReaction: null,
          reactionsEnabled: data.reactionsEnabled ?? true,
        } as Post;
      });
      setAllPosts(posts);
    }).catch(() => {});
  }, []);

  // Strip leading # so searching "#amsterdam" or "amsterdam" both work
  const q = query.trim().toLowerCase().replace(/^#/, '');

  // Search users from Firestore when query changes
  useEffect(() => {
    if (!q) { setAllUsers([]); return; }
    getDocs(collection(db, 'users')).then((snap) => {
      const users = snap.docs
        .map((d) => ({ id: d.id, ...d.data() as any }))
        .filter((u: any) =>
          (u.username ?? '').toLowerCase().includes(q) ||
          (u.name ?? '').toLowerCase().includes(q) ||
          (u.bio ?? '').toLowerCase().includes(q)
        )
        .map((u: any) => ({ id: u.id, username: u.username ?? '', name: u.name ?? '', avatar: u.avatarUri ?? null, bio: u.bio ?? '' }));
      setAllUsers(users);
    }).catch(() => {});
  }, [query]);

  const filteredUsers = useMemo(
    () => allUsers,
    [allUsers]
  );

  const filteredPlaces = places;

  const filteredPosts = useMemo(() => {
    if (!q) return [];
    const matched = allPosts.filter(
      (p) =>
        p.caption.toLowerCase().includes(q) ||
        p.destination?.toLowerCase().includes(q) ||
        p.locationArea?.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
    if (sortOrder === 'popular') {
      return [...matched].sort((a, b) => b.likes - a.likes);
    }
    return [...matched].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [q, sortOrder, allPosts]);

  const toggleFollow = (userId: string) => {
    if (!loggedInUser?.id) return;
    const nowFollowing = !followedUsers.includes(userId);
    setFollowedUsers((prev) =>
      nowFollowing ? [...prev, userId] : prev.filter((id) => id !== userId)
    );
    nowFollowing
      ? followUser(loggedInUser.id, loggedInUser.username, loggedInUser.avatarUri, userId, '')
      : unfollowUser(loggedInUser.id, userId);
  };

  const formatCount = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();

  const showPeople = activeTab === 'All' || activeTab === 'People';
  const showPlaces = activeTab === 'All' || activeTab === 'Places';
  const showPosts = (activeTab === 'All' || activeTab === 'Posts') && q.length > 0;

  // ─── Place detail view ───
  if (selectedPlace) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.detailHero}>
            <Image source={{ uri: selectedPlace.coverImage }} style={styles.detailHeroImg} resizeMode="cover" />
            <LinearGradient colors={['transparent', theme.colors.background]} style={styles.detailHeroGrad} />
            <TouchableOpacity style={styles.detailBack} onPress={() => setSelectedPlace(null)}>
              <Text style={styles.detailBackText}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.detailHeroContent}>
              <Text style={styles.detailName}>{selectedPlace.name}</Text>
              <Text style={styles.detailCountry}>{selectedPlace.country}</Text>
              <Text style={styles.detailFollowers}>👥 {selectedPlace.followersCount.toLocaleString()} followers</Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: theme.spacing.md }}>
            <Text style={styles.detailSection}>✈️ Travel Tips</Text>
            {selectedPlace.travelTips.map((tip, i) => (
              <GlassCard key={i} style={styles.detailCard}>
                <Text style={styles.detailCardText}>• {tip}</Text>
              </GlassCard>
            ))}
            <Text style={[styles.detailSection, { marginTop: theme.spacing.lg }]}>🛡️ Safety Notes</Text>
            {selectedPlace.safetyNotes.map((note, i) => (
              <GlassCard key={i} style={[styles.detailCard, { borderColor: 'rgba(252,92,125,0.2)' }]}>
                <Text style={styles.detailCardText}>• {note}</Text>
              </GlassCard>
            ))}
            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Post detail view ───
  if (selectedPost) {
    const img = selectedPost.mediaItems?.[0]?.uri;
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.detailBack} onPress={() => setSelectedPost(null)}>
            <Text style={styles.detailBackText}>← Back</Text>
          </TouchableOpacity>
          {!!img && <Image source={{ uri: img }} style={styles.postDetailImg} resizeMode="cover" />}
          <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md }}>
            <View style={styles.postDetailAuthor}>
              <Text style={styles.postDetailHandle}>@{selectedPost.username}</Text>
              {!!selectedPost.destination && (
                <Text style={styles.postDetailDest}>📍 {selectedPost.destination}</Text>
              )}
            </View>
            <Text style={styles.postDetailCaption}>{selectedPost.caption}</Text>
            <View style={styles.postDetailMeta}>
              <Text style={styles.postDetailStat}>❤️ {selectedPost.likes}</Text>
              <Text style={styles.postDetailStat}>💬 {selectedPost.comments}</Text>
            </View>
            {selectedPost.tags.length > 0 && (
              <View style={styles.postTags}>
                {selectedPost.tags.map((tag) => (
                  <View key={tag} style={styles.postTag}>
                    <Text style={styles.postTagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔎</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search people, places, posts..."
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Trending tags (shown when no query) */}
        {!q && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔥 Trending Tags</Text>
            <View style={styles.tagsWrap}>
              {TRENDING_TAGS.map((tag) => (
                <TouchableOpacity key={tag} onPress={() => setQuery(tag)}>
                  <LinearGradient
                    colors={['rgba(124,92,252,0.2)', 'rgba(252,92,125,0.2)']}
                    style={styles.trendingTag}
                  >
                    <Text style={styles.trendingTagText}>#{tag}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* People */}
        {showPeople && filteredUsers.length > 0 && (
          <View style={styles.section}>
            {(activeTab === 'All') && <Text style={styles.sectionTitle}>👤 People</Text>}
            {filteredUsers.map((user) => {
              const followed = followedUsers.includes(user.id);
              const isMe = user.id === loggedInUser?.id;
              return (
                <TouchableOpacity
                  key={user.id}
                  style={styles.userRow}
                  onPress={() => { if (!isMe) navigation.navigate('OtherUserProfile', { userId: user.id }); }}
                  activeOpacity={0.8}
                >
                <Image source={user.avatar ? { uri: user.avatar } : { uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80' }} style={styles.userAvatar} />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.name}</Text>
                    <Text style={styles.userHandle}>@{user.username}</Text>
                    <Text style={styles.userBio} numberOfLines={1}>{user.bio}</Text>
                  </View>
                  <View style={styles.userRight}>
                    <Text style={styles.followerCount}>traveler</Text>
                    {!isMe && (
                      <TouchableOpacity
                        onPress={(e) => { e.stopPropagation?.(); toggleFollow(user.id); }}
                        style={[styles.followBtn, followed && styles.followBtnActive]}
                      >
                        <Text style={[styles.followBtnText, followed && styles.followBtnTextActive]}>
                          {followed ? '✓ Following' : 'Follow'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Places */}
        {showPlaces && filteredPlaces.length > 0 && (
          <View style={styles.section}>
            {activeTab === 'All' && <Text style={styles.sectionTitle}>📍 Places</Text>}
            {filteredPlaces.map((place) => (
              <TouchableOpacity key={place.id} style={styles.placeRow} onPress={() => setSelectedPlace(place)} activeOpacity={0.7}>
                <Image source={{ uri: place.coverImage }} style={styles.placeImg} />
                <View style={styles.placeInfo}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  <Text style={styles.placeCountry}>{place.country}</Text>
                  <Text style={styles.placeFollowers}>
                    👥 {place.followersCount.toLocaleString()} followers
                  </Text>
                </View>
                <Text style={styles.placeChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Posts (only shown when querying) */}
        {showPosts && (
          <View style={styles.section}>
            {/* Section header + sort controls */}
            <View style={styles.postsSectionHeader}>
              <Text style={styles.sectionTitle}>✈️ Posts {filteredPosts.length > 0 ? `(${filteredPosts.length})` : ''}</Text>
              <View style={styles.sortRow}>
                <TouchableOpacity
                  onPress={() => setSortOrder('popular')}
                  style={[styles.sortBtn, sortOrder === 'popular' && styles.sortBtnActive]}
                >
                  <Text style={[styles.sortBtnText, sortOrder === 'popular' && styles.sortBtnTextActive]}>🔥 Popular</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSortOrder('newest')}
                  style={[styles.sortBtn, sortOrder === 'newest' && styles.sortBtnActive]}
                >
                  <Text style={[styles.sortBtnText, sortOrder === 'newest' && styles.sortBtnTextActive]}>🕒 Newest</Text>
                </TouchableOpacity>
              </View>
            </View>

            {filteredPosts.length === 0 ? (
              <View style={styles.noPostsHint}>
                <Text style={styles.noPostsText}>No posts tagged with “{query.replace(/^#/, '')}” yet</Text>
              </View>
            ) : (
              filteredPosts.map((post) => (
                <TouchableOpacity key={post.id} style={styles.postRow} onPress={() => setSelectedPost(post)} activeOpacity={0.7}>
                  {post.mediaItems && post.mediaItems[0] && (
                    <Image source={{ uri: post.mediaItems[0].uri }} style={styles.postThumb} />
                  )}
                  <View style={styles.postInfo}>
                    <Text style={styles.postCaption} numberOfLines={2}>{post.caption}</Text>
                    <Text style={styles.postMeta}>
                      @{post.username} · 📍 {post.locationArea}
                    </Text>
                    <View style={styles.postTagsRow}>
                      {post.tags.slice(0, 3).map((tag) => (
                        <View key={tag} style={styles.postTag}>
                          <Text style={styles.postTagText}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.postLikes}>❤️ {post.likes.toLocaleString()} likes</Text>
                  </View>
                  <Text style={styles.placeChevron}>›</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Empty state */}
        {q.length > 0 &&
          filteredUsers.length === 0 &&
          filteredPlaces.length === 0 &&
          filteredPosts.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No results for "{query}"</Text>
              <Text style={styles.emptyHint}>Try a different keyword or explore trending tags</Text>
            </View>
          )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  searchContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    paddingVertical: 12,
  },
  clearBtn: { padding: 4 },
  clearText: { color: theme.colors.textMuted, fontSize: 14 },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  section: { paddingTop: theme.spacing.md },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.md,
    gap: 8,
  },
  trendingTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(124,92,252,0.3)',
  },
  trendingTagText: { color: theme.colors.primary, fontSize: 13, fontWeight: '600' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  userAvatar: { width: 48, height: 48, borderRadius: 24 },
  userInfo: { flex: 1 },
  userName: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  userHandle: { color: theme.colors.textMuted, fontSize: 13, marginTop: 1 },
  userBio: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  userRight: { alignItems: 'flex-end', gap: 6 },
  followerCount: { color: theme.colors.textMuted, fontSize: 11 },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  followBtnActive: { backgroundColor: theme.colors.primary },
  followBtnText: { color: theme.colors.primary, fontSize: 12, fontWeight: '600' },
  followBtnTextActive: { color: '#fff' },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  placeImg: { width: 56, height: 56, borderRadius: theme.borderRadius.md },
  placeInfo: { flex: 1 },
  placeName: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  placeCountry: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  placeFollowers: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 },
  placeChevron: { color: theme.colors.textMuted, fontSize: 22, paddingLeft: 4 },
  // Detail views
  detailHero: { width: '100%', height: 280 },
  detailHeroImg: { width: '100%', height: '100%' },
  detailHeroGrad: { ...StyleSheet.absoluteFillObject },
  detailBack: { position: 'absolute', top: 16, left: 16, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  detailBackText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  detailHeroContent: { position: 'absolute', bottom: 20, left: 20 },
  detailName: { color: '#fff', fontSize: 26, fontWeight: '800' },
  detailCountry: { color: 'rgba(255,255,255,0.75)', fontSize: 15, marginTop: 2 },
  detailFollowers: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4 },
  detailSection: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
  detailCard: { marginBottom: 8, padding: theme.spacing.md },
  detailCardText: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
  postDetailImg: { width: '100%', height: width, backgroundColor: theme.colors.surface },
  postDetailAuthor: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  postDetailHandle: { color: theme.colors.primary, fontSize: 14, fontWeight: '700' },
  postDetailDest: { color: theme.colors.textMuted, fontSize: 13 },
  postDetailCaption: { color: theme.colors.text, fontSize: 15, lineHeight: 22 },
  postDetailMeta: { flexDirection: 'row', gap: 16, marginTop: 12, marginBottom: 12 },
  postDetailStat: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' },
  postRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  postThumb: { width: 64, height: 64, borderRadius: theme.borderRadius.md },
  postInfo: { flex: 1 },
  postCaption: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
  postMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
  postTags: { flexDirection: 'row', gap: 6, marginTop: 6 },
  postTagsRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  postTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
  },
  postTagText: { color: theme.colors.textMuted, fontSize: 11 },
  postLikes: { color: theme.colors.textMuted, fontSize: 11, marginTop: 4 },
  postsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  sortRow: { flexDirection: 'row', gap: 6 },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  sortBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  sortBtnText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  sortBtnTextActive: { color: '#fff' },
  noPostsHint: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md },
  noPostsText: { color: theme.colors.textMuted, fontSize: 14, fontStyle: 'italic' },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyHint: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
