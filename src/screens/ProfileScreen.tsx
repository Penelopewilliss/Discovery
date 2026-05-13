import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme';
import { mockUser, mockStamps, mockPosts } from '../data/mockData';
import GlassCard from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { PostDelay } from '../types';

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
  const { user: loggedInUser, setUser } = useUser();
  const user = mockUser;
  const [privateProfile, setPrivateProfile] = useState(user.privateProfile);
  const [hideLocation, setHideLocation] = useState(user.hideExactLocation);
  const [defaultDelay, setDefaultDelay] = useState<PostDelay>(user.defaultDelayedPosting);
  const [showDelayPicker, setShowDelayPicker] = useState(false);

  // Edit profile
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(loggedInUser?.name ?? '');
  const [editUsername, setEditUsername] = useState(loggedInUser?.username ?? '');
  const [editBio, setEditBio] = useState(loggedInUser?.bio ?? '');
  const [editAvatar, setEditAvatar] = useState(loggedInUser?.avatarUri ?? null);

  const displayName = loggedInUser?.name || user.displayName;
  const rawUsername = loggedInUser?.username || user.username;
  const username = rawUsername.includes('@') ? (rawUsername.split('@')[0].replace(/[^a-zA-Z0-9._]/g, '') || 'traveler') : rawUsername;
  const bio = loggedInUser?.bio || user.bio;
  const avatarUri = loggedInUser?.avatarUri || user.avatar;

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    const updated = {
      name: editUsername.trim().replace(/@/g, '') || username,
      username: editUsername.trim().replace(/@/g, '') || username,
      email: loggedInUser?.email ?? '',
      bio: editBio.trim(),
      avatarUri: editAvatar,
      homeCountry: loggedInUser?.homeCountry ?? '',
      interests: loggedInUser?.interests ?? [],
    };
    setUser(updated);
    try {
      await AsyncStorage.setItem('@travlora_user', JSON.stringify(updated));
    } catch (_) {}
    setShowEdit(false);
  };

  const savedPosts = mockPosts.filter((p) => user.savedPosts.includes(p.id));

  // ── Edit Profile view ──────────────────────────────────────────────────────
  if (showEdit) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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

        {/* Hero / Avatar */}
        <LinearGradient
          colors={theme.colors.gradientPrimary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.avatarWrapper}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.accent]}
                style={[styles.avatar, styles.avatarFallback]}
              >
                <Text style={styles.avatarInitial}>{displayName[0]?.toUpperCase()}</Text>
              </LinearGradient>
            )}
            <View style={styles.avatarBorder} />
          </View>
        </LinearGradient>

        <View style={styles.profileContent}>
          {/* Identity */}
          <Text style={styles.displayName}>@{username}</Text>
          {!!bio && <Text style={styles.bio}>{bio}</Text>}

          {/* Edit Profile button */}
          <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
            <Text style={styles.editBtnText}>✏️  Edit Profile</Text>
          </TouchableOpacity>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{user.countriesVisited.length}</Text>
              <Text style={styles.statLabel}>Countries</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{user.placesFollowed.length}</Text>
              <Text style={styles.statLabel}>Places</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{savedPosts.length}</Text>
              <Text style={styles.statLabel}>Saved</Text>
            </View>
          </View>

          {/* Travel style badges */}
          <View style={styles.badgesSection}>
            <Text style={styles.sectionTitle}>Travel Style</Text>
            <View style={styles.badgeRow}>
              {user.travelStyleBadges.map((badge, i) => (
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

          {/* Travel Passport */}
          <Text style={styles.sectionTitle}>✈️ Travel Passport</Text>
          <GlassCard style={styles.passportCard}>
            <Text style={styles.passportHeader}>Visited Countries</Text>
            <View style={styles.stampsGrid}>
              {mockStamps.map((stamp) => (
                <View key={stamp.country} style={styles.stamp}>
                  <Text style={styles.stampEmoji}>{stamp.emoji}</Text>
                  <Text style={styles.stampCountry}>{stamp.country}</Text>
                  <Text style={styles.stampDate}>{stamp.visitedAt}</Text>
                </View>
              ))}
            </View>
          </GlassCard>

          {/* Saved Posts */}
          {savedPosts.length > 0 && (
            <View style={styles.savedSection}>
              <Text style={styles.sectionTitle}>🔖 Saved Posts</Text>
              {savedPosts.map((post) => (
                <GlassCard key={post.id} style={styles.savedCard}>
                  <Image source={{ uri: post.imageUrl }} style={styles.savedImage} resizeMode="cover" />
                  <View style={styles.savedInfo}>
                    <Text style={styles.savedDestination}>{post.destination}</Text>
                    <Text style={styles.savedCaption} numberOfLines={2}>{post.caption}</Text>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}

          {/* Privacy settings */}
          <Text style={[styles.sectionTitle, { marginTop: theme.spacing.lg }]}>🔒 Privacy Settings</Text>
          <GlassCard style={styles.privacyCard}>
            <View style={styles.privacyRow}>
              <View style={styles.privacyInfo}>
                <Text style={styles.privacyLabel}>Private Profile</Text>
                <Text style={styles.privacySub}>Only approved followers see your posts</Text>
              </View>
              <Switch
                value={privateProfile}
                onValueChange={setPrivateProfile}
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
                onValueChange={setHideLocation}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#fff"
              />
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
                    onPress={() => {
                      setDefaultDelay(val);
                      setShowDelayPicker(false);
                    }}
                  >
                    <Text style={[styles.delayOptionText, defaultDelay === val && styles.delayOptionTextActive]}>
                      {label}
                    </Text>
                    {defaultDelay === val && <Text style={styles.delayCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </GlassCard>
        </View>

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
  heroBanner: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  avatarWrapper: {
    position: 'absolute',
    bottom: -44,
    alignSelf: 'center',
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.xl,
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
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  editBtnText: {
    color: theme.colors.primaryLight,
    ...theme.typography.caption,
    fontWeight: '700',
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
});
