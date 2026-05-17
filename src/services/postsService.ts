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
      const response = await fetch(item.uri);
      const blob = await response.blob();
      const ext = item.type === 'video' ? 'mp4' : 'jpg';
      const storageRef = ref(storage, `post-media/${userId}/${postId}/${i}.${ext}`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      uploaded.push({ uri: url, type: item.type });
    } catch {
      // Keep original URI if upload fails
      uploaded.push(item);
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

// ─── Feed Listener ──────────────────────────────────────────────────────────

export function listenToFeed(
  userId: string,
  onPosts: (posts: Post[]) => void
): () => void {
  const q = query(
    collection(db, 'posts'),
    orderBy('createdAt', 'desc'),
    limit(40)
  );

  return onSnapshot(q, async (snapshot) => {
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

    onPosts(posts);
  });
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
