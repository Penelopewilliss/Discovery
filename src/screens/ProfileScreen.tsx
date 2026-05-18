import React, { useState, useEffect } from 'react';
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



const SCREEN = Dimensions.get('window');
import { theme } from '../theme';
import { auth, db, storage } from '../firebase';
import { signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { FirestoreStory, deleteStory, unarchivePostInFirestore, getOrCreateDMConversation } from '../services/postsService';
import {
  getIncomingFollowRequests, acceptFollowRequest, declineFollowRequest,
  getIncomingFriendRequests, acceptFriendRequest, declineFriendRequest,
  getFriendList, FollowRequest, FriendRequest, Friend,
} from '../services/socialService';
import * as FileSystem from 'expo-file-system/legacy';
import GlassCard from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { PostDelay, Post } from '../types';

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
  const { user: loggedInUser, setUser, stamps } = useUser();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [privateProfile, setPrivateProfile] = useState(false);
  const [hideLocation, setHideLocation] = useState(true);
  const [allowStoryShares, setAllowStoryShares] = useState(true);
  const [allowTagging, setAllowTagging] = useState(true);
  const [friendListVisibility, setFriendListVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [defaultDelay, setDefaultDelay] = useState<PostDelay>('24h');
  const [showDelayPicker, setShowDelayPicker] = useState(false);
  const [showFollowersList, setShowFollowersList] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [archivedPosts, setArchivedPosts] = useState<Post[]>([]);
  const [profileTab, setProfileTab] = useState<'posts' | 'archive'>('posts');
  const [myStories, setMyStories] = useState<FirestoreStory[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [myFriends, setMyFriends] = useState<Friend[]>([]);
  const totalPendingRequests = followRequests.length + friendRequests.length;


  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive', onPress: async () => {
          await signOut(auth);
          setUser(null);
        },
      },
    ]);
  };

  const handleInvite = () => {
    Share.share({
      message: `Join me on HiddenGems — the travel app for discovering hidden gems and sharing real travel memories! Download Expo Go and scan my link to try it: https://expo.dev/@penelope11/hiddengems`,
      title: 'Join me on HiddenGems',
    }).catch(() => {});
  };

  const handleForgotPassword = () => {
    const email = loggedInUser?.email;
    if (!email) {
      Alert.alert('No email', 'No email address found for your account.');
      return;
    }
    Alert.alert(
      'Reset Password',
      `Send a password reset link to ${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send', onPress: async () => {
            try {
              await sendPasswordResetEmail(auth, email);
              Alert.alert('Email sent', `Check ${email} for a reset link.`);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  // Edit profile
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(loggedInUser?.name ?? '');
  const [editUsername, setEditUsername] = useState(loggedInUser?.username ?? '');
  const [editBio, setEditBio] = useState(loggedInUser?.bio ?? '');
  const [editAvatar, setEditAvatar] = useState(loggedInUser?.avatarUri ?? null);

  // stamps come from UserContext — always in sync across screens

  // Followers / Following
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followers, setFollowers] = useState<Array<{ id: string; username: string; avatar: string | null }>>([]);
  const [following, setFollowing] = useState<Array<{ id: string; username: string; avatar: string | null }>>([]);

  // Load data from Firestore on mount
  useEffect(() => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;

    // Load settings from user doc
    getDoc(doc(db, 'users', uid)).then((snap) => {
      const data = snap.data() ?? {};
      if (data.privateProfile !== undefined) setPrivateProfile(data.privateProfile);
      if (data.hideExactLocation !== undefined) setHideLocation(data.hideExactLocation);
      if (data.allowStoryShares !== undefined) setAllowStoryShares(data.allowStoryShares);
      if (data.allowTagging !== undefined) setAllowTagging(data.allowTagging);
      if (data.friendListVisibility !== undefined) setFriendListVisibility(data.friendListVisibility);
    }).catch(() => {});

    // Load follow requests, friend requests, and friend list
    getIncomingFollowRequests(uid).then(setFollowRequests).catch(() => {});
    getIncomingFriendRequests(uid).then(setFriendRequests).catch(() => {});
    getFriendList(uid).then(setMyFriends).catch(() => {});

    // Load follower / following counts
    getDocs(query(collection(db, 'follows'), where('followeeId', '==', uid))).then((snap) => {
      setFollowerCount(snap.size);
      setFollowers(snap.docs.map((d) => ({
        id: d.data().followerId as string,
        username: (d.data().followerUsername as string) ?? 'traveller',
        avatar: (d.data().followerAvatar as string | null) ?? null,
      })));
    }).catch(() => {});

    getDocs(query(collection(db, 'follows'), where('followerId', '==', uid))).then((snap) => {
      setFollowingCount(snap.size);
      setFollowing(snap.docs.map((d) => ({
        id: d.data().followeeId as string,
        username: (d.data().followeeUsername as string) ?? 'traveller',
        avatar: (d.data().followeeAvatar as string | null) ?? null,
      })));
    }).catch(() => {});

    // Load the user's own posts
    getDocs(query(collection(db, 'posts'), where('userId', '==', uid), limit(50))).then((snap) => {
      const mapped: Post[] = snap.docs.map((d) => {
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
          archived: pd.archived ?? false,
        } as Post;
      });
      const sorted = mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMyPosts(sorted.filter((p) => !p.archived));
      setArchivedPosts(sorted.filter((p) => p.archived));
    }).catch(() => {});

    // Load the user's own stories (last 18 h)
    getDocs(query(collection(db, 'stories'), where('userId', '==', uid), limit(20))).then((snap) => {
      const EXPIRY_MS = 18 * 60 * 60 * 1000;
      const cutoff = Date.now() - EXPIRY_MS;
      const stories = snap.docs.map((d) => {
        const data = d.data();
        const createdAt = data.createdAt?.toMillis?.() ?? Date.now();
        if (createdAt < cutoff) return null;
        return {
          id: d.id, userId: data.userId ?? '', username: data.username ?? '',
          userAvatar: data.userAvatar ?? null, image: data.image ?? null,
          videoUri: data.videoUri ?? null, overlayText: data.overlayText ?? null,
          location: data.location ?? null, music: data.music ?? null,
          mentions: data.mentions ?? [], createdAt,
        } as FirestoreStory;
      }).filter(Boolean) as FirestoreStory[];
      setMyStories(stories.sort((a, b) => b.createdAt - a.createdAt));
    }).catch(() => {});
  }, []);

  const displayName = loggedInUser?.name || '';
  const rawUsername = loggedInUser?.username || '';
  const username = rawUsername.includes('@') ? (rawUsername.split('@')[0].replace(/[^a-zA-Z0-9._]/g, '') || '') : rawUsername;
  const bio = loggedInUser?.bio || '';
  const avatarUri = loggedInUser?.avatarUri || null;
  const coverPhotoUri = loggedInUser?.coverPhotoUri || null;

  const pickCoverPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access in your device settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;
    const localUri = result.assets[0].uri;
    // Show immediately while uploading
    setUser({ ...loggedInUser!, coverPhotoUri: localUri });
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const bucket = (storage.app.options as { storageBucket?: string }).storageBucket!;
      const storagePath = `covers/${firebaseUser.uid}/cover.jpg`;
      const encodedPath = encodeURIComponent(storagePath);
      const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodedPath}`;
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, localUri, {
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        httpMethod: 'POST',
        headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${idToken}` },
      });
      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        const { downloadTokens } = JSON.parse(uploadResult.body) as { downloadTokens: string };
        const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${downloadTokens}`;
        await setDoc(doc(db, 'users', firebaseUser.uid), { coverPhotoUri: url }, { merge: true });
        setUser({ ...loggedInUser!, coverPhotoUri: url });
      }
    } catch (_) {
      Alert.alert('Upload failed', 'Could not save cover photo. Try again.');
    }
  };

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
      mediaTypes: 'images',
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
    const firebaseUser = auth.currentUser;
    let finalAvatarUri = editAvatar;

    // Upload new avatar to Firebase Storage if it's a local URI
    if (editAvatar && !editAvatar.startsWith('http') && firebaseUser) {
      try {
        const idToken = await firebaseUser.getIdToken();
        const bucket = (storage.app.options as { storageBucket?: string }).storageBucket!;
        const storagePath = `avatars/${firebaseUser.uid}/avatar.jpg`;
        const encodedPath = encodeURIComponent(storagePath);
        const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodedPath}`;
        const result = await FileSystem.uploadAsync(uploadUrl, editAvatar, {
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          httpMethod: 'POST',
          headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${idToken}` },
        });
        if (result.status >= 200 && result.status < 300) {
          const { downloadTokens } = JSON.parse(result.body) as { downloadTokens: string };
          finalAvatarUri = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${downloadTokens}`;
        }
      } catch (_) {}
    }

    const updated = {
      id: firebaseUser?.uid ?? loggedInUser?.id ?? '',
      name: editUsername.trim().replace(/@/g, '') || username,
      username: editUsername.trim().replace(/@/g, '') || username,
      email: loggedInUser?.email ?? '',
      bio: editBio.trim(),
      avatarUri: finalAvatarUri,
      homeCountry: loggedInUser?.homeCountry ?? '',
      interests: loggedInUser?.interests ?? [],
    };
    setUser(updated);
    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          name: updated.name,
          username: updated.username,
          bio: updated.bio,
          avatarUri: updated.avatarUri,
        }, { merge: true });
      } catch (_) {}
    }
    setShowEdit(false);
  };



  // ── Edit Profile view ──────────────────────────────────────────────────────
  if (showEdit) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
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

        {/* Top-right controls */}
        <View style={styles.topControls}>
          {totalPendingRequests > 0 && (
            <TouchableOpacity style={styles.requestsBtn} onPress={() => setShowRequestsModal(true)}>
              <Text style={styles.settingsBtnText}>🔔</Text>
              <View style={styles.requestsBadge}>
                <Text style={styles.requestsBadgeText}>{totalPendingRequests}</Text>
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
            <Text style={styles.settingsBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Hero / Avatar */}
        <View style={styles.heroBanner}>
          {coverPhotoUri ? (
            <Image source={{ uri: coverPhotoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={theme.colors.gradientPrimary as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          {/* Dark overlay so avatar stays legible over bright photos */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.35)']}
            style={StyleSheet.absoluteFill}
          />
          {/* Camera button to change cover */}
          <TouchableOpacity style={styles.coverEditBtn} onPress={pickCoverPhoto} activeOpacity={0.8}>
            <Text style={{ fontSize: 16 }}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarWrapper} onPress={openEdit} activeOpacity={0.85}>
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
            <View style={styles.avatarEditBadge}>
              <Text style={{ fontSize: 11 }}>✏️</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.profileContent}>
          {/* Identity */}
          {!!displayName && <Text style={styles.displayName}>{displayName}</Text>}
          <Text style={styles.username}>{username ? `@${username}` : 'Set your username'}</Text>
          {!!bio && <Text style={styles.bio}>{bio}</Text>}


          {/* Stats */}
          <View style={styles.statsBlock}>
            {/* Social stats row */}
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.stat} onPress={() => setShowFollowersList(true)}>
                <Text style={styles.statValue}>{followerCount}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity style={styles.stat} onPress={() => setShowFollowingList(true)}>
                <Text style={styles.statValue}>{followingCount}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity style={styles.stat} onPress={() => setShowFriendsList(true)}>
                <Text style={styles.statValue}>{myFriends.length}</Text>
                <Text style={styles.statLabel}>Friends</Text>
              </TouchableOpacity>
            </View>
            {/* Info chips row */}
            <View style={styles.statsChipsRow}>
              <View style={styles.statsChip}>
                <Text style={styles.statsChipText}>🌍 {stamps.length} {stamps.length === 1 ? 'country' : 'countries'}</Text>
              </View>
              <View style={styles.statsChipDot} />
              <View style={styles.statsChip}>
                <Text style={styles.statsChipText}>📸 {myPosts.length} {myPosts.length === 1 ? 'post' : 'posts'}</Text>
              </View>
            </View>
          </View>

          {/* My Stories */}
          {myStories.length > 0 && (
            <View style={styles.storiesSection}>
              <Text style={styles.sectionTitle}>My Stories</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -theme.spacing.md }}>
                {myStories.map((story) => (
                  <TouchableOpacity
                    key={story.id}
                    style={styles.storyBubble}
                    activeOpacity={0.85}
                    onLongPress={() => {
                      Alert.alert(
                        'Delete Story',
                        'Remove this story? This cannot be undone.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete', style: 'destructive',
                            onPress: async () => {
                              await deleteStory(story.id);
                              setMyStories((prev) => prev.filter((s) => s.id !== story.id));
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <View style={styles.storyRing}>
                      {story.image ? (
                        <Image source={{ uri: story.image }} style={styles.storyAvatar} />
                      ) : avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.storyAvatar} />
                      ) : (
                        <LinearGradient colors={[theme.colors.primary, theme.colors.accent] as [string, string]} style={[styles.storyAvatar, { alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{displayName[0]?.toUpperCase() ?? '?'}</Text>
                        </LinearGradient>
                      )}
                    </View>
                    {!!story.location && <Text style={styles.storyLabel} numberOfLines={1}>{story.location}</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Posts / Archive tabs */}
          <View style={styles.profileTabs}>
            <TouchableOpacity
              style={[styles.profileTab, profileTab === 'posts' && styles.profileTabActive]}
              onPress={() => setProfileTab('posts')}
            >
              <Text style={[styles.profileTabText, profileTab === 'posts' && styles.profileTabTextActive]}>
                📸 Posts ({myPosts.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.profileTab, profileTab === 'archive' && styles.profileTabActive]}
              onPress={() => setProfileTab('archive')}
            >
              <Text style={[styles.profileTabText, profileTab === 'archive' && styles.profileTabTextActive]}>
                📦 Archive ({archivedPosts.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Posts grid */}
          {profileTab === 'posts' && (
            <View style={styles.postsSection}>
              {myPosts.length === 0 ? (
                <View style={styles.emptyPosts}>
                  <Text style={styles.emptyPostsIcon}>📸</Text>
                  <Text style={styles.emptyPostsText}>No posts yet</Text>
                  <Text style={styles.emptyPostsSub}>Your travel memories will appear here</Text>
                </View>
              ) : (
                <View style={styles.postsGrid}>
                  {myPosts.map((post) => {
                    const thumb = post.mediaItems?.[0]?.uri ?? post.imageUrl;
                    return (
                      <TouchableOpacity key={post.id} style={styles.gridItem} onPress={() => setSelectedPost(post)} activeOpacity={0.85}>
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={styles.gridImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.gridImage, { backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={{ fontSize: 28 }}>🗺️</Text>
                          </View>
                        )}
                        {post.mediaItems && post.mediaItems.length > 1 && (
                          <View style={styles.gridMultiBadge}>
                            <Text style={styles.gridMultiBadgeText}>⧉</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Archive grid */}
          {profileTab === 'archive' && (
            <View style={styles.postsSection}>
              {archivedPosts.length === 0 ? (
                <View style={styles.emptyPosts}>
                  <Text style={styles.emptyPostsIcon}>📦</Text>
                  <Text style={styles.emptyPostsText}>Archive is empty</Text>
                  <Text style={styles.emptyPostsSub}>Posts you archive will appear here</Text>
                </View>
              ) : (
                <View style={styles.postsGrid}>
                  {archivedPosts.map((post) => {
                    const thumb = post.mediaItems?.[0]?.uri ?? post.imageUrl;
                    return (
                      <TouchableOpacity
                        key={post.id}
                        style={styles.gridItem}
                        activeOpacity={0.85}
                        onPress={() => {
                          Alert.alert('Archived post', undefined, [
                            {
                              text: '↩ Restore to profile',
                              onPress: async () => {
                                try {
                                  await unarchivePostInFirestore(post.id);
                                  setArchivedPosts((prev) => prev.filter((p) => p.id !== post.id));
                                  setMyPosts((prev) => [{ ...post, archived: false }, ...prev]);
                                } catch {
                                  Alert.alert('Error', 'Could not restore post. Try again.');
                                }
                              },
                            },
                            {
                              text: '🗑️ Delete permanently',
                              style: 'destructive',
                              onPress: () =>
                                Alert.alert('Delete forever?', 'This cannot be undone.', [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: async () => {
                                      const { deletePostFromFirestore } = await import('../services/postsService');
                                      try {
                                        await deletePostFromFirestore(post.id);
                                        setArchivedPosts((prev) => prev.filter((p) => p.id !== post.id));
                                      } catch {
                                        Alert.alert('Error', 'Could not delete post. Try again.');
                                      }
                                    },
                                  },
                                ]),
                            },
                            { text: 'Cancel', style: 'cancel' },
                          ]);
                        }}
                      >
                        <View style={styles.archiveOverlay} />
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={[styles.gridImage, { opacity: 0.6 }]} resizeMode="cover" />
                        ) : (
                          <View style={[styles.gridImage, { backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', opacity: 0.6 }]}>
                            <Text style={{ fontSize: 28 }}>🗺️</Text>
                          </View>
                        )}
                        <View style={styles.archiveBadge}>
                          <Text style={styles.archiveBadgeText}>📦</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

        </View>

        <View style={{ height: theme.spacing.xxl }} />
      </ScrollView>

      {/* Friends List Modal */}
      <Modal visible={showFriendsList} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>👫 Friends</Text>
            <TouchableOpacity onPress={() => setShowFriendsList(false)}>
              <Text style={styles.pickerClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={myFriends}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>👫</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 15 }}>No friends yet</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.userListRow}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  onPress={() => { setShowFriendsList(false); navigation.navigate('OtherUserProfile', { userId: item.id }); }}
                  activeOpacity={0.8}
                >
                  <View style={styles.userListAvatar}>
                    {item.avatar
                      ? <Image source={{ uri: item.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                      : <Text style={{ fontSize: 20 }}>👤</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userListName}>{item.username}</Text>
                    <Text style={styles.userListSub}>@{item.username}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.friendMsgBtn}
                  onPress={async () => {
                    if (!loggedInUser) return;
                    try {
                      const conv = await getOrCreateDMConversation(
                        loggedInUser.id, loggedInUser.username, loggedInUser.avatarUri ?? null,
                        item.id, item.username, item.avatar ?? null,
                      );
                      setShowFriendsList(false);
                      navigation.navigate('Chat', { conversation: conv });
                    } catch {
                      Alert.alert('Error', 'Could not open chat. Try again.');
                    }
                  }}
                >
                  <Text style={{ fontSize: 18 }}>💬</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </Modal>

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
            data={followers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.userListRow}>
                <View style={styles.userListAvatar}>
                  {item.avatar
                    ? <Image source={{ uri: item.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                    : <Text style={{ fontSize: 20 }}>👤</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userListName}>{item.username}</Text>
                  <Text style={styles.userListHandle}>@{item.username}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 }}>No followers yet</Text>}
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
            data={following}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.userListRow}>
                <View style={styles.userListAvatar}>
                  {item.avatar
                    ? <Image source={{ uri: item.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                    : <Text style={{ fontSize: 20 }}>👤</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userListName}>{item.username}</Text>
                  <Text style={styles.userListHandle}>@{item.username}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 }}>No following yet</Text>}
          />
        </View>
      </Modal>

      {/* Requests Modal */}
      <Modal visible={showRequestsModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>🔔 Requests</Text>
            <TouchableOpacity onPress={() => setShowRequestsModal(false)}>
              <Text style={styles.pickerClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: theme.spacing.md }}>

            {/* Follow Requests */}
            {followRequests.length > 0 && (
              <View style={{ marginBottom: theme.spacing.lg }}>
                <Text style={styles.sectionTitle}>👤 Follow Requests ({followRequests.length})</Text>
                {followRequests.map((req) => (
                  <GlassCard key={req.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {req.avatar
                        ? <Image source={{ uri: req.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                        : <Text style={{ fontSize: 20 }}>👤</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>@{req.username}</Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>wants to follow you</Text>
                    </View>
                    <TouchableOpacity
                      style={{ backgroundColor: theme.colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 6 }}
                      onPress={async () => {
                        await acceptFollowRequest(req.id, auth.currentUser!.uid);
                        setFollowRequests((prev) => prev.filter((r) => r.id !== req.id));
                        setFollowerCount((c) => c + 1);
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 }}
                      onPress={async () => {
                        await declineFollowRequest(req.id, auth.currentUser!.uid);
                        setFollowRequests((prev) => prev.filter((r) => r.id !== req.id));
                      }}
                    >
                      <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Decline</Text>
                    </TouchableOpacity>
                  </GlassCard>
                ))}
              </View>
            )}

            {/* Friend Requests */}
            {friendRequests.length > 0 && (
              <View style={{ marginBottom: theme.spacing.lg }}>
                <Text style={styles.sectionTitle}>🤝 Friend Requests ({friendRequests.length})</Text>
                {friendRequests.map((req) => (
                  <GlassCard key={req.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {req.avatar
                        ? <Image source={{ uri: req.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                        : <Text style={{ fontSize: 20 }}>👤</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>@{req.username}</Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>sent you a friend request</Text>
                    </View>
                    <TouchableOpacity
                      style={{ backgroundColor: '#22c55e', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 6 }}
                      onPress={async () => {
                        await acceptFriendRequest(auth.currentUser!.uid, req.id);
                        setFriendRequests((prev) => prev.filter((r) => r.id !== req.id));
                        setMyFriends((prev) => [...prev, { id: req.id, username: req.username, avatar: req.avatar }]);
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 }}
                      onPress={async () => {
                        await declineFriendRequest(auth.currentUser!.uid, req.id);
                        setFriendRequests((prev) => prev.filter((r) => r.id !== req.id));
                      }}
                    >
                      <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Decline</Text>
                    </TouchableOpacity>
                  </GlassCard>
                ))}
              </View>
            )}

            {followRequests.length === 0 && friendRequests.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>✅</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 15 }}>No pending requests</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Post Preview Modal */}
      <Modal visible={!!selectedPost} animationType="slide" presentationStyle="pageSheet">
        {selectedPost && (
          <View style={[styles.pickerModal, { backgroundColor: theme.colors.background }]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{selectedPost.destination ?? 'Post'}</Text>
              <TouchableOpacity onPress={() => setSelectedPost(null)}>
                <Text style={styles.pickerClose}>✕</Text>
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
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>❤️ {selectedPost.likes}</Text>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>💬 {selectedPost.comments}</Text>
                </View>
                {selectedPost.mood?.length > 0 && (
                  <Text style={{ color: theme.colors.primary, fontSize: 13, marginTop: 8 }}>
                    {selectedPost.mood.join(' · ')}
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>⚙️ Settings</Text>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Text style={styles.pickerClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: theme.spacing.md }}>

            {/* Travel Style */}
            {(loggedInUser?.interests ?? []).length > 0 && (
              <View style={{ marginBottom: theme.spacing.lg }}>
                <Text style={styles.sectionTitle}>✈️ Travel Style</Text>
                <View style={styles.badgeRow}>
                  {(loggedInUser?.interests ?? []).map((badge, i) => (
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
            )}

            {/* Privacy */}
            <Text style={styles.sectionTitle}>🔒 Privacy</Text>
            <GlassCard style={[styles.privacyCard, { marginBottom: theme.spacing.lg }]}>
              <View style={styles.privacyRow}>
                <View style={styles.privacyInfo}>
                  <Text style={styles.privacyLabel}>Private Profile</Text>
                  <Text style={styles.privacySub}>Only approved followers see your posts</Text>
                </View>
                <Switch
                  value={privateProfile}
                  onValueChange={(v) => {
                    setPrivateProfile(v);
                    const uid = auth.currentUser?.uid;
                    if (uid) setDoc(doc(db, 'users', uid), { privateProfile: v }, { merge: true }).catch(() => {});
                  }}
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
                  onValueChange={(v) => {
                    setHideLocation(v);
                    const uid = auth.currentUser?.uid;
                    if (uid) setDoc(doc(db, 'users', uid), { hideExactLocation: v }, { merge: true }).catch(() => {});
                  }}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor="#fff"
                />
              </View>
              <View style={[styles.privacyRow, styles.borderTop]}>
                <View style={styles.privacyInfo}>
                  <Text style={styles.privacyLabel}>Allow Story Sharing</Text>
                  <Text style={styles.privacySub}>Let others share your posts to their story</Text>
                </View>
                <Switch
                  value={allowStoryShares}
                  onValueChange={async (v) => {
                    setAllowStoryShares(v);
                    const uid = auth.currentUser?.uid;
                    if (uid) { try { await setDoc(doc(db, 'users', uid), { allowStoryShares: v }, { merge: true }); } catch (_) {} }
                  }}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor="#fff"
                />
              </View>
              <View style={[styles.privacyRow, styles.borderTop]}>
                <View style={styles.privacyInfo}>
                  <Text style={styles.privacyLabel}>Allow Tagging</Text>
                  <Text style={styles.privacySub}>Let others tag you in posts and photos</Text>
                </View>
                <Switch
                  value={allowTagging}
                  onValueChange={async (v) => {
                    setAllowTagging(v);
                    const uid = auth.currentUser?.uid;
                    if (uid) { try { await setDoc(doc(db, 'users', uid), { allowTagging: v }, { merge: true }); } catch (_) {} }
                  }}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor="#fff"
                />
              </View>
              <View style={[styles.privacyRow, styles.borderTop]}>
                <View style={styles.privacyInfo}>
                  <Text style={styles.privacyLabel}>Friend List Visibility</Text>
                  <Text style={styles.privacySub}>Who can see your friends list</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, padding: 12, paddingTop: 0 }}>
                {(['public', 'friends', 'private'] as const).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={{
                      flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center',
                      backgroundColor: friendListVisibility === opt ? theme.colors.primary : theme.colors.surface,
                      borderWidth: 1, borderColor: friendListVisibility === opt ? theme.colors.primary : theme.colors.border,
                    }}
                    onPress={async () => {
                      setFriendListVisibility(opt);
                      const uid = auth.currentUser?.uid;
                      if (uid) { try { await setDoc(doc(db, 'users', uid), { friendListVisibility: opt }, { merge: true }); } catch (_) {} }
                    }}
                  >
                    <Text style={{ color: friendListVisibility === opt ? '#fff' : theme.colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{opt}</Text>
                  </TouchableOpacity>
                ))}
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
                      onPress={() => { setDefaultDelay(val); setShowDelayPicker(false); }}
                    >
                      <Text style={[styles.delayOptionText, defaultDelay === val && styles.delayOptionTextActive]}>{label}</Text>
                      {defaultDelay === val && <Text style={styles.delayCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </GlassCard>

            {/* Account */}
            <Text style={styles.sectionTitle}>👤 Account</Text>
            <GlassCard style={[styles.privacyCard, { marginBottom: theme.spacing.lg }]}>
              <TouchableOpacity style={styles.privacyRow} onPress={handleInvite}>
                <View style={styles.privacyInfo}>
                  <Text style={styles.privacyLabel}>✉️ Invite Friends</Text>
                  <Text style={styles.privacySub}>Share HiddenGems with people you know</Text>
                </View>
                <Text style={{ color: theme.colors.textSecondary }}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.privacyRow, styles.borderTop]} onPress={handleForgotPassword}>
                <View style={styles.privacyInfo}>
                  <Text style={styles.privacyLabel}>Reset Password</Text>
                  <Text style={styles.privacySub}>Send a reset link to your email</Text>
                </View>
                <Text style={{ color: theme.colors.textSecondary }}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.privacyRow, styles.borderTop]} onPress={handleLogout}>
                <View style={styles.privacyInfo}>
                  <Text style={[styles.privacyLabel, { color: '#ef4444' }]}>Log Out</Text>
                </View>
                <Text style={{ color: '#ef4444' }}>›</Text>
              </TouchableOpacity>
            </GlassCard>

          </ScrollView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topControls: {
    position: 'absolute',
    top: 12,
    right: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  heroBanner: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  coverEditBtn: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  avatarWrapper: {
    position: 'absolute',
    bottom: -44,
    alignSelf: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: theme.spacing.lg,
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
  statsChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.background,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  statsChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
  },
  statsChipText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  statsChipDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
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
  addTripBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  addTripBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
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
  friendMsgBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
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
    flex: 1,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    alignItems: 'center',
  },
  editBtnText: {
    color: theme.colors.primaryLight,
    ...theme.typography.caption,
    fontWeight: '700',
  },
  profileActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  settingsBtn: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestsBtn: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  requestsBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  requestsBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  settingsBtnText: {
    fontSize: 18,
  },
  storiesSection: {
    marginBottom: theme.spacing.lg,
  },
  storyBubble: {
    alignItems: 'center',
    marginLeft: theme.spacing.md,
    width: 70,
  },
  storyRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2.5,
    borderColor: theme.colors.primary,
    padding: 2,
    overflow: 'hidden',
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  storyLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 64,
  },
  postsSection: {
    marginBottom: theme.spacing.lg,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -1,
  },
  gridItem: {
    width: (SCREEN.width - theme.spacing.md * 2 - 2) / 3,
    aspectRatio: 1,
    margin: 1,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: theme.colors.surface,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridMultiBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  gridMultiBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyPosts: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyPostsIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyPostsText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyPostsSub: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  profileTabs: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  profileTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  profileTabActive: {
    backgroundColor: theme.colors.primary,
  },
  profileTabText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  profileTabTextActive: {
    color: '#fff',
  },
  archiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  archiveBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  archiveBadgeText: {
    fontSize: 12,
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
    paddingBottom: 100,
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
