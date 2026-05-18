import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { Conversation } from '../types';
import { auth, db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { RootStackParamList } from '../navigation/types';

export default function MessagesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', uid),
      orderBy('lastMessageAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const convs: Conversation[] = snap.docs.map((d) => {
        const data = d.data();
        const unreadCounts: Record<string, number> = data.unreadCounts ?? {};
        // For DMs, find the other participant
        const otherUserId = (data.participants as string[]).find((p: string) => p !== uid);
        const details: Record<string, { username: string; avatar: string | null }> =
          data.participantDetails ?? {};
        return {
          id: d.id,
          type: data.type ?? 'dm',
          otherUserId,
          otherUsername: otherUserId ? (details[otherUserId]?.username ?? 'traveller') : undefined,
          otherAvatar: otherUserId ? (details[otherUserId]?.avatar ?? null) : undefined,
          groupId: data.groupId,
          groupName: data.groupName,
          groupCover: data.groupCover,
          locationSharingEnabled: data.locationSharingEnabled ?? false,
          lastMessage: data.lastMessage,
          lastMessageAt: data.lastMessageAt instanceof Timestamp
            ? data.lastMessageAt.toDate().toISOString()
            : data.lastMessageAt,
          unreadCount: unreadCounts[uid] ?? 0,
        } as Conversation;
      });
      setConversations(convs);
    }, () => {});
    return () => unsub();
  }, []);

  const openConv = (conv: Conversation) => {
    const uid = auth.currentUser?.uid;
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    );
    // Reset unread count in Firestore
    if (uid) {
      updateDoc(doc(db, 'conversations', conv.id), {
        [`unreadCounts.${uid}`]: 0,
      }).catch(() => {});
    }
    navigation.navigate('Chat', { conversation: { ...conv, unreadCount: 0 } });
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / 3600000;
    if (diffH < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    const isDM = item.type === 'dm';
    const avatar = isDM ? item.otherAvatar : item.groupCover;
    const name = isDM ? `@${item.otherUsername}` : item.groupName;
    const badge = isDM ? null : item.locationSharingEnabled ? '📍' : null;

    return (
      <TouchableOpacity style={styles.row} onPress={() => openConv(item)} activeOpacity={0.75}>
        <View style={styles.avatarWrap}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={{ fontSize: 20 }}>{isDM ? '👤' : '👥'}</Text>
            </View>
          )}
          {!isDM && (
            <View style={styles.groupBadge}>
              <Text style={{ fontSize: 10 }}>👥</Text>
            </View>
          )}
        </View>

        <View style={styles.rowInfo}>
          <View style={styles.rowTop}>
            <Text style={styles.rowName} numberOfLines={1}>
              {name}{badge ? ` ${badge}` : ''}
            </Text>
            <Text style={styles.rowTime}>{formatTime(item.lastMessageAt)}</Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={styles.rowLast} numberOfLines={1}>
              {item.lastMessage ?? 'No messages yet'}
            </Text>
            {item.unreadCount > 0 && (
              <LinearGradient
                colors={theme.colors.gradientPrimary as [string, string]}
                style={styles.unreadBadge}
              >
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </LinearGradient>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const dms = conversations.filter((c) => c.type === 'dm');
  const groups = conversations.filter((c) => c.type === 'group');

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>DMs & group chats</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {dms.length > 0 && (
              <Text style={styles.sectionLabel}>Direct Messages</Text>
            )}
          </>
        }
        renderItem={({ item, index }) => {
          // Insert section header before first group chat
          const prevItem = conversations[index - 1];
          const showGroupHeader = item.type === 'group' && (!prevItem || prevItem.type !== 'group');
          return (
            <>
              {showGroupHeader && <Text style={styles.sectionLabel}>Group Chats</Text>}
              {renderItem({ item })}
            </>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyText}>No conversations yet.</Text>
            <Text style={styles.emptyHint}>Follow people and start chatting!</Text>
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
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
  list: {
    paddingBottom: 100,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    gap: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  groupBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowInfo: {
    flex: 1,
    gap: 3,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowName: {
    color: theme.colors.text,
    ...theme.typography.h3,
    flex: 1,
  },
  rowTime: {
    color: theme.colors.textMuted,
    ...theme.typography.tiny,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLast: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    flex: 1,
  },
  unreadBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: theme.spacing.sm,
  },
  emptyEmoji: {
    fontSize: 44,
  },
  emptyText: {
    color: theme.colors.text,
    ...theme.typography.h3,
  },
  emptyHint: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
  },
});
