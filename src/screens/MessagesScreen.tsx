import React, { useState } from 'react';
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
import { theme } from '../theme';
import { Conversation } from '../types';
import { mockConversations } from '../data/mockData';
import ChatScreen from './ChatScreen';

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / 3600000;
    if (diffH < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const openConv = (conv: Conversation) => {
    // Mark as read
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    );
    setActiveConv({ ...conv, unreadCount: 0 });
  };

  if (activeConv) {
    return (
      <ChatScreen
        conversation={activeConv}
        onBack={() => {
          setActiveConv(null);
          setConversations([...mockConversations]);
        }}
      />
    );
  }

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
    <SafeAreaView style={styles.container} edges={['top']}>
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
    paddingBottom: theme.spacing.xxl,
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
