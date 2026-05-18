import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  limit,
  where,
  increment,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
  Query,
  DocumentData,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Post, MediaItem, Comment } from '../types';

// ─── Media Upload ───────────────────────────────────────────────────────────

/** Reliably converts a local file URI to a Blob in React Native (fetch().blob() is unreliable) */
function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = reject;
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send();
  });
}

export async function uploadPostMedia(
  userId: string,
  postId: string,
  mediaItems: MediaItem[]
): Promise<MediaItem[]> {
  const uploaded: MediaItem[] = [];
  for (let i = 0; i < mediaItems.length; i++) {
    const item = mediaItems[i];
    // Skip items that are already remote URLs (e.g. static map URLs)
    if (item.uri.startsWith('http')) {
      uploaded.push(item);
      continue;
    }
    try {
      const blob = await uriToBlob(item.uri);
      const ext = item.type === 'video' ? 'mp4' : 'jpg';
      const contentType = item.type === 'video' ? 'video/mp4' : 'image/jpeg';
      const storageRef = ref(storage, `post-media/${userId}/${postId}/${i}.${ext}`);
      await uploadBytes(storageRef, blob, { contentType });
      const url = await getDownloadURL(storageRef);
      uploaded.push({ uri: url, type: item.type });
    } catch (err) {
      // Re-throw so the caller can surface the error to the user instead of
      // silently storing an unresolvable local file:// URI in Firestore.
      throw err;
    }
  }
  return uploaded;
}

// ─── Create Post ────────────────────────────────────────────────────────────

export async function createPostInFirestore(post: Omit<Post, 'liked' | 'saved'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'posts'), {
    ...post,
    createdAt: serverTimestamp(),
    likesCount: post.likes ?? 0,
    commentsCount: post.comments ?? 0,
  });
  return docRef.id;
}

export async function deletePostFromFirestore(postId: string): Promise<void> {
  await deleteDoc(doc(db, 'posts', postId));
}

// ─── Feed Listener ──────────────────────────────────────────────────────────

export function listenToFeed(
  userId: string,
  onPosts: (posts: Post[]) => void
): () => void {
  // Fetch followed user IDs, then listen to their posts (fallback: global feed)
  let unsubscribe: (() => void) | null = null;

  getDocs(query(collection(db, 'follows'), where('followerId', '==', userId))).then((followSnap) => {
    const followeeIds: string[] = followSnap.docs.map((d) => d.data().followeeId as string);

    // Build query: filter to followed users if any, else global
    let postsQuery: Query;
    // Include own posts + followed users; Firestore 'in' supports up to 30 items
    if (followeeIds.length > 0) {
      const ids = [...new Set([userId, ...followeeIds])].slice(0, 30);
      postsQuery = query(
        collection(db, 'posts'),
        where('userId', 'in', ids),
        limit(60)
      );
    } else {
      postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(40)
      );
    }

    unsubscribe = onSnapshot(postsQuery, async (snapshot) => {
    // Also fetch the user's liked/saved/reacted state
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data() ?? {};
    const likedPostIds: string[] = userData.likedPostIds ?? [];
    const savedPostIds: string[] = userData.savedPostIds ?? [];
    const reactionsByPost: Record<string, string> = userData.reactionsByPost ?? {};

    const posts: Post[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        username: data.username,
        userAvatar: data.userAvatar ?? null,
        imageUrl: data.mediaItems?.[0]?.uri ?? data.imageUrl ?? '',
        mediaItems: data.mediaItems ?? [],
        caption: data.caption ?? '',
        locationArea: data.locationArea ?? '',
        destination: data.destination ?? '',
        tags: data.tags ?? [],
        mood: data.mood ?? 'wanderlust',
        likes: data.likesCount ?? 0,
        comments: data.commentsCount ?? 0,
        delay: data.delay ?? 'now',
        privacy: data.privacy ?? 'public',
        hideExactLocation: data.hideExactLocation ?? false,
        blurLocation: data.blurLocation ?? false,
        hideStayLocation: data.hideStayLocation ?? false,
        createdAt: data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : data.createdAt ?? new Date().toISOString(),
        liked: likedPostIds.includes(d.id),
        saved: savedPostIds.includes(d.id),
        reactions: data.reactions ?? {},
        userReaction: reactionsByPost[d.id] ?? null,
        reactionsEnabled: data.reactionsEnabled ?? true,
        tripShare: data.tripShare ?? undefined,
      } as Post;
    });

      // Sort by createdAt descending (client-side since we dropped orderBy to avoid composite index)
      posts.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });

      onPosts(posts);
    });
  }).catch(() => {});

  // Return a cleanup function that calls the inner unsubscribe if set
  return () => { unsubscribe?.(); };
}

