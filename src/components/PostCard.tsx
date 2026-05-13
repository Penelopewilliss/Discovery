import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Post, PostDelay, Comment } from '../types';
import { theme } from '../theme';
import { toggleLike, toggleSave, toggleReaction, getComments, addComment } from '../data/mockData';
import { useUser } from '../context/UserContext';

const { width } = Dimensions.get('window');

const TAG_COLORS: Record<string, string[]> = {
  beach: ['#00C2FF', '#0072FF'],
  food: ['#FF6B35', '#FF3B5C'],
  'hidden gem': ['#7C5CFC', '#9B7DFF'],
  city: ['#4A90D9', '#357ABD'],
  nature: ['#11998e', '#38ef7d'],
  budget: ['#F7971E', '#FFD200'],
  luxury: ['#C9A84C', '#FFD700'],
  adventure: ['#FC5C7D', '#6A3093'],
  culture: ['#8E54E9', '#4776E6'],
  solo: ['#56CCF2', '#2F80ED'],
};

const DELAY_LABELS: Record<PostDelay, string | null> = {
  now: null,
  '6h': 'Posted 6h later for privacy',
  '24h': 'Posted 24h later for privacy',
  '48h': 'Posted 48h later for privacy',
  'after leaving': 'Posted after leaving destination',
  'after trip': 'Posted after trip ended',
};

interface PostCardProps {
  post: Post;
  onUpdate: () => void;
}

