import { Post } from '../types';

/**
 * Score posts for a user based on simple heuristics.
 * This is modular and replaceable by an AI/rerank service later.
 */
export function scorePostsForUser(post: Post, userProfile: { favoriteVibes?: string[]; followedPlaceIds?: string[]; savedPostIds?: string[]; travelStyle?: string[]; interactedPostIds?: string[] } ) : number {
  let score = 0;

  // Favor posts that match user's favorite vibes
  const favVibes = userProfile.favoriteVibes ?? [];
  if (post.vibeTags && favVibes.length > 0) {
    for (const v of post.vibeTags) {
      if (favVibes.includes(v)) score += 30;
    }
  }

  // Favor saved posts / places the user follows
  if (userProfile.savedPostIds && userProfile.savedPostIds.includes(post.id)) score += 40;
  if (post.tags && userProfile.followedPlaceIds) {
    // simple overlap heuristic (post.destination could match a followed place id)
    if (userProfile.followedPlaceIds.includes(post.destination)) score += 20;
  }

  // Recent posts score higher
  if (post.createdAt) {
    const ageMs = Date.now() - new Date(post.createdAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    score += Math.max(0, 40 - ageHours); // linear decay over ~40 hours
  }

  // Penalize posts that hide exact location slightly (privacy-first)
  if (post.locationPrivacy === 'hidden') score -= 10;

  // Trust/travelers score boost
  if (post.trustedTravelerScore) score += Math.min(20, post.trustedTravelerScore / 5);

  // Interaction boost
  if (userProfile.interactedPostIds && userProfile.interactedPostIds.includes(post.id)) score += 25;

  // Ensure non-negative
  return Math.max(0, Math.round(score));
}

/**
 * Simple feed sorter that scores posts and returns top-N
 */
export function sortPostsForUser(posts: Post[], userProfile: any, limit = 50): Post[] {
  const scored = posts.map((p) => ({ p, s: scorePostsForUser(p, userProfile) }));
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.p);
}

export default { scorePostsForUser, sortPostsForUser };
