import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { auth, db } from '../firebase';
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useUser } from '../context/UserContext';
import GlassCard from '../components/GlassCard';
import { RootStackParamList } from '../navigation/types';
import {
  getFollowStatus,
  getFriendStatus,
  sendFollowRequest,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  cancelFollowRequest,
  getOtherUserFriendList,
  FollowStatus,
  FriendStatus,
  Friend,
} from '../services/socialService';
import { followUser, unfollowUser } from '../services/postsService';
import { Post } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OtherUserProfile'>;
type Route = RouteProp<RootStackParamList, 'OtherUserProfile'>;

interface OtherUser {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatarUri: string | null;
  privateProfile: boolean;
  friendListVisibility: 'public' | 'friends' | 'private';
  interests: string[];
}

export default function OtherUserProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId } = route.params;
  const { user: me } = useUser();

  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [postsCount, setPostsCount] = useState(0);

  const [followStatus, setFollowStatus] = useState<FollowStatus>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const isMe = me?.id === userId;

  const loadData = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    try {
      // User doc
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (!userSnap.exists()) { setLoading(false); return; }
      const data = userSnap.data();
      const profile: OtherUser = {
        id: userId,
        name: data.name ?? '',
        username: data.username ?? '',
        bio: data.bio ?? '',
        avatarUri: data.avatarUri ?? null,
        privateProfile: data.privateProfile ?? false,
        friendListVisibility: data.friendListVisibility ?? 'public',
        interests: data.interests ?? [],
      };
      setOtherUser(profile);

      // Follow + friend status
      const [fwSnap, frStatus, followersSnap, followingSnap] = await Promise.all([
        isMe ? Promise.resolve(null) : getFollowStatus(me.id, userId),
        isMe ? Promise.resolve<FriendStatus>(null) : getFriendStatus(me.id, userId),
        getDocs(query(collection(db, 'follows'), where('followeeId', '==', userId), where('status', '==', 'following'))),
        getDocs(query(collection(db, 'follows'), where('followerId', '==', userId), where('status', '==', 'following'))),
      ]);
      const fwStatus = fwSnap as FollowStatus;
      setFollowStatus(fwStatus);
      setFriendStatus(frStatus);
      setFollowerCount(followersSnap.size);
      setFollowingCount(followingSnap.size);

      const canSeePosts = !profile.privateProfile || isMe || fwStatus === 'following';

      // Posts
      if (canSeePosts) {
        const postsSnap = await getDocs(
          query(collection(db, 'posts'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(30)),
        );
        const mapped: Post[] = postsSnap.docs.map((d) => {
          const pd = d.data();
          return {
            id: d.id, userId: pd.userId ?? '', username: pd.username ?? '',
            userAvatar: pd.userAvatar ?? '',
            imageUrl: pd.mediaItems?.[0]?.uri ?? pd.imageUrl ?? '',
            mediaItems: pd.mediaItems ?? [], caption: pd.caption ?? '',
            locationArea: pd.locationArea ?? '', destination: pd.destination ?? '',
            tags: pd.tags ?? [], mood: Array.isArray(pd.mood) ? pd.mood : (pd.mood ? [pd.mood] : ['wanderlust']),
            likes: pd.likesCount ?? 0, comments: pd.commentsCount ?? 0,
            delay: pd.delay ?? 'now', privacy: pd.privacy ?? 'public',
            hideExactLocation: pd.hideExactLocation ?? false, blurLocation: pd.blurLocation ?? false,
            hideStayLocation: pd.hideStayLocation ?? false,
            createdAt: pd.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
            liked: false, saved: false, reactions: pd.reactions ?? {}, userReaction: null,
            reactionsEnabled: pd.reactionsEnabled ?? true,
          } as Post;
        });
        setPosts(mapped);
        setPostsCount(mapped.length);
      } else {
        setPostsCount(0);
      }

      // Friends list (respects visibility)
      if (!isMe) {
        const friendList = await getOtherUserFriendList(me.id, userId, frStatus);
        setFriends(friendList);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, me, isMe]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Follow action ──────────────────────────────────────────────────────────
  const handleFollow = async () => {
    if (!me || !otherUser) return;
    setActionLoading(true);
    try {
      if (followStatus === null) {
        if (otherUser.privateProfile) {
          await sendFollowRequest(me.id, me.username, me.avatarUri ?? null, userId, otherUser.username);
          setFollowStatus('requested');
        } else {
          await followUser(me.id, me.username, me.avatarUri ?? null, userId, otherUser.username);
          setFollowStatus('following');
          setFollowerCount((c) => c + 1);
        }
      } else if (followStatus === 'requested') {
        await cancelFollowRequest(me.id, userId);
        setFollowStatus(null);
      } else if (followStatus === 'following') {
        Alert.alert('Unfollow', `Stop following @${otherUser.username}?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unfollow', style: 'destructive', onPress: async () => {
              await unfollowUser(me.id, userId);
              setFollowStatus(null);
              setFollowerCount((c) => Math.max(0, c - 1));
            },
          },
        ]);
      }
    } catch (_) { } finally { setActionLoading(false); }
  };

  // ── Friend action ──────────────────────────────────────────────────────────
  const handleFriend = async () => {
    if (!me || !otherUser) return;
    setActionLoading(true);
    try {
      if (friendStatus === null) {
        await sendFriendRequest(me.id, me.username, me.avatarUri ?? null, userId, otherUser.username);
        setFriendStatus('pending_sent');
      } else if (friendStatus === 'pending_sent') {
        Alert.alert('Cancel Request', 'Cancel your friend request?', [
          { text: 'No', style: 'cancel' },
          {
            text: 'Cancel Request', style: 'destructive', onPress: async () => {
              await declineFriendRequest(me.id, userId);
              setFriendStatus(null);
            },
          },
        ]);
      } else if (friendStatus === 'pending_received') {
        Alert.alert('Friend Request', `Accept @${otherUser.username}'s friend request?`, [
          {
            text: 'Decline', style: 'destructive', onPress: async () => {
              await declineFriendRequest(me.id, userId);
              setFriendStatus(null);
            },
          },
          {
            text: 'Accept', onPress: async () => {
              await acceptFriendRequest(me.id, userId);
              setFriendStatus('friends');
            },
          },
        ]);
      } else if (friendStatus === 'friends') {
        Alert.alert('Remove Friend', `Remove @${otherUser.username} from friends?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove', style: 'destructive', onPress: async () => {
              await removeFriend(me.id, userId);
              setFriendStatus(null);
            },
          },
        ]);
      }
    } catch (_) { } finally { setActionLoading(false); }
  };

  const followLabel = () => {
    if (followStatus === 'following') return 'Following ✓';
    if (followStatus === 'requested') return 'Requested ⏳';
    return 'Follow';
  };

  const friendLabel = () => {
    if (friendStatus === 'friends') return 'Friends ✓';
    if (friendStatus === 'pending_sent') return 'Request Sent';
    if (friendStatus === 'pending_received') return 'Accept Request';
    return 'Add Friend';
  };

  const canSeePosts = !otherUser?.privateProfile || isMe || followStatus === 'following';

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={[]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backBtnText}>‹</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!otherUser) {
    return (
      <SafeAreaView style={s.container} edges={[]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Profile</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.colors.textMuted }}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={[]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>@{otherUser.username}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient
          colors={theme.colors.gradientPrimary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.heroBanner}
        />

        <View style={s.profileContent}>
          {/* Avatar */}
          <View style={s.avatarWrapper}>
            {otherUser.avatarUri ? (
              <Image source={{ uri: otherUser.avatarUri }} style={s.avatar} />
            ) : (
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.accent] as [string, string]}
                style={[s.avatar, s.avatarFallback]}
              >
                <Text style={s.avatarInitial}>{otherUser.name[0]?.toUpperCase() ?? '?'}</Text>
              </LinearGradient>
            )}
          </View>

          {/* Identity */}
          {!!otherUser.name && <Text style={s.displayName}>{otherUser.name}</Text>}
          <Text style={s.username}>@{otherUser.username}</Text>
          {!!otherUser.bio && <Text style={s.bio}>{otherUser.bio}</Text>}
          {otherUser.privateProfile && <Text style={s.privateBadge}>🔒 Private Account</Text>}

          {/* Action buttons */}
          {!isMe && (
            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.followBtn, followStatus === 'following' && s.followBtnActive]}
                onPress={handleFollow}
                disabled={actionLoading}
              >
                <Text style={[s.followBtnText, followStatus === 'following' && s.followBtnTextActive]}>
                  {followLabel()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.friendBtn, friendStatus === 'friends' && s.friendBtnActive]}
                onPress={handleFriend}
                disabled={actionLoading}
              >
                <Text style={[s.friendBtnText, friendStatus === 'friends' && s.friendBtnTextActive]}>
                  {friendLabel()}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Stats */}
          <View style={s.statsBlock}>
            <View style={s.stat}>
              <Text style={s.statValue}>{followerCount}</Text>
              <Text style={s.statLabel}>Followers</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={s.statValue}>{followingCount}</Text>
              <Text style={s.statLabel}>Following</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={s.statValue}>{postsCount}</Text>
              <Text style={s.statLabel}>Posts</Text>
            </View>
            {friends !== null && (
              <>
                <View style={s.statDivider} />
                <View style={s.stat}>
                  <Text style={s.statValue}>{friends.length}</Text>
                  <Text style={s.statLabel}>Friends</Text>
                </View>
              </>
            )}
          </View>

          {/* Posts or locked */}
          {canSeePosts ? (
            posts.length > 0 ? (
              <View style={s.postsGrid}>
                {posts.map((post) => {
                  const thumb = post.mediaItems?.[0]?.uri ?? post.imageUrl;
                  return (
                    <TouchableOpacity key={post.id} style={s.gridItem} onPress={() => setSelectedPost(post)} activeOpacity={0.85}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={s.gridImage} resizeMode="cover" />
                      ) : (
                        <View style={[s.gridImage, { alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ fontSize: 28 }}>🗺️</Text>
                        </View>
                      )}
                      {post.mediaItems && post.mediaItems.length > 1 && (
                        <View style={s.gridMultiBadge}><Text style={s.gridMultiBadgeTxt}>⧉</Text></View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={s.emptyPosts}>
                <Text style={s.emptyIcon}>📸</Text>
                <Text style={s.emptyText}>No posts yet</Text>
              </View>
            )
          ) : (
            <GlassCard style={s.lockedCard}>
              <Text style={s.lockIcon}>🔒</Text>
              <Text style={s.lockedTitle}>This account is private</Text>
              <Text style={s.lockedSub}>Follow to see their posts</Text>
            </GlassCard>
          )}

          {/* Friends list (if visible) */}
          {friends !== null && friends.length > 0 && (
            <View style={{ marginTop: 24, marginBottom: 8 }}>
              <Text style={s.sectionTitle}>Friends ({friends.length})</Text>
              {friends.map((fr) => (
                <TouchableOpacity
                  key={fr.id}
                  onPress={() => navigation.push('OtherUserProfile', { userId: fr.id })}
                  activeOpacity={0.8}
                >
                  <GlassCard style={s.friendRow}>
                    <View style={s.friendAvatar}>
                      {fr.avatar
                        ? <Image source={{ uri: fr.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                        : <Text style={{ fontSize: 20 }}>👤</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.friendName}>{fr.username}</Text>
                      <Text style={s.friendHandle}>@{fr.username}</Text>
                    </View>
                    <Text style={{ color: theme.colors.textSecondary }}>›</Text>
                  </GlassCard>
                </TouchableOpacity>
              ))}
            </View>
          )}

        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Post preview sheet */}
      {selectedPost && (
        <View style={s.postSheet}>
          <View style={s.postSheetHandle} />
          <View style={s.postSheetHeader}>
            <Text style={s.postSheetTitle}>{selectedPost.destination}</Text>
            <TouchableOpacity onPress={() => setSelectedPost(null)}>
              <Text style={{ color: theme.colors.primary, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {(selectedPost.mediaItems?.[0]?.uri ?? selectedPost.imageUrl) ? (
              <Image source={{ uri: selectedPost.mediaItems?.[0]?.uri ?? selectedPost.imageUrl }} style={{ width: '100%', aspectRatio: 1 }} resizeMode="cover" />
            ) : null}
            <View style={{ padding: theme.spacing.md }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginBottom: 8 }}>📍 {selectedPost.locationArea}</Text>
              {!!selectedPost.caption && <Text style={{ color: theme.colors.text, fontSize: 15, lineHeight: 22 }}>{selectedPost.caption}</Text>}
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                <Text style={{ color: theme.colors.textSecondary }}>❤️ {selectedPost.likes}</Text>
                <Text style={{ color: theme.colors.textSecondary }}>💬 {selectedPost.comments}</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

const GRID_COLS = 3;
import { Dimensions } from 'react-native';
const SCREEN_W = Dimensions.get('window').width;
const GRID_ITEM_SIZE = (SCREEN_W - 32 - 2) / GRID_COLS;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  backBtnText: { color: theme.colors.primary, fontSize: 32, lineHeight: 36, fontWeight: '300' },
  headerTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  heroBanner: { height: 100 },
  profileContent: { paddingHorizontal: 16, paddingTop: 16 },
  avatarWrapper: {
    alignSelf: 'center',
    marginTop: -50,
    marginBottom: 12,
    width: 88, height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: theme.colors.background,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 36, fontWeight: '800' },
  displayName: { color: theme.colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 2 },
  username: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 6 },
  bio: { color: theme.colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 8 },
  privateBadge: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 8 },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 16,
    justifyContent: 'center',
  },
  followBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: 40,
    paddingVertical: 9,
    alignItems: 'center',
    maxWidth: 160,
  },
  followBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  followBtnText: {
    color: theme.colors.primaryLight,
    fontSize: 13,
    fontWeight: '700',
  },
  followBtnTextActive: { color: '#fff' },
  friendBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 40,
    paddingVertical: 9,
    alignItems: 'center',
    maxWidth: 160,
  },
  friendBtnActive: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  friendBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  friendBtnTextActive: { color: '#22c55e' },
  statsBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
    marginBottom: 20,
  },
  stat: { alignItems: 'center' },
  statValue: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: theme.colors.border },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -1,
    marginBottom: 16,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    margin: 1,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: theme.colors.surface,
  },
  gridImage: { width: '100%', height: '100%' },
  gridMultiBadge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  gridMultiBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyPosts: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { color: theme.colors.textMuted, fontSize: 14 },
  lockedCard: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 20,
  },
  lockIcon: { fontSize: 40, marginBottom: 12 },
  lockedTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  lockedSub: { color: theme.colors.textMuted, fontSize: 13 },
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  friendAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.surface,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  friendName: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  friendHandle: { color: theme.colors.textMuted, fontSize: 12, marginTop: 1 },
  postSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    maxHeight: '85%',
  },
  postSheetHandle: {
    width: 36, height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 4,
  },
  postSheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  postSheetTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
});