export default function PostCard({ post, onUpdate }: PostCardProps) {
  const { user: loggedInUser } = useUser();
  const [liked, setLiked] = useState(post.liked);
  const [saved, setSaved] = useState(post.saved);
  const [likes, setLikes] = useState(post.likes);
  const [reactions, setReactions] = useState(post.reactions);
  const [userReaction, setUserReaction] = useState(post.userReaction);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>(() => getComments(post.id));
  const [commentCount, setCommentCount] = useState(post.comments);
  const [commentText, setCommentText] = useState('');

  const REACTION_EMOJIS = ['❤️', '🔥', '😮', '😂', '✈️', '🌍'];

  const handleLike = () => {
    toggleLike(post.id);
    setLikes((prev) => (liked ? prev - 1 : prev + 1));
    setLiked((prev) => !prev);
    onUpdate();
  };

  const handleSave = () => {
    toggleSave(post.id);
    setSaved((prev) => !prev);
    onUpdate();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this travel post on TRAVLORA!\n\n"${post.caption}"\n\n📍 ${post.locationArea}`,
        title: 'TRAVLORA',
      });
    } catch (_) {}
  };

  const handleReaction = (emoji: string) => {
    toggleReaction(post.id, emoji);
    const newReactions = { ...reactions };
    if (userReaction) {
      newReactions[userReaction] = Math.max(0, (newReactions[userReaction] || 1) - 1);
      if (newReactions[userReaction] === 0) delete newReactions[userReaction];
    }
    const next = userReaction === emoji ? null : emoji;
    if (next) newReactions[next] = (newReactions[next] || 0) + 1;
    setReactions(newReactions);
    setUserReaction(next);
    setShowReactionPicker(false);
    onUpdate();
  };

  const handleSendComment = () => {
    const text = commentText.trim();
    if (!text) return;
    const newComment = addComment(post.id, text, {
      userId: loggedInUser?.email ?? 'me',
      username: (loggedInUser?.username ?? 'traveler').replace(/@/g, ''),
      userAvatar: loggedInUser?.avatarUri ?? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80',
    });
    setComments((prev) => [newComment, ...prev]);
    setCommentCount((prev) => prev + 1);
    setCommentText('');
    onUpdate();
  };

  const delayLabel = DELAY_LABELS[post.delay];

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Image source={{ uri: post.userAvatar }} style={styles.avatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.username}>@{post.username}</Text>
          <Text style={styles.location}>
            📍 {post.blurLocation ? post.locationArea.split(',')[0].trim() + ' region' : post.locationArea}
          </Text>
        </View>
        <View style={styles.moodBadge}>
          <Text style={styles.moodText}>{post.mood}</Text>
        </View>
      </View>

      {/* Image */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: post.imageUrl }} style={styles.image} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.imageGradient}
        />
        {delayLabel && (
          <View style={styles.delayBadge}>
            <Text style={styles.delayText}>🔒 {delayLabel}</Text>
          </View>
        )}
      </View>

      {/* Tags */}
      <View style={styles.tags}>
        {post.tags.map((tag) => {
          const colors = TAG_COLORS[tag] ?? ['#7C5CFC', '#FC5C7D'];
          return (
            <LinearGradient
              key={tag}
              colors={colors as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.tag}
            >
              <Text style={styles.tagText}>{tag}</Text>
            </LinearGradient>
          );
        })}
      </View>

      {/* Caption */}
      <Text style={styles.caption}>{post.caption}</Text>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <Text style={[styles.actionIcon, liked && styles.likedIcon]}>
            {liked ? '❤️' : '🤍'}
          </Text>
          <Text style={styles.actionCount}>{likes.toLocaleString()}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(true)}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{commentCount.toLocaleString()}</Text>
        </TouchableOpacity>

        {post.reactionsEnabled && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowReactionPicker((v) => !v)}>
            <Text style={styles.actionIcon}>{userReaction ?? '😊'}</Text>
            <Text style={styles.actionCount}>React</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Text style={styles.actionIcon}>📤</Text>
          <Text style={styles.actionCount}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleSave}>
          <Text style={styles.actionIcon}>{saved ? '🔖' : '🏷️'}</Text>
          <Text style={styles.actionCount}>{saved ? 'Saved' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      {/* Reaction picker */}
      {showReactionPicker && post.reactionsEnabled && (
        <View style={styles.reactionPicker}>
          {REACTION_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => handleReaction(emoji)}
              style={[styles.reactionOption, userReaction === emoji && styles.reactionOptionActive]}
            >
              <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Reaction counts */}
      {post.reactionsEnabled && Object.keys(reactions).length > 0 && (
        <View style={styles.reactionCounts}>
          {Object.entries(reactions).map(([emoji, count]) => (
            <View key={emoji} style={[styles.reactionCount, userReaction === emoji && styles.reactionCountActive]}>
              <Text style={styles.reactionCountEmoji}>{emoji}</Text>
              <Text style={styles.reactionCountText}>{count}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Comments modal */}
      <Modal
        visible={showComments}
        animationType="slide"
        transparent
        onRequestClose={() => setShowComments(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowComments(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalSheet}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalPill} />
            <Text style={styles.modalTitle}>Comments</Text>
            <TouchableOpacity onPress={() => setShowComments(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Comment list */}
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            style={styles.commentList}
            contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
            ListEmptyComponent={
              <Text style={styles.emptyComments}>No comments yet. Be the first! 💬</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                <Image source={{ uri: item.userAvatar }} style={styles.commentAvatar} />
                <View style={styles.commentBubble}>
                  <Text style={styles.commentUsername}>@{item.username}</Text>
                  <Text style={styles.commentText}>{item.text}</Text>
                </View>
              </View>
            )}
          />

          {/* Input */}
          <View style={styles.commentInputRow}>
            <Image source={{ uri: loggedInUser?.avatarUri ?? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80' }} style={styles.commentAvatar} />
            <TextInput
              style={styles.commentInput}
              placeholder="Write a comment…"
              placeholderTextColor={theme.colors.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={300}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
              onPress={handleSendComment}
              disabled={!commentText.trim()}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  headerInfo: {
    flex: 1,
  },
  username: {
    color: theme.colors.text,
    ...theme.typography.h3,
  },
  location: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    marginTop: 2,
  },
  moodBadge: {
    backgroundColor: theme.colors.glass,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  moodText: {
    color: theme.colors.primaryLight,
    ...theme.typography.tiny,
    textTransform: 'capitalize',
  },
  imageContainer: {
    width: '100%',
    height: 300,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  delayBadge: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    left: theme.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  delayText: {
    color: theme.colors.textSecondary,
    ...theme.typography.tiny,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  tag: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    color: '#fff',
    ...theme.typography.tiny,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  caption: {
    color: theme.colors.textSecondary,
    ...theme.typography.body,
    padding: theme.spacing.md,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 18,
  },
  likedIcon: {
    // emoji handles its own colour
  },
  actionCount: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
  },
  reactionPicker: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  reactionOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(124, 92, 252, 0.2)',
  },
  reactionOptionEmoji: {
    fontSize: 20,
  },
  reactionCounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  reactionCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.glass,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  reactionCountActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(124, 92, 252, 0.2)',
  },
  reactionCountEmoji: {
    fontSize: 13,
  },
  reactionCountText: {
    color: theme.colors.textSecondary,
    ...theme.typography.tiny,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalPill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -18,
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.text,
    ...theme.typography.h3,
  },
  modalClose: {
    color: theme.colors.textMuted,
    fontSize: 16,
    paddingLeft: theme.spacing.sm,
  },
  commentList: {
    flexGrow: 0,
    maxHeight: 380,
  },
  emptyComments: {
    color: theme.colors.textMuted,
    ...theme.typography.body,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
  commentRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    flexShrink: 0,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: theme.colors.glass,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    padding: theme.spacing.sm,
  },
  commentUsername: {
    color: theme.colors.primaryLight,
    ...theme.typography.caption,
    fontWeight: '700',
    marginBottom: 2,
  },
  commentText: {
    color: theme.colors.textSecondary,
    ...theme.typography.body,
    lineHeight: 18,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  commentInput: {
    flex: 1,
    backgroundColor: theme.colors.glass,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    color: theme.colors.text,
    ...theme.typography.body,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#fff',
    ...theme.typography.caption,
    fontWeight: '700',
  },
});
