import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { mockGroups, addGroup } from '../data/mockData';
import GroupCard from '../components/GroupCard';

const FILTERS = ['All', 'Public', 'Private', 'Joined', 'Mine'];

export default function GroupsScreen() {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrivate, setNewPrivate] = useState(false);
  const [newLocationSharing, setNewLocationSharing] = useState(false);

  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  const filtered = mockGroups.filter((g) => {
    const matchesQuery =
      query.trim() === '' ||
      g.name.toLowerCase().includes(query.toLowerCase()) ||
      g.description.toLowerCase().includes(query.toLowerCase());

    if (!matchesQuery) return false;
    if (filter === 'Public') return !g.isPrivate;
    if (filter === 'Private') return g.isPrivate;
    if (filter === 'Joined') return g.joined;
    if (filter === 'Mine') return !!g.createdByMe;
    return true;
  });

  const handleCreate = () => {
    if (!newName.trim()) {
      Alert.alert('Name required', 'Please give your group a name.');
      return;
    }
    addGroup({
      name: newName.trim(),
      description: newDesc.trim() || 'No description yet.',
      isPrivate: newPrivate,
      memberCount: 1,
      coverImage: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80',
      joined: true,
      requested: false,
      createdByMe: true,
      locationSharingEnabled: newLocationSharing,
    });
    setNewName('');
    setNewDesc('');
    setNewPrivate(false);
    setNewLocationSharing(false);
    setShowCreate(false);
    forceUpdate();
  };

  if (showCreate) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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
    <SafeAreaView style={styles.container} edges={['top']}>
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
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
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
        keyExtractor={(item) => item.id + tick}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <GroupCard group={item} onUpdate={forceUpdate} />
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
    ...theme.typography.title,
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
    paddingBottom: theme.spacing.xxl,
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
});