// ─── Like / Unlike ──────────────────────────────────────────────────────────

export async function likePost(postId: string, userId: string): Promise<void> {
  await Promise.all([
    updateDoc(doc(db, 'posts', postId), { likesCount: increment(1) }),
    updateDoc(doc(db, 'users', userId), { likedPostIds: arrayUnion(postId) }),
  ]);
}

export async function unlikePost(postId: string, userId: string): Promise<void> {
  await Promise.all([
    updateDoc(doc(db, 'posts', postId), { likesCount: increment(-1) }),
    updateDoc(doc(db, 'users', userId), { likedPostIds: arrayRemove(postId) }),
  ]);
}

// ─── Save / Unsave ──────────────────────────────────────────────────────────

export async function savePost(postId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { savedPostIds: arrayUnion(postId) });
}

export async function unsavePost(postId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { savedPostIds: arrayRemove(postId) });
}

// ─── Reactions ──────────────────────────────────────────────────────────────

export async function setReaction(
  postId: string,
  userId: string,
  emoji: string | null,
  prevEmoji: string | null
): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  const userRef = doc(db, 'users', userId);

  const reactionsUpdate: Record<string, any> = {};
  if (prevEmoji) {
    reactionsUpdate[`reactions.${prevEmoji}`] = increment(-1);
  }
  if (emoji) {
    reactionsUpdate[`reactions.${emoji}`] = increment(1);
  }

  const reactionsByPostUpdate: Record<string, any> = {};
  if (emoji) {
    reactionsByPostUpdate[`reactionsByPost.${postId}`] = emoji;
  } else {
    reactionsByPostUpdate[`reactionsByPost.${postId}`] = null;
  }

  await Promise.all([
    Object.keys(reactionsUpdate).length > 0
      ? updateDoc(postRef, reactionsUpdate)
      : Promise.resolve(),
    updateDoc(userRef, reactionsByPostUpdate),
  ]);
}

// ─── Comments ───────────────────────────────────────────────────────────────

export async function loadComments(postId: string): Promise<Comment[]> {
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      postId,
      userId: data.userId,
      username: data.username,
      userAvatar: data.userAvatar ?? '',
      text: data.text,
      createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : data.createdAt ?? new Date().toISOString(),
    } as Comment;
  });
}

export async function addCommentToFirestore(
  postId: string,
  text: string,
  author: { userId: string; username: string; userAvatar: string }
): Promise<Comment> {
  const commentsRef = collection(db, 'posts', postId, 'comments');
  const docRef = await addDoc(commentsRef, {
    ...author,
    text,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) });
  return {
    id: docRef.id,
    postId,
    userId: author.userId,
    username: author.username,
    userAvatar: author.userAvatar,
    text,
    createdAt: new Date().toISOString(),
  };
}

// ─── Follow System ──────────────────────────────────────────────────────────

export async function checkFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'follows', `${followerId}_${followeeId}`));
  return snap.exists();
}

