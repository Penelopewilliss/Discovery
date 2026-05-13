import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Post, PostDelay } from '../types';
import { theme } from '../theme';
import { toggleLike, toggleSave } from '../data/mockData';

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
  const [liked, setLiked] = useState(post.liked);
  const [saved, setSaved] = useState(post.saved);
  const [likes, setLikes] = useState(post.likes);

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

        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{post.comments}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionIcon}>📤</Text>
          <Text style={styles.actionCount}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleSave}>
          <Text style={[styles.actionIcon]}>{saved ? '🔖' : '🏷️'}</Text>
          <Text style={styles.actionCount}>{saved ? 'Saved' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
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
});
