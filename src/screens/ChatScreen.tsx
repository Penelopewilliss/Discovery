import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { theme } from '../theme';
import { Conversation, ChatMessage } from '../types';
import { auth, db } from '../firebase';
import {
  collection, addDoc, query, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { useUser } from '../context/UserContext';
import { RootStackParamList } from '../navigation/types';

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const conversation = route.params.conversation;
  const { user: loggedInUser } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [locationOn, setLocationOn] = useState(conversation.locationSharingEnabled ?? false);
  const flatRef = useRef<FlatList>(null);

  const myId = loggedInUser?.id ?? auth.currentUser?.uid ?? '';
  const myUsername = (loggedInUser?.username ?? 'traveler').replace(/@/g, '');
  const myAvatar = loggedInUser?.avatarUri ?? '';

  // Load messages in real time
  useEffect(() => {
    const q = query(
      collection(db, 'conversations', conversation.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs: ChatMessage[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          conversationId: conversation.id,
          senderId: data.senderId,
          senderUsername: data.senderUsername,
          senderAvatar: data.senderAvatar ?? '',
          text: data.text,
          createdAt: data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString(),
        } as ChatMessage;
      });
      setMessages(msgs);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 50);
    }, () => {});
    return () => unsub();
  }, [conversation.id]);

  const title = conversation.type === 'dm'
    ? `@${conversation.otherUsername}`
    : conversation.groupName ?? 'Group Chat';

  const subtitle = conversation.type === 'group'
    ? `${conversation.locationSharingEnabled ? '📍 Location sharing ON' : 'Group chat'}`
    : 'Direct Message';

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !myId) return;
    setInputText('');
    const messagesRef = collection(db, 'conversations', conversation.id, 'messages');
    await addDoc(messagesRef, {
      senderId: myId,
      senderUsername: myUsername,
      senderAvatar: myAvatar,
      text,
      createdAt: serverTimestamp(),
    });
    // Update conversation metadata
    await updateDoc(doc(db, 'conversations', conversation.id), {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
    }).catch(() => {});
  };

  const handleToggleLocation = async () => {
    const next = !locationOn;
    setLocationOn(next);
    await updateDoc(doc(db, 'conversations', conversation.id), {
      locationSharingEnabled: next,
    }).catch(() => {});
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMe = item.senderId === myId;
    const prevItem = messages[index - 1];
    const showAvatar = !isMe && (!prevItem || prevItem.senderId !== item.senderId);

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <View style={styles.avatarCol}>
            {showAvatar ? (
              <Image source={{ uri: item.senderAvatar }} style={styles.msgAvatar} />
            ) : (
              <View style={styles.msgAvatarGap} />
            )}
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          {!isMe && showAvatar && (
            <Text style={styles.senderName}>@{item.senderUsername}</Text>
          )}
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{formatTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {conversation.type === 'group' && conversation.groupCover ? (
            <Image source={{ uri: conversation.groupCover }} style={styles.headerAvatar} />
          ) : conversation.otherAvatar ? (
            <Image source={{ uri: conversation.otherAvatar }} style={styles.headerAvatar} />
          ) : null}
          <View>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          </View>
        </View>
      </View>

      {/* Location sharing banner for group chats */}
      {conversation.type === 'group' && (
        <View style={styles.locationBanner}>
          <View style={styles.locationInfo}>
            <Text style={styles.locationIcon}>📍</Text>
            <View>
              <Text style={styles.locationLabel}>Location Sharing</Text>
              <Text style={styles.locationHint}>
                {locationOn ? 'Members can see each other\'s location' : 'Turn on to share location with group'}
              </Text>
            </View>
          </View>
          <Switch
            value={locationOn}
            onValueChange={handleToggleLocation}
            trackColor={{ false: theme.colors.border, true: theme.colors.gradientPrimary[0] }}
            thumbColor="#fff"
          />
        </View>
      )}

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatEmoji}>💬</Text>
              <Text style={styles.emptyChatText}>No messages yet. Say hello!</Text>
            </View>
          }
          renderItem={renderMessage}
        />

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message..."
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity onPress={handleSend} disabled={!inputText.trim()}>
            <LinearGradient
              colors={inputText.trim() ? theme.colors.gradientPrimary as [string, string] : ['#333', '#333']}
              style={styles.sendBtn}
            >
              <Text style={styles.sendBtnText}>↑</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: theme.spacing.sm,
  },
  backText: {
    color: theme.colors.primaryLight,
    ...theme.typography.body,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerTitle: {
    color: theme.colors.text,
    ...theme.typography.h3,
  },
  headerSubtitle: {
    color: theme.colors.textMuted,
    ...theme.typography.tiny,
    marginTop: 1,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  locationIcon: {
    fontSize: 20,
  },
  locationLabel: {
    color: theme.colors.text,
    ...theme.typography.caption,
    fontWeight: '600',
  },
  locationHint: {
    color: theme.colors.textMuted,
    ...theme.typography.tiny,
    marginTop: 1,
  },
  messageList: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-end',
  },
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  avatarCol: {
    width: 32,
    marginRight: 6,
    alignItems: 'center',
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  msgAvatarGap: {
    width: 28,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bubbleMe: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    color: theme.colors.primaryLight,
    ...theme.typography.tiny,
    fontWeight: '700',
    marginBottom: 2,
  },
  bubbleText: {
    color: theme.colors.text,
    ...theme.typography.body,
  },
  bubbleTextMe: {
    color: '#fff',
  },
  msgTime: {
    color: theme.colors.textMuted,
    fontSize: 9,
    marginTop: 3,
    textAlign: 'right',
  },
  msgTimeMe: {
    color: 'rgba(255,255,255,0.6)',
  },
  emptyChat: {
    alignItems: 'center',
    paddingTop: 80,
    gap: theme.spacing.sm,
  },
  emptyChatEmoji: {
    fontSize: 40,
  },
  emptyChatText: {
    color: theme.colors.textMuted,
    ...theme.typography.body,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    ...theme.typography.body,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
