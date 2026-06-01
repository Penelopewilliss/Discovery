export type TravelTag =
  | 'beach'
  | 'food'
  | 'hidden gem'
  | 'city'
  | 'nature'
  | 'budget'
  | 'luxury'
  | 'adventure'
  | 'culture'
  | 'solo'
  | 'family'
  | 'road trip'
  | 'hiking'
  | 'photography'
  | 'nightlife'
  | 'wellness'
  | 'history'
  | 'wildlife'
  | 'backpacking'
  | 'island'
  | 'mountains'
  | 'skiing'
  | 'volunteering'
  | 'digital nomad';

export type PostDelay =
  | 'now'
  | '6h'
  | '24h'
  | '48h'
  | 'after leaving'
  | 'after trip';

export type VisibilityStatus = 'draft' | 'scheduled' | 'published';

export type LocationPrivacy = 'exact' | 'approximate' | 'hidden' | 'delayed';

export type VibeTag =
  | 'quiet'
  | 'local'
  | 'romantic'
  | 'adventurous'
  | 'budget'
  | 'family'
  | 'foodie'
  | 'party'
  | 'offbeat'
  | 'nature'
  | 'safety'
  | 'hidden gem'
  | 'photography'
  | 'relaxation';

export type PrivacyLevel = 'public' | 'followers' | 'group' | 'private';

export type TravelMood =
  | 'wanderlust'
  | 'relaxed'
  | 'adventurous'
  | 'romantic'
  | 'spiritual'
  | 'thrilled'
  | 'nostalgic'
  | 'energized'
  | 'peaceful'
  | 'curious'
  | 'grateful'
  | 'inspired'
  | 'excited'
  | 'reflective';

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  userAvatar: string;
  text: string;
  createdAt: string;
}

export interface UserTag {
  userId: string;
  username: string;
  avatarUri?: string;
}

export interface PhotoTag extends UserTag {
  xPct: number;
  yPct: number;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  countriesVisited: string[];
  placesFollowed: string[];
  savedPosts: string[];
  travelStyleBadges: string[];
  privateProfile: boolean;
  defaultDelayedPosting: PostDelay;
  hideExactLocation: boolean;
}

export interface MediaItem {
  uri: string;
  type: 'photo' | 'video';
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  imageUrl: string;
  mediaItems?: MediaItem[];
  caption: string;
  locationArea: string;
  destination: string;
  tags: TravelTag[];
  vibeTags?: VibeTag[]; // semantic "vibe" tags for vibe-based search
  mood: TravelMood[];
  likes: number;
  comments: number;
  delay: PostDelay;
  scheduledAt?: string | null; // ISO timestamp for scheduled publish
  visibilityStatus?: VisibilityStatus;
  privacy: PrivacyLevel;
  // New, unified location privacy model. Backwards-compatible helpers exist in services.
  locationPrivacy?: LocationPrivacy;
  approximateLocation?: { lat: number; lon: number; radiusKm?: number } | null; // for 'approximate'
  hideExactLocation?: boolean;
  blurLocation?: boolean;
  hideStayLocation?: boolean;
  // Offline sync status for drafts/posts created locally
  syncStatus?: 'local' | 'syncing' | 'synced' | 'failed';
  createdAt: string;
  liked: boolean;
  saved: boolean;
  reactions: Record<string, number>;
  userReaction: string | null;
  reactionsEnabled: boolean;
  taggedUsers?: UserTag[];
  photoTags?: PhotoTag[];
  tripShare?: {
    tripName: string;
    stops: string[];
    countries: string[];
    stopCount: number;
    mapIncluded?: boolean;
    mapImageUrl?: string;  // static map image URL stored here explicitly
    stopCoords?: Array<{ lat: number; lon: number }>;
    photos?: string[];     // uploaded photo URLs from trip stops
  };
  mapShare?: {
    countriesCount: number;
    placesCount: number;
    topCountries: string[];  // e.g. ["🇫🇷 France", "🇯🇵 Japan"]
  };
  gemHuntShare?: {
    huntId: string;
    title: string;
    category: string;
    difficulty: 'easy' | 'medium' | 'hard';
    xp: number;
    proofNote?: string;
    completedAt: string;
  };
  archived?: boolean;
  // Trust / moderation metadata
  verifiedLocal?: boolean;
  trustedTravelerScore?: number; // 0..100
  usefulTipsCount?: number;
  reportCount?: number;
}

export interface Place {
  id: string;
  name: string;
  country: string;
  coverImage: string;
  followersCount: number;
  trendingPosts: string[];
  travelTips: string[];
  safetyNotes: string[];
  followed: boolean;
  lat?: number;
  lon?: number;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  memberCount: number;
  coverImage: string;
  joined: boolean;
  requested: boolean;
  createdByMe?: boolean;
  locationSharingEnabled?: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  senderAvatar: string;
  text: string;
  createdAt: string;
}

export type ConversationType = 'dm' | 'group';

export interface Conversation {
  id: string;
  type: ConversationType;
  // DM fields
  otherUserId?: string;
  otherUsername?: string;
  otherAvatar?: string;
  // Group fields
  groupId?: string;
  groupName?: string;
  groupCover?: string;
  locationSharingEnabled?: boolean;
  // Shared
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface Stamp {
  country: string;
  emoji: string;
  visitedAt: string;
}

export interface GroupTripEntry {
  id: string;
  type: 'pin' | 'photo';
  userId: string;
  username: string;
  userAvatar: string | null;
  placeName?: string;
  note?: string;
  photoUri?: string;
  createdAt: string;
}

export interface GroupTrip {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  entryCount: number;
}