export async function followUser(
  followerId: string,
  followerUsername: string,
  followerAvatar: string | null,
  followeeId: string,
  followeeUsername: string,
): Promise<void> {
  await setDoc(doc(db, 'follows', `${followerId}_${followeeId}`), {
    followerId,
    followerUsername,
    followerAvatar: followerAvatar ?? null,
    followeeId,
    followeeUsername,
    createdAt: serverTimestamp(),
  });
}

export async function unfollowUser(followerId: string, followeeId: string): Promise<void> {
  await deleteDoc(doc(db, 'follows', `${followerId}_${followeeId}`));
}

// ─── Place Follow System ─────────────────────────────────────────────────────

export async function followPlace(userId: string, placeId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { followedPlaceIds: arrayUnion(placeId) });
}

export async function unfollowPlace(userId: string, placeId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { followedPlaceIds: arrayRemove(placeId) });
}

// ─── Groups ──────────────────────────────────────────────────────────────────

export async function createGroupInFirestore(
  group: { name: string; description: string; isPrivate: boolean; locationSharingEnabled: boolean },
  creatorId: string
): Promise<string> {
  const docRef = await addDoc(collection(db, 'groups'), {
    ...group,
    memberCount: 1,
    coverImage: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80',
    members: [creatorId],
    pendingMembers: [],
    createdBy: creatorId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function joinGroup(groupId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), {
    members: arrayUnion(userId),
    memberCount: increment(1),
  });
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), {
    members: arrayRemove(userId),
    memberCount: increment(-1),
  });
}

export async function requestGroup(groupId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), {
    pendingMembers: arrayUnion(userId),
  });
}

export async function cancelRequestGroup(groupId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), {
    pendingMembers: arrayRemove(userId),
  });
}

// ─── Group Trips ─────────────────────────────────────────────────────────────

export async function createGroupTrip(groupId: string, name: string, creatorId: string): Promise<string> {
  const ref = await addDoc(collection(db, 'groups', groupId, 'trips'), {
    name,
    createdBy: creatorId,
    createdAt: serverTimestamp(),
    entryCount: 0,
  });
  return ref.id;
}

export function listenGroupTrips(
  groupId: string,
  onTrips: (trips: import('../types').GroupTrip[]) => void
): () => void {
  const q = query(
    collection(db, 'groups', groupId, 'trips'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const trips = snap.docs.map((d) => ({
      id: d.id,
      name: d.data().name ?? '',
      createdBy: d.data().createdBy ?? '',
      createdAt: d.data().createdAt instanceof Timestamp
        ? d.data().createdAt.toDate().toISOString()
        : new Date().toISOString(),
      entryCount: d.data().entryCount ?? 0,
    }));
    onTrips(trips);
  });
}

export async function addGroupTripEntry(
  groupId: string,
  tripId: string,
  entry: Omit<import('../types').GroupTripEntry, 'id'>
): Promise<void> {
  await addDoc(collection(db, 'groups', groupId, 'trips', tripId, 'entries'), {
    ...entry,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'groups', groupId, 'trips', tripId), {
    entryCount: increment(1),
  });
}

export function listenGroupTripEntries(
  groupId: string,
  tripId: string,
  onEntries: (entries: import('../types').GroupTripEntry[]) => void
): () => void {
  const q = query(
    collection(db, 'groups', groupId, 'trips', tripId, 'entries'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map((d) => ({
      id: d.id,
      type: d.data().type,
      userId: d.data().userId ?? '',
      username: d.data().username ?? '',
      userAvatar: d.data().userAvatar ?? null,
      placeName: d.data().placeName,
      note: d.data().note,
      photoUri: d.data().photoUri,
      createdAt: d.data().createdAt instanceof Timestamp
        ? d.data().createdAt.toDate().toISOString()
        : new Date().toISOString(),
    }));
    onEntries(entries);
  });
}

// ─── Stories ─────────────────────────────────────────────────────────────────

