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
  | 'solo';

export type PostDelay =
  | 'now'
  | '6h'
  | '24h'
  | '48h'
  | 'after leaving'
  | 'after trip';

export type PrivacyLevel = 'public' | 'followers' | 'group';

export type TravelMood =
  | 'wanderlust'
  | 'relaxed'
  | 'adventurous'
  | 'romantic'
  | 'spiritual'
  | 'thrilled';

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  userAvatar: string;
  text: string;
  createdAt: string;
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

export interface Post {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  imageUrl: string;
  caption: string;
  locationArea: string;
  destination: string;
  tags: TravelTag[];
  mood: TravelMood;
  likes: number;
  comments: number;
  delay: PostDelay;
  privacy: PrivacyLevel;
  hideExactLocation: boolean;
  blurLocation: boolean;
  hideStayLocation: boolean;
  createdAt: string;
  liked: boolean;
  saved: boolean;
  reactions: Record<string, number>;
  userReaction: string | null;
  reactionsEnabled: boolean;
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
}

export interface Stamp {
  country: string;
  emoji: string;
  visitedAt: string;
}
