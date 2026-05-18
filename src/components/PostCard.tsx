import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
  Alert,
  Modal,
  TextInput,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Post, PostDelay, Comment, MediaItem, UserTag, PhotoTag } from '../types';
import { theme } from '../theme';
import LeafletMapView, { LMarker, LRegion } from './LeafletMapView';
import {
  likePost, unlikePost, savePost, unsavePost,
  addCommentToFirestore, loadComments, setReaction,
  followUser, unfollowUser, checkFollowing, saveStory,
  deletePostFromFirestore,
} from '../services/postsService';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

const { width } = Dimensions.get('window');

/** Isolated component so useVideoPlayer hook is always called unconditionally */
function VideoSlide({ uri, style }: { uri: string; style: object }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={style as any}
      contentFit="cover"
      nativeControls
    />
  );
}

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
  onDelete?: () => void;
}

export default function PostCard({ post, onUpdate, onDelete }: PostCardProps) {
  const { user: loggedInUser } = useUser();
  const isOwnPost = post.userId === loggedInUser?.id || post.userId === 'user_1';
  const [following, setFollowing] = useState(false);
  const [liked, setLiked] = useState(post.liked);
  const [saved, setSaved] = useState(post.saved);
  const [likes, setLikes] = useState(post.likes);
  const [userReaction, setUserReaction] = useState<string | null>(post.userReaction);
  const [reactions, setReactions] = useState<Record<string, number>>(post.reactions ?? {});
  const [showComments, setShowComments] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [taggedProfile, setTaggedProfile] = useState<UserTag | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments);
  const [commentText, setCommentText] = useState('');
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const lastTapRef = useRef<number>(0);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);

  // Check following state from Firestore
  useEffect(() => {
    if (!loggedInUser?.id || isOwnPost) return;
    checkFollowing(loggedInUser.id, post.userId).then(setFollowing).catch(() => {});
  }, [loggedInUser?.id, post.userId, isOwnPost]);

  // Load comments when section is opened
  useEffect(() => {
    if (showComments && !commentsLoaded) {
      loadComments(post.id).then((c) => {
        setComments(c);
        setCommentsLoaded(true);
      });
    }
  }, [showComments, commentsLoaded, post.id]);

  const handleLike = () => {
    const nowLiked = !liked;
    setLiked(nowLiked);
    setLikes((prev) => (nowLiked ? prev + 1 : prev - 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (loggedInUser?.id) {
      nowLiked
        ? likePost(post.id, loggedInUser.id)
        : unlikePost(post.id, loggedInUser.id);
    }
  };

  const handleSave = () => {
    const nowSaved = !saved;
    setSaved(nowSaved);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (loggedInUser?.id) {
      nowSaved
        ? savePost(post.id, loggedInUser.id)
        : unsavePost(post.id, loggedInUser.id);
    }
  };

  const handleReact = (emoji: string) => {
    const prev = userReaction;
    const next = prev === emoji ? null : emoji;
    // Optimistic update
    setUserReaction(next);
    setReactions((r) => {
      const updated = { ...r };
      if (prev) updated[prev] = Math.max(0, (updated[prev] ?? 1) - 1);
      if (next) updated[next] = (updated[next] ?? 0) + 1;
      return updated;
    });
    if (loggedInUser?.id) {
      setReaction(post.id, loggedInUser.id, next, prev);
    }
  };

  const handleShareExternal = async () => {
    try {
      await Share.share({
        message: `Check out this travel post on HiddenGems!\n\n"${post.caption}"\n\n📍 ${post.locationArea}`,
        title: 'HiddenGems',
      });
    } catch (_) {}
  };

  const handleShareToStory = async () => {
    if (!loggedInUser?.id) return;
    // For others' posts, check if they allow story shares
    if (!isOwnPost) {
      try {
        const ownerSnap = await getDoc(doc(db, 'users', post.userId));
        const ownerData = ownerSnap.data() ?? {};
        if (ownerData.allowStoryShares === false) {
          Alert.alert("Can't share", `@${post.username} hasn't enabled story sharing for their posts.`);
          return;
        }
      } catch (_) {}
    }
    const imageUri = post.mediaItems?.[0]?.uri ?? post.imageUrl ?? null;
    try {
      await saveStory({
        userId: loggedInUser.id,
        username: loggedInUser.username ?? 'traveler',
        userAvatar: loggedInUser.avatarUri ?? null,
        image: imageUri,
        videoUri: null,
        overlayText: isOwnPost ? null : `📸 via @${post.username}`,
        location: post.locationArea || null,
        music: null,
        mentions: [],
      });
      Alert.alert('Added to Story!', 'The post has been added to your story.');
    } catch (_) {
      Alert.alert('Error', 'Could not add to story. Try again.');
    }
  };

  const handleShare = () => {
    Alert.alert(
      'Share Post',
      undefined,
      [
        { text: 'Add to My Story', onPress: handleShareToStory },
        { text: 'Share Externally', onPress: handleShareExternal },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSendComment = async () => {
    const text = commentText.trim();
    if (!text || !loggedInUser?.id) return;
    setCommentText('');

    // Optimistic: show the comment immediately before Firestore confirms
    const tempId = `temp_${Date.now()}`;
    const optimistic: Comment = {
      id: tempId,
      postId: post.id,
      userId: loggedInUser.id,
      username: (loggedInUser.username ?? 'traveler').replace(/@/g, ''),
      userAvatar: loggedInUser.avatarUri ?? '',
      text,
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [optimistic, ...prev]);
    setCommentCount((prev) => prev + 1);

    try {
      const saved = await addCommentToFirestore(post.id, text, {
        userId: loggedInUser.id,
        username: (loggedInUser.username ?? 'traveler').replace(/@/g, ''),
        userAvatar: loggedInUser.avatarUri ?? '',
      });
      // Swap temp placeholder with real Firestore id
      setComments((prev) => prev.map((c) => c.id === tempId ? saved : c));
      onUpdate();
    } catch (_) {
      // Rollback on failure
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setCommentCount((prev) => prev - 1);
      Alert.alert('Error', 'Could not send comment. Please try again.');
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!liked) handleLike();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 800);
    }
    lastTapRef.current = now;
  };

  const delayLabel = DELAY_LABELS[post.delay];

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => {
            if (isOwnPost) return;
            navigation.navigate('OtherUserProfile', { userId: post.userId });
          }}
          activeOpacity={0.7}
        >
          {post.userAvatar
            ? <Image source={{ uri: post.userAvatar }} style={styles.avatar} />
            : <View style={[styles.avatar, styles.avatarPlaceholder]}><Text style={styles.avatarInitial}>{(post.username?.[0] ?? '?').toUpperCase()}</Text></View>
          }
          <View style={styles.headerInfo}>
            <Text style={styles.username}>@{post.username}</Text>
            <Text style={styles.location}>
              📍 {post.blurLocation ? post.locationArea.split(',')[0].trim() + ' region' : post.locationArea}
            </Text>
          </View>
        </TouchableOpacity>
        {!isOwnPost && (
          <TouchableOpacity
            onPress={() => {
              const nowFollowing = !following;
              setFollowing(nowFollowing);
              if (loggedInUser?.id) {
                nowFollowing
                  ? followUser(loggedInUser.id, loggedInUser.username, loggedInUser.avatarUri, post.userId, post.username)
                  : unfollowUser(loggedInUser.id, post.userId);
              }
            }}
            style={[styles.followBtn, following && styles.followingBtn]}
          >
            <Text style={[styles.followBtnText, following && styles.followingBtnText]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.moodBadge}>
          <Text style={styles.moodText}>{Array.isArray(post.mood) ? post.mood.join(' · ') : post.mood}</Text>
        </View>
        {isOwnPost && (
          <TouchableOpacity
            onPress={() => {
              Alert.alert('Post options', undefined, [
                {
                  text: 'Delete post',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert('Delete post?', 'This cannot be undone.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await deletePostFromFirestore(post.id);
                            onDelete?.();
                          } catch {
                            Alert.alert('Error', 'Could not delete post. Try again.');
                          }
                        },
                      },
                    ]);
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.moreBtn}
          >
            <Text style={styles.moreBtnText}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Travel Map Share Card */}
      {post.mapShare ? (
        <LinearGradient
          colors={['#0f2027', '#203a43', '#2c5364']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tripCardBanner}
        >
          <Text style={styles.tripCardEmoji}>🌍</Text>
          <Text style={styles.tripCardName}>My Travel Map</Text>
          <Text style={styles.tripCardMeta}>
            {post.mapShare.countriesCount} countr{post.mapShare.countriesCount !== 1 ? 'ies' : 'y'} · {post.mapShare.placesCount} place{post.mapShare.placesCount !== 1 ? 's' : ''} visited
          </Text>
          <View style={styles.tripCardRoute}>
            {post.mapShare.topCountries.map((c, i) => (
              <View key={i} style={styles.tripCardStopPill}>
                <Text style={styles.tripCardStop} numberOfLines={1}>{c}</Text>
              </View>
            ))}
            {post.mapShare.countriesCount > post.mapShare.topCountries.length && (
              <Text style={styles.tripCardMore}>  +{post.mapShare.countriesCount - post.mapShare.topCountries.length}</Text>
            )}
          </View>
          <Text style={styles.tripCardWatermark}>HiddenGems · Travel Map</Text>
        </LinearGradient>
      ) : (
      /* Trip Card Visual — gradient card when no map; image+strip when map included */
      post.tripShare && !post.tripShare.mapIncluded ? (
        <LinearGradient
          colors={['#6366f1', '#8b5cf6', '#a78bfa']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tripCardBanner}
        >
          <Text style={styles.tripCardEmoji}>✈️</Text>
          <Text style={styles.tripCardName} numberOfLines={2}>
            {post.tripShare.tripName}
          </Text>
          <Text style={styles.tripCardMeta}>
            {post.tripShare.stopCount} stop{post.tripShare.stopCount !== 1 ? 's' : ''} ·{' '}
            {post.tripShare.countries.length} countr{post.tripShare.countries.length !== 1 ? 'ies' : 'y'}
          </Text>
          <View style={styles.tripCardRoute}>
            {post.tripShare.stops.slice(0, 4).map((name, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                {i > 0 && <Text style={styles.tripCardArrow}>  →  </Text>}
                <View style={styles.tripCardStopPill}>
                  <Text style={styles.tripCardStop} numberOfLines={1}>{name}</Text>
                </View>
              </View>
            ))}
            {post.tripShare.stops.length > 4 && (
              <Text style={styles.tripCardMore}>  +{post.tripShare.stops.length - 4}</Text>
            )}
          </View>
          <Text style={styles.tripCardWatermark}>HiddenGems · Trip Plan</Text>
        </LinearGradient>
      ) : (
      /* Map embed (LeafletMapView) when tripShare has coordinates */
      post.tripShare?.mapIncluded && post.tripShare.stopCoords && post.tripShare.stopCoords.length > 0 ? (() => {
        const coords = post.tripShare!.stopCoords!;
        const names = post.tripShare!.stops;
        const COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899'];
        const mapMarkers: LMarker[] = coords.map((c, i) => ({
          id: `pm_${i}`,
          latitude: c.lat,
          longitude: c.lon,
          color: COLORS[i % COLORS.length],
          label: names[i] ?? `Stop ${i + 1}`,
        }));
        const lats = coords.map((c) => c.lat);
        const lons = coords.map((c) => c.lon);
        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
        const minLon = Math.min(...lons), maxLon = Math.max(...lons);
        const padLat = Math.max(0.1, (maxLat - minLat) * 0.5);
        const padLon = Math.max(0.15, (maxLon - minLon) * 0.5);
        const mapRegion: LRegion = {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLon + maxLon) / 2,
          latitudeDelta: Math.max(0.4, maxLat - minLat + padLat * 2),
          longitudeDelta: Math.max(0.5, maxLon - minLon + padLon * 2),
        };
        const polyline = coords.map((c) => ({ latitude: c.lat, longitude: c.lon }));
        return (
          <View style={{ height: 220, overflow: 'hidden' }}>
            <LeafletMapView
              style={{ flex: 1 }}
              region={mapRegion}
              markers={mapMarkers}
              polylineCoords={polyline.length > 1 ? polyline : undefined}
              polylineColor="#6366f1"
              interactive={false}
            />
          </View>
        );
      })() :
      /* Image / Carousel (fallback when mapIncluded but no stored coords, or no tripShare) */
      (() => {
        // When the post is a trip share with a map, prefer the stored map URL
        const mapUrl = post.tripShare?.mapIncluded ? post.tripShare.mapImageUrl : undefined;
        const rawItems: MediaItem[] = post.mediaItems && post.mediaItems.length > 0
          ? post.mediaItems
          : mapUrl
            ? [{ uri: mapUrl, type: 'photo' as const }]
            : [{ uri: post.imageUrl, type: 'photo' }];
        // Filter out local file:// URIs — they are unresolvable on other devices
        const items = rawItems.filter((m) => m.uri && m.uri.startsWith('http'));
        if (items.length === 0) {
          // Post had media but upload URI is invalid — show a neutral placeholder
          return (
            <View style={[styles.imageContainer, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }]}>
              <Text style={{ fontSize: 32 }}>🖼️</Text>
              <Text style={{ color: '#888', fontSize: 12, marginTop: 6 }}>Image unavailable</Text>
            </View>
          );
        }
        const isMulti = items.length > 1;

        const slideW = cardWidth > 0 ? cardWidth : width;

        const renderSlide = (item: MediaItem, index: number) => (
          <TouchableWithoutFeedback key={index} onPress={handleDoubleTap}>
            <View style={[styles.imageContainer, isMulti && { width: slideW }]}>
              {item.type === 'video' ? (
                <VideoSlide uri={item.uri} style={styles.image} />
              ) : (
                <Image source={{ uri: item.uri }} style={styles.image} resizeMode="cover" />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.imageGradient}
              />
              {delayLabel && index === 0 && (
                <View style={styles.delayBadge}>
                  <Text style={styles.delayText}>🔒 {delayLabel}</Text>
                </View>
              )}
              {isMulti && (
                <View style={styles.slideCounter}>
                  <Text style={styles.slideCounterText}>{carouselIndex + 1}/{items.length}</Text>
                </View>
              )}
              {showHeartAnim && (
                <View style={styles.heartAnimContainer} pointerEvents="none">
                  <Text style={styles.heartAnim}>❤️</Text>
                </View>
              )}
              {/* Photo tag dots — only on first slide */}
              {index === 0 && post.photoTags && post.photoTags.map((pt, pi) => (
                <TouchableOpacity
                  key={pi}
                  style={[styles.photoTagDot, { left: `${pt.xPct * 100}%` as any, top: `${pt.yPct * 100}%` as any }]}
                  onPress={() => setTaggedProfile(pt)}
                >
                  <Text style={styles.photoTagDotTxt}>@{pt.username}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        );

        if (!isMulti) {
          return renderSlide(items[0], 0);
        }

        return (
          <View onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / slideW);
                setCarouselIndex(idx);
              }}
              scrollEventThrottle={16}
            >
              {items.map((item, index) => renderSlide(item, index))}
            </ScrollView>
            {/* Dot indicators */}
            <View style={styles.dotRow}>
              {items.map((_, i) => (
                <View key={i} style={[styles.dot, i === carouselIndex && styles.dotActive]} />
              ))}
            </View>
          </View>
        );
      })()
      /* end carousel */
      )
      /* end tripShare/image ternary */
      )
      /* end mapShare ternary */
      }
      {post.tripShare?.mapIncluded && (
        <View style={styles.tripMapStrip}>
          <Text style={styles.tripMapStripName} numberOfLines={1}>
            ✈️  {post.tripShare.tripName}
          </Text>
          <Text style={styles.tripMapStripRoute} numberOfLines={1}>
            {post.tripShare.stops.slice(0, 4).join('  →  ')}
            {post.tripShare.stops.length > 4 ? `  +${post.tripShare.stops.length - 4}` : ''}
          </Text>
        </View>
      )}

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

      {/* Caption — @mentions are tappable */}
      <Text style={styles.caption}>
        {post.caption?.split(/(@\w+)/g).map((part, i) => {
          if (!part.startsWith('@')) return <Text key={i}>{part}</Text>;
          const handle = part.slice(1);
          const tagged = post.taggedUsers?.find((u) => u.username === handle);
          return (
            <Text
              key={i}
              style={styles.mentionLink}
              onPress={() => { if (tagged) { setTaggedProfile(tagged); } }}
            >
              {part}
            </Text>
          );
        })}
      </Text>

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

        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Text style={styles.actionIcon}>📤</Text>
          <Text style={styles.actionCount}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleSave}>
          <Text style={styles.actionIcon}>{saved ? '🔖' : '🏷️'}</Text>
          <Text style={styles.actionCount}>{saved ? 'Saved' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

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
                {item.userAvatar
                  ? <Image source={{ uri: item.userAvatar }} style={styles.commentAvatar} />
                  : <View style={[styles.commentAvatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarInitial}>{(item.username?.[0] ?? '?').toUpperCase()}</Text>
                    </View>
                }
                <View style={styles.commentBubble}>
                  <Text style={styles.commentUsername}>@{item.username}</Text>
                  <Text style={styles.commentText}>{item.text}</Text>
                </View>
              </View>
            )}
          />

          {/* Input */}
          <View style={styles.commentInputRow}>
            {loggedInUser?.avatarUri
              ? <Image source={{ uri: loggedInUser.avatarUri }} style={styles.commentAvatar} />
              : <View style={[styles.commentAvatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>{(loggedInUser?.username?.[0] ?? '?').toUpperCase()}</Text>
                </View>
            }
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

      {/* Tagged user mini profile modal */}
      <Modal visible={!!taggedProfile} animationType="fade" transparent presentationStyle="overFullScreen">
        <TouchableWithoutFeedback onPress={() => setTaggedProfile(null)}>
          <View style={styles.profileModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.profileModalSheet}>
                <View style={styles.profileModalHandle} />
                {taggedProfile?.avatarUri
                  ? <Image source={{ uri: taggedProfile.avatarUri }} style={styles.profileModalAvatar} />
                  : <View style={[styles.profileModalAvatar, { backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>{(taggedProfile?.username?.[0] ?? '?').toUpperCase()}</Text>
                    </View>
                }
                <Text style={styles.profileModalUsername}>@{taggedProfile?.username}</Text>
                <View style={styles.profileModalActions}>
                  {taggedProfile?.userId !== loggedInUser?.id && (
                    <TouchableOpacity
                      style={[styles.profileModalFollowBtn]}
                      onPress={() => {
                        if (loggedInUser?.id && taggedProfile) {
                          followUser(loggedInUser.id, loggedInUser.username, loggedInUser.avatarUri, taggedProfile.userId, taggedProfile.username);
                        }
                      }}
                    >
                      <Text style={styles.profileModalFollowText}>Follow</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.profileModalCloseBtn} onPress={() => setTaggedProfile(null)}>
                    <Text style={styles.profileModalCloseTxt}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
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
  moreBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  moreBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 18,
    letterSpacing: 2,
  },
  followBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.gradientPrimary[0],
    marginRight: 6,
  },
  followingBtn: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  followBtnText: {
    color: theme.colors.gradientPrimary[0],
    fontSize: 12,
    fontWeight: '700',
  },
  followingBtnText: {
    color: theme.colors.textMuted,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    position: 'relative',
  },
  // Trip card visual
  tripCardBanner: {
    borderRadius: 0,
    padding: 24,
    minHeight: 180,
  },
  tripCardEmoji: { fontSize: 32, marginBottom: 8 },
  tripCardName: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  tripCardMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 12 },
  tripCardRoute: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 },
  tripCardArrow: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  tripCardStopPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 110,
    marginBottom: 6,
  },
  tripCardStop: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tripCardMore: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  tripCardWatermark: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  // Trip info strip shown below map image
  tripMapStrip: {
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  tripMapStripName: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  tripMapStripRoute: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
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
  heartAnimContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartAnim: {
    fontSize: 90,
    opacity: 0.9,
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoPlaceholderIcon: {
    fontSize: 52,
  },
  videoPlaceholderLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  videoPlayIcon: {
    color: '#fff',
    fontSize: 22,
    marginLeft: 3,
  },
  slideCounter: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  slideCounterText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
    width: 18,
    borderRadius: 3,
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
  mentionLink: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  photoTagDot: {
    position: 'absolute',
    backgroundColor: 'rgba(139,92,246,0.85)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    transform: [{ translateX: -20 }, { translateY: -10 }],
  },
  photoTagDotTxt: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
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
  // User profile modal
  profileModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  profileModalSheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, alignItems: 'center', paddingTop: 12 },
  profileModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, marginBottom: 20 },
  profileModalAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: theme.colors.primary, marginBottom: 12 },
  profileModalUsername: { color: theme.colors.text, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  profileModalLocation: { color: theme.colors.textMuted, fontSize: 13, marginBottom: 20 },
  profileModalActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 24 },
  profileModalFollowBtn: { flex: 1, paddingVertical: 12, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.primary, alignItems: 'center' },
  profileModalFollowingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border },
  profileModalFollowText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  profileModalFollowingText: { color: theme.colors.textMuted },
  profileModalCloseBtn: { flex: 1, paddingVertical: 12, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.glass, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  profileModalCloseTxt: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