export type FirestoreStory = {
  id: string;
  userId: string;
  username: string;
  userAvatar: string | null;
  image: string | null;
  videoUri: string | null;
  overlayText: string | null;
  location: string | null;
  music: { title: string; artist: string } | null;
  mentions: Array<{ id: string; name: string; handle: string; type: string }>;
  createdAt: number; // ms
};

export async function saveStory(data: Omit<FirestoreStory, 'id' | 'createdAt'>): Promise<string> {
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 18 * 60 * 60 * 1000));
  const docRef = await addDoc(collection(db, 'stories'), {
    ...data,
    createdAt: serverTimestamp(),
    expiresAt,
  });
  return docRef.id;
}

export async function uploadStoryMedia(userId: string, localUri: string, type: 'photo' | 'video'): Promise<string> {
  const blob = await uriToBlob(localUri);
  const ext = type === 'video' ? 'mp4' : 'jpg';
  const contentType = type === 'video' ? 'video/mp4' : 'image/jpeg';
  const storyRef = ref(storage, `stories/${userId}/${Date.now()}.${ext}`);
  await uploadBytes(storyRef, blob, { contentType });
  return getDownloadURL(storyRef);
}

export function listenToStories(
  userId: string,
  onStories: (stories: FirestoreStory[]) => void
): () => void {
  let unsubscribe: (() => void) | null = null;
  const EXPIRY_MS = 18 * 60 * 60 * 1000;

  const startListener = (ids: string[]) => {
    // No orderBy — avoids composite index requirement; sort client-side
    const q = query(
      collection(db, 'stories'),
      where('userId', 'in', ids),
      limit(50)
    );

    unsubscribe = onSnapshot(q, (snap) => {
      const cutoff = Date.now() - EXPIRY_MS;
      const stories: FirestoreStory[] = snap.docs
        .map((d) => {
          const data = d.data();
          const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
          if (createdAt < cutoff) return null;
          return {
            id: d.id,
            userId: data.userId ?? '',
            username: data.username ?? '',
            userAvatar: data.userAvatar ?? null,
            image: data.image ?? null,
            videoUri: data.videoUri ?? null,
            overlayText: data.overlayText ?? null,
            location: data.location ?? null,
            music: data.music ?? null,
            mentions: data.mentions ?? [],
            createdAt,
          };
        })
        .filter(Boolean) as FirestoreStory[];
      stories.sort((a, b) => b.createdAt - a.createdAt);
      onStories(stories);
    });
  };

  getDocs(query(collection(db, 'follows'), where('followerId', '==', userId))).then((followSnap) => {
    const followeeIds = followSnap.docs.map((d) => d.data().followeeId as string);

    if (followeeIds.length > 0) {
      // Has follows: show own + followed users' stories
      const ids = [userId, ...followeeIds].slice(0, 30);
      startListener(ids);
    } else {
      // No follows yet: show own story + global recent stories as discovery
      // Use a global limit query — no 'in' filter needed
      const globalQ = query(
        collection(db, 'stories'),
        limit(30)
      );
      unsubscribe = onSnapshot(globalQ, (snap) => {
        const cutoff = Date.now() - EXPIRY_MS;
        const stories: FirestoreStory[] = snap.docs
          .map((d) => {
            const data = d.data();
            const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
            if (createdAt < cutoff) return null;
            return {
              id: d.id,
              userId: data.userId ?? '',
              username: data.username ?? '',
              userAvatar: data.userAvatar ?? null,
              image: data.image ?? null,
              videoUri: data.videoUri ?? null,
              overlayText: data.overlayText ?? null,
              location: data.location ?? null,
              music: data.music ?? null,
              mentions: data.mentions ?? [],
              createdAt,
            };
          })
          .filter(Boolean) as FirestoreStory[];
        stories.sort((a, b) => b.createdAt - a.createdAt);
        onStories(stories);
      });
    }
  }).catch(() => onStories([]));

  return () => { unsubscribe?.(); };
}
