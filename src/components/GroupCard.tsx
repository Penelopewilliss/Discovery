import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Group } from '../types';
import { theme } from '../theme';
import { joinGroup, leaveGroup, requestGroup, cancelRequestGroup } from '../services/postsService';
import { useUser } from '../context/UserContext';

interface GroupCardProps {
  group: Group;
  onUpdate: () => void;
}

export default function GroupCard({ group, onUpdate }: GroupCardProps) {
  const { user: loggedInUser } = useUser();
  const [joined, setJoined] = useState(group.joined);
  const [requested, setRequested] = useState(group.requested);
  const [members, setMembers] = useState(group.memberCount);

  const handleAction = () => {
    const uid = loggedInUser?.id;
    if (!uid) return;
    if (joined) {
      setMembers((prev) => prev - 1);
      setJoined(false);
      leaveGroup(group.id, uid).catch(() => {});
    } else if (group.isPrivate) {
      if (requested) {
        setRequested(false);
        cancelRequestGroup(group.id, uid).catch(() => {});
      } else {
        setRequested(true);
        requestGroup(group.id, uid).catch(() => {});
      }
    } else {
      setMembers((prev) => prev + 1);
      setJoined(true);
      joinGroup(group.id, uid).catch(() => {});
    }
    onUpdate();
  };

  const formatMembers = (n: number) => {
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  };

  const getActionLabel = () => {
    if (joined) return 'Joined ✓';
    if (group.isPrivate) return requested ? 'Requested' : 'Request Access';
    return 'Join Group';
  };

  return (
    <View style={styles.card}>
      <Image source={{ uri: group.coverImage }} style={styles.coverImage} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.gradient}
      />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={[styles.badge, group.isPrivate ? styles.badgePrivate : styles.badgePublic]}>
            <Text style={styles.badgeText}>{group.isPrivate ? '🔒 Private' : '🌐 Public'}</Text>
          </View>
          <Text style={styles.members}>👥 {formatMembers(members)} members</Text>
        </View>
        <Text style={styles.name}>{group.name}</Text>
        <Text style={styles.description} numberOfLines={2}>{group.description}</Text>
        <TouchableOpacity onPress={handleAction} style={styles.actionBtn}>
          {joined ? (
            <View style={styles.actionBtnInner}>
              <Text style={styles.actionBtnTextJoined}>{getActionLabel()}</Text>
            </View>
          ) : (
            <LinearGradient
              colors={requested ? [theme.colors.surfaceElevated, theme.colors.surfaceElevated] : theme.colors.gradientPrimary as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtnInner}
            >
              <Text style={[styles.actionBtnText, requested && styles.actionBtnTextRequested]}>
                {getActionLabel()}
              </Text>
            </LinearGradient>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 220,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '75%',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  badgePublic: {
    backgroundColor: 'rgba(124, 92, 252, 0.4)',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  badgePrivate: {
    backgroundColor: 'rgba(252, 92, 125, 0.4)',
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  badgeText: {
    color: '#fff',
    ...theme.typography.tiny,
    fontWeight: '600',
  },
  members: {
    color: theme.colors.textSecondary,
    ...theme.typography.caption,
  },
  name: {
    color: theme.colors.text,
    ...theme.typography.h2,
    marginBottom: theme.spacing.xs,
  },
  description: {
    color: theme.colors.textSecondary,
    ...theme.typography.caption,
    marginBottom: theme.spacing.sm,
    lineHeight: 18,
  },
  actionBtn: {
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  actionBtnInner: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionBtnText: {
    color: '#fff',
    ...theme.typography.caption,
    fontWeight: '700',
  },
  actionBtnTextJoined: {
    color: theme.colors.primaryLight,
    ...theme.typography.caption,
    fontWeight: '700',
  },
  actionBtnTextRequested: {
    color: theme.colors.textMuted,
  },
});
