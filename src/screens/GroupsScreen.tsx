import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { theme } from '../theme';
import { auth, db, storage } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { createGroupInFirestore, joinGroup, leaveGroup, requestGroup, cancelRequestGroup, createGroupTrip, listenGroupTrips, listenGroupTripEntries, addGroupTripEntry } from '../services/postsService';
import { useUser } from '../context/UserContext';
import GroupCard from '../components/GroupCard';
import { Group, GroupTrip, GroupTripEntry } from '../types';

const FILTERS = ['All', 'Public', 'Private', 'Joined', 'Mine'];

export default function GroupsScreen() {
  const { user: loggedInUser } = useUser();
  const [filter, setFilter] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [detailJoined, setDetailJoined] = useState(false);
  const [detailMembers, setDetailMembers] = useState(0);
  const [detailRequested, setDetailRequested] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrivate, setNewPrivate] = useState(false);
  const [newLocationSharing, setNewLocationSharing] = useState(false);

  // ── Group Trips state ──────────────────────────────────────────────────────
  const [activeTrip, setActiveTrip] = useState<GroupTrip | null>(null);
  const [trips, setTrips] = useState<GroupTrip[]>([]);
  const [tripEntries, setTripEntries] = useState<GroupTripEntry[]>([]);
  const [showTrips, setShowTrips] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [showNewTripInput, setShowNewTripInput] = useState(false);
  const [newPinName, setNewPinName] = useState('');
  const [newPinNote, setNewPinNote] = useState('');
  const [showAddPin, setShowAddPin] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const forceUpdate = useCallback(() => {}, []);
  const uid = auth.currentUser?.uid ?? '';

  // Load groups from Firestore in real time
  useEffect(() => {
    const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const loaded: Group[] = snap.docs.map((d) => {
        const data = d.data();
        const members: string[] = data.members ?? [];
        const pending: string[] = data.pendingMembers ?? [];
        return {
          id: d.id,
          name: data.name ?? '',
          description: data.description ?? '',
          isPrivate: data.isPrivate ?? false,
          memberCount: data.memberCount ?? members.length,
          coverImage: data.coverImage ?? 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80',
          joined: members.includes(uid),
          requested: pending.includes(uid),
          createdByMe: data.createdBy === uid,
          locationSharingEnabled: data.locationSharingEnabled ?? false,
        } as Group;
      });
      setGroups(loaded);
    }, () => {});
    return () => unsub();
  }, [uid]);

  const openGroup = (group: Group) => {
    setDetailJoined(group.joined);
    setDetailMembers(group.memberCount);
    setDetailRequested(group.requested);
    setShowTrips(false);
    setActiveTrip(null);
    setTrips([]);
    setSelectedGroup(group);
  };

  const filtered = groups.filter((g) => {
    const matchesQuery =
      searchText.trim() === '' ||
      g.name.toLowerCase().includes(searchText.toLowerCase()) ||
      g.description.toLowerCase().includes(searchText.toLowerCase());

    if (!matchesQuery) return false;
    if (filter === 'Public') return !g.isPrivate;
    if (filter === 'Private') return g.isPrivate;
    if (filter === 'Joined') return g.joined;
    if (filter === 'Mine') return !!g.createdByMe;
    return true;
  });

  const handleCreate = async () => {
    if (!newName.trim()) {
      Alert.alert('Name required', 'Please give your group a name.');
      return;
    }
    if (!uid) return;
    await createGroupInFirestore(
      { name: newName.trim(), description: newDesc.trim() || 'No description yet.', isPrivate: newPrivate, locationSharingEnabled: newLocationSharing },
      uid
    ).catch(() => {});
    setNewName('');
    setNewDesc('');
    setNewPrivate(false);
    setNewLocationSharing(false);
    setShowCreate(false);
  };

  // ── Group Trips handlers ────────────────────────────────────────────────────
  const openTrips = (group: Group) => {
    setShowTrips(true);
    setActiveTrip(null);
    listenGroupTrips(group.id, setTrips);
  };

  const openTrip = (group: Group, trip: GroupTrip) => {
    setActiveTrip(trip);
    listenGroupTripEntries(group.id, trip.id, setTripEntries);
  };

  const handleCreateTrip = async (group: Group) => {
    if (!newTripName.trim() || !uid) return;
    await createGroupTrip(group.id, newTripName.trim(), uid).catch(() => {});
    setNewTripName('');
    setShowNewTripInput(false);
  };

  const handleAddPin = async (group: Group, trip: GroupTrip) => {
    if (!newPinName.trim() || !uid) return;
    await addGroupTripEntry(group.id, trip.id, {
      type: 'pin',
      userId: uid,
      username: loggedInUser?.username ?? 'traveler',
      userAvatar: loggedInUser?.avatarUri ?? null,
      placeName: newPinName.trim(),
      note: newPinNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    }).catch(() => {});
    setNewPinName('');
    setNewPinNote('');
    setShowAddPin(false);
  };

  const handleAddPhoto = async (group: Group, trip: GroupTrip) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    if (!uid) return;
    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const res = await fetch(uri);
      const blob = await res.blob();
      const photoRef = storageRef(storage, `groupTrips/${group.id}/${trip.id}/${Date.now()}.jpg`);
      await uploadBytes(photoRef, blob);
      const photoUri = await getDownloadURL(photoRef);
      await addGroupTripEntry(group.id, trip.id, {
        type: 'photo',
        userId: uid,
        username: loggedInUser?.username ?? 'traveler',
        userAvatar: loggedInUser?.avatarUri ?? null,
        photoUri,
        note: undefined,
        createdAt: new Date().toISOString(),
      });
    } catch (_) {}
    setUploadingPhoto(false);
  };

  // ── Group detail view ─────────────────────────────────────────────────────
  if (selectedGroup) {
    const group = groups.find((g) => g.id === selectedGroup.id) ?? selectedGroup;

    const handleDetailAction = () => {
      if (!uid) return;
      if (detailJoined) {
        setDetailMembers((prev) => prev - 1);
        setDetailJoined(false);
        leaveGroup(group.id, uid).catch(() => {});
      } else if (group.isPrivate) {
        setDetailRequested((prev) => !prev);
        detailRequested
          ? cancelRequestGroup(group.id, uid).catch(() => {})
          : requestGroup(group.id, uid).catch(() => {});
      } else {
        setDetailMembers((prev) => prev + 1);
        setDetailJoined(true);
        joinGroup(group.id, uid).catch(() => {});
      }
    };

    const actionLabel = detailJoined ? 'Leave Group' : group.isPrivate ? (detailRequested ? 'Requested' : 'Request Access') : 'Join Group';

    // ── Active trip view ────────────────────────────────────────────────────
    if (activeTrip) {
      return (
        <SafeAreaView style={styles.container} edges={[]}>
          <View style={styles.tripHeader}>
            <TouchableOpacity onPress={() => setActiveTrip(null)}>
              <Text style={styles.detailBackText}>← Trips</Text>
            </TouchableOpacity>
            <Text style={styles.tripTitle} numberOfLines={1}>{activeTrip.name}</Text>
            {detailJoined && (
              <View style={styles.tripActions}>
                <TouchableOpacity onPress={() => setShowAddPin(true)} style={styles.tripActionBtn}>
                  <Text style={styles.tripActionText}>📍 Pin</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleAddPhoto(group, activeTrip)} style={styles.tripActionBtn} disabled={uploadingPhoto}>
                  <Text style={styles.tripActionText}>{uploadingPhoto ? '⏳' : '📷 Photo'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {showAddPin && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.addPinCard}>
                <TextInput style={styles.pinInput} value={newPinName} onChangeText={setNewPinName}
                  placeholder="Place name (e.g. Sagrada Família)" placeholderTextColor={theme.colors.textMuted} />
                <TextInput style={[styles.pinInput, { marginTop: 8 }]} value={newPinNote} onChangeText={setNewPinNote}
                  placeholder="Note (optional)" placeholderTextColor={theme.colors.textMuted} />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity onPress={() => { setShowAddPin(false); setNewPinName(''); setNewPinNote(''); }}
                    style={[styles.pinBtn, { flex: 1, backgroundColor: theme.colors.surface }]}>
                    <Text style={{ color: theme.colors.textSecondary }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleAddPin(group, activeTrip)}
                    style={[styles.pinBtn, { flex: 1 }]}>
                    <LinearGradient colors={theme.colors.gradientPrimary as [string, string]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill as any} />
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Drop Pin</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}

          <FlatList
            data={tripEntries}
            keyExtractor={(e) => e.id}
            contentContainerStyle={{ padding: theme.spacing.md }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>{detailJoined ? '📍' : '🔒'}</Text>
                <Text style={styles.emptyText}>{detailJoined ? 'No entries yet.\nAdd a pin or photo above!' : 'Join the group to add memories.'}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  {item.userAvatar
                    ? <Image source={{ uri: item.userAvatar }} style={styles.entryAvatar} />
                    : <View style={[styles.entryAvatar, { backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text>👤</Text>
                      </View>}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryUser}>@{item.username}</Text>
                    <Text style={styles.entryTime}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <Text style={{ fontSize: 20 }}>{item.type === 'pin' ? '📍' : '📷'}</Text>
                </View>
                {item.type === 'pin' && (
                  <View>
                    <Text style={styles.entryPlace}>{item.placeName}</Text>
                    {item.note ? <Text style={styles.entryNote}>{item.note}</Text> : null}
                  </View>
                )}
                {item.type === 'photo' && item.photoUri && (
                  <Image source={{ uri: item.photoUri }} style={styles.entryPhoto} resizeMode="cover" />
                )}
                {item.type === 'photo' && item.note ? <Text style={styles.entryNote}>{item.note}</Text> : null}
              </View>
            )}
          />
        </SafeAreaView>
      );
    }

    // ── Trips list view ─────────────────────────────────────────────────────
    if (showTrips) {
      return (
        <SafeAreaView style={styles.container} edges={[]}>
          <View style={styles.tripHeader}>
            <TouchableOpacity onPress={() => setShowTrips(false)}>
              <Text style={styles.detailBackText}>← Group</Text>
            </TouchableOpacity>
            <Text style={styles.tripTitle}>Group Trips</Text>
            {detailJoined && (
              <TouchableOpacity onPress={() => setShowNewTripInput((v) => !v)} style={styles.tripActionBtn}>
                <Text style={styles.tripActionText}>+ New</Text>
              </TouchableOpacity>
            )}
          </View>
          {showNewTripInput && (
            <View style={styles.addPinCard}>
              <TextInput style={styles.pinInput} value={newTripName} onChangeText={setNewTripName}
                placeholder="Trip name (e.g. Brothers Spain 2026)" placeholderTextColor={theme.colors.textMuted} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity onPress={() => { setShowNewTripInput(false); setNewTripName(''); }}
                  style={[styles.pinBtn, { flex: 1, backgroundColor: theme.colors.surface }]}>
                  <Text style={{ color: theme.colors.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleCreateTrip(group)} style={[styles.pinBtn, { flex: 1 }]}>
                  <LinearGradient colors={theme.colors.gradientPrimary as [string, string]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill as any} />
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <FlatList
            data={trips}
            keyExtractor={(t) => t.id}
            contentContainerStyle={{ padding: theme.spacing.md }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🗺️</Text>
                <Text style={styles.emptyText}>{detailJoined ? 'No trips yet. Tap "+ New" to start one!' : 'Join the group to create trips.'}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => openTrip(group, item)} style={styles.tripCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripCardName}>{item.name}</Text>
                  <Text style={styles.tripCardMeta}>{item.entryCount} entries · {new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text style={{ color: theme.colors.textSecondary }}>›</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ height: 240 }}>
            <Image source={{ uri: group.coverImage }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            <LinearGradient colors={['transparent', theme.colors.background]} style={StyleSheet.absoluteFillObject as any} />
            <TouchableOpacity style={styles.detailBack} onPress={() => setSelectedGroup(null)}>
              <Text style={styles.detailBackText}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.detailHeroContent}>
              <View style={[styles.detailBadge, group.isPrivate ? styles.badgePrivate : styles.badgePublic]}>
                <Text style={styles.detailBadgeText}>{group.isPrivate ? '🔒 Private' : '🌐 Public'}</Text>
              </View>
              <Text style={styles.detailName}>{group.name}</Text>
              <Text style={styles.detailMemberCount}>👥 {detailMembers.toLocaleString()} members</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md }}>
            <Text style={styles.detailDesc}>{group.description}</Text>

            {group.locationSharingEnabled && (
              <View style={styles.detailFeature}>
                <Text style={styles.detailFeatureText}>📍 Location sharing enabled — members can see each other live</Text>
              </View>
            )}

            <TouchableOpacity onPress={handleDetailAction} style={styles.detailActionWrap}>
              <LinearGradient
                colors={detailJoined ? ['#333', '#444'] : theme.colors.gradientPrimary as [string, string]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.detailActionBtn}
              >
                <Text style={styles.detailActionText}>{actionLabel}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {(detailJoined || group.createdByMe) && (
              <TouchableOpacity onPress={() => openTrips(group)} style={[styles.detailActionWrap, { marginTop: 12 }]}>
                <View style={[styles.detailActionBtn, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
                  <Text style={[styles.detailActionText, { color: theme.colors.text }]}>🗺️ Group Trips</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (showCreate) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.createContainer} keyboardShouldPersistTaps="handled">
            {/* Create header */}
            <View style={styles.createHeader}>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={styles.createCancel}>✕ Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.createTitle}>New Group</Text>
              <TouchableOpacity onPress={handleCreate}>
                <LinearGradient
                  colors={theme.colors.gradientPrimary as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.createSaveBtn}
                >
                  <Text style={styles.createSaveBtnText}>Create</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Text style={styles.createLabel}>Group Name</Text>
            <TextInput
              style={styles.createInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Summer Europe 2026"
              placeholderTextColor={theme.colors.textMuted}
              maxLength={60}
            />

            <Text style={[styles.createLabel, { marginTop: theme.spacing.md }]}>Description</Text>
            <TextInput
              style={[styles.createInput, styles.createBioInput]}
              value={newDesc}
              onChangeText={(t) => setNewDesc(t.slice(0, 200))}
              placeholder="What's this group about?"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              maxLength={200}
            />
            <Text style={styles.charCount}>{newDesc.length}/200</Text>

            <View style={styles.privateRow}>
              <View>
                <Text style={styles.createLabel}>Private Group</Text>
                <Text style={styles.privateHint}>Only invited members can see & join</Text>
              </View>
              <Switch
                value={newPrivate}
                onValueChange={setNewPrivate}
                trackColor={{ false: theme.colors.border, true: theme.colors.gradientPrimary[0] }}
                thumbColor="#fff"
              />
            </View>

            <View style={[styles.privateRow, { marginTop: theme.spacing.sm }]}>
              <View>
                <Text style={styles.createLabel}>📍 Location Sharing</Text>
                <Text style={styles.privateHint}>Members can share & see each other's location</Text>
              </View>
              <Switch
                value={newLocationSharing}
                onValueChange={setNewLocationSharing}
                trackColor={{ false: theme.colors.border, true: theme.colors.gradientPrimary[0] }}
                thumbColor="#fff"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Groups</Text>
          <Text style={styles.subtitle}>Travel communities & private circles</Text>
        </View>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.createBtnWrapper}>
          <LinearGradient
            colors={theme.colors.gradientPrimary as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createBtn}
          >
            <Text style={styles.createBtnText}>+ Create</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search groups..."
          placeholderTextColor={theme.colors.textMuted}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={styles.filterBtnWrapper}>
            {filter === f ? (
              <LinearGradient
                colors={theme.colors.gradientPrimary as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.filterBtn}
              >
                <Text style={styles.filterTextActive}>{f}</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.filterBtn, styles.filterBtnInactive]}>
                <Text style={styles.filterText}>{f}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Groups list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openGroup(item)} activeOpacity={0.85}>
            <GroupCard group={item} onUpdate={forceUpdate} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyText}>No groups found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // ── Trip styles ────────────────────────────────────────────────────────────
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 8,
  },
  tripTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  tripActions: { flexDirection: 'row', gap: 6 },
  tripActionBtn: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tripActionText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tripCardName: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  tripCardMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  addPinCard: {
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pinInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    padding: 10,
    color: theme.colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pinBtn: {
    borderRadius: theme.borderRadius.full,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  entryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  entryAvatar: { width: 36, height: 36, borderRadius: 18 },
  entryUser: { color: theme.colors.text, fontWeight: '600', fontSize: 13 },
  entryTime: { color: theme.colors.textMuted, fontSize: 11 },
  entryPlace: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  entryNote: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 },
  entryPhoto: { width: '100%', height: 200, borderRadius: theme.borderRadius.sm, marginTop: 4 },
  // ── Existing styles ────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  createBtnWrapper: {
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  createBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
  },
  createBtnText: {
    color: '#fff',
    ...theme.typography.caption,
    fontWeight: '700',
  },
  createContainer: {
    padding: theme.spacing.md,
  },
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  createCancel: {
    color: theme.colors.textMuted,
    ...theme.typography.body,
  },
  createTitle: {
    color: theme.colors.text,
    ...theme.typography.h2,
  },
  createSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
  },
  createSaveBtnText: {
    color: '#fff',
    ...theme.typography.caption,
    fontWeight: '700',
  },
  createLabel: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    marginBottom: 6,
  },
  createInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    ...theme.typography.body,
  },
  createBioInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    color: theme.colors.textMuted,
    ...theme.typography.tiny,
    textAlign: 'right',
    marginTop: 4,
  },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  privateHint: {
    color: theme.colors.textMuted,
    ...theme.typography.tiny,
    marginTop: 2,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.full,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    ...theme.typography.body,
  },
  clearIcon: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  filterBtnWrapper: {
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
  },
  filterBtnInactive: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterText: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
  },
  filterTextActive: {
    color: '#fff',
    ...theme.typography.caption,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 100,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: theme.spacing.sm,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyText: {
    color: theme.colors.textMuted,
    ...theme.typography.body,
  },
  // Group detail styles
  detailBack: { position: 'absolute', top: 16, left: 16, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  detailBackText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  detailHeroContent: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  detailBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: theme.borderRadius.full, alignSelf: 'flex-start', marginBottom: 6 },
  badgePublic: { backgroundColor: 'rgba(124,92,252,0.4)', borderWidth: 1, borderColor: theme.colors.primary },
  badgePrivate: { backgroundColor: 'rgba(252,92,125,0.4)', borderWidth: 1, borderColor: theme.colors.accent },
  detailBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  detailName: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  detailMemberCount: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  detailDesc: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: theme.spacing.md },
  detailFeature: { backgroundColor: 'rgba(124,92,252,0.12)', borderWidth: 1, borderColor: 'rgba(124,92,252,0.3)', borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  detailFeatureText: { color: theme.colors.primary, fontSize: 13 },
  detailActionWrap: { borderRadius: theme.borderRadius.full, overflow: 'hidden', marginTop: theme.spacing.sm },
  detailActionBtn: { paddingVertical: 14, borderRadius: theme.borderRadius.full, alignItems: 'center' },
  detailActionText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
