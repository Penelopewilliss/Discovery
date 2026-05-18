/**
 * socialService.ts
 * Handles follow requests (for private accounts) and the friends system.
 *
 * Follow relationship (one-way, like Instagram):
 *   follows/{followerId_followeeId}  →  status: 'following' | 'requested'
 *
 * Friend relationship (two-way, like Facebook):
 *   friends/{sortedId1_sortedId2}   →  status: 'pending' | 'accepted'
 */
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FollowStatus = 'following' | 'requested' | null;
export type FriendStatus = 'friends' | 'pending_sent' | 'pending_received' | null;

export interface FollowRequest {
  id: string;           // followerId
  username: string;
  avatar: string | null;
  requestedAt: number;
}

export interface FriendRequest {
  id: string;           // requestedBy uid
  username: string;
  avatar: string | null;
  requestedAt: number;
}

export interface Friend {
  id: string;
  username: string;
  avatar: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Deterministic doc ID for a friend pair (sorted so A_B == B_A) */
function friendDocId(a: string, b: string): string {
  return [a, b].sort().join('_');
}

// ─── Follow status ────────────────────────────────────────────────────────────

export async function getFollowStatus(
  followerId: string,
  followeeId: string,
): Promise<FollowStatus> {
  const snap = await getDoc(doc(db, 'follows', `${followerId}_${followeeId}`));
  if (!snap.exists()) return null;
  return (snap.data().status as FollowStatus) ?? 'following';
}

// ─── Follow request flow ──────────────────────────────────────────────────────

/**
 * Send a follow request to a PRIVATE account.
 * For public accounts use followUser from postsService (status='following').
 */
export async function sendFollowRequest(
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
    status: 'requested',
    createdAt: serverTimestamp(),
  });
}

/** Accept an incoming follow request (called by the followee). */
export async function acceptFollowRequest(
  followerId: string,
  followeeId: string,
): Promise<void> {
  await updateDoc(doc(db, 'follows', `${followerId}_${followeeId}`), {
    status: 'following',
  });
}

/** Decline (delete) an incoming follow request. */
export async function declineFollowRequest(
  followerId: string,
  followeeId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'follows', `${followerId}_${followeeId}`));
}

/** Cancel your own outgoing follow request. */
export async function cancelFollowRequest(
  followerId: string,
  followeeId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'follows', `${followerId}_${followeeId}`));
}

/** Get all pending follow requests for myId (people requesting to follow me). */
export async function getIncomingFollowRequests(myId: string): Promise<FollowRequest[]> {
  const snap = await getDocs(
    query(
      collection(db, 'follows'),
      where('followeeId', '==', myId),
      where('status', '==', 'requested'),
    ),
  );
  return snap.docs.map((d) => ({
    id: d.data().followerId as string,
    username: d.data().followerUsername ?? 'traveller',
    avatar: d.data().followerAvatar ?? null,
    requestedAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
  }));
}

// ─── Friend system ────────────────────────────────────────────────────────────

export async function getFriendStatus(myId: string, otherId: string): Promise<FriendStatus> {
  const snap = await getDoc(doc(db, 'friends', friendDocId(myId, otherId)));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.status === 'accepted') return 'friends';
  // pending — determine direction
  return data.requestedBy === myId ? 'pending_sent' : 'pending_received';
}

export async function sendFriendRequest(
  fromId: string,
  fromUsername: string,
  fromAvatar: string | null,
  toId: string,
  toUsername: string,
): Promise<void> {
  const fid = friendDocId(fromId, toId);
  await setDoc(doc(db, 'friends', fid), {
    userId1: [fromId, toId].sort()[0],
    userId2: [fromId, toId].sort()[1],
    requestedBy: fromId,
    requestedByUsername: fromUsername,
    requestedByAvatar: fromAvatar ?? null,
    otherUsername: toUsername,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export async function acceptFriendRequest(myId: string, otherId: string): Promise<void> {
  await updateDoc(doc(db, 'friends', friendDocId(myId, otherId)), {
    status: 'accepted',
  });
}

export async function declineFriendRequest(myId: string, otherId: string): Promise<void> {
  await deleteDoc(doc(db, 'friends', friendDocId(myId, otherId)));
}

export async function removeFriend(myId: string, otherId: string): Promise<void> {
  await deleteDoc(doc(db, 'friends', friendDocId(myId, otherId)));
}

/** Get all pending friend requests sent TO me. */
export async function getIncomingFriendRequests(myId: string): Promise<FriendRequest[]> {
  // Requests where I am NOT the requester and status is pending
  const q1 = query(
    collection(db, 'friends'),
    where('userId1', '==', myId),
    where('status', '==', 'pending'),
  );
  const q2 = query(
    collection(db, 'friends'),
    where('userId2', '==', myId),
    where('status', '==', 'pending'),
  );
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const results: FriendRequest[] = [];
  [...snap1.docs, ...snap2.docs].forEach((d) => {
    const data = d.data();
    if (data.requestedBy === myId) return; // sent by me — skip
    results.push({
      id: data.requestedBy as string,
      username: data.requestedByUsername ?? 'traveller',
      avatar: data.requestedByAvatar ?? null,
      requestedAt: data.createdAt?.toMillis?.() ?? Date.now(),
    });
  });
  return results;
}

/** Get my accepted friends list. */
export async function getFriendList(myId: string): Promise<Friend[]> {
  const q1 = query(
    collection(db, 'friends'),
    where('userId1', '==', myId),
    where('status', '==', 'accepted'),
  );
  const q2 = query(
    collection(db, 'friends'),
    where('userId2', '==', myId),
    where('status', '==', 'accepted'),
  );
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const friends: Friend[] = [];
  [...snap1.docs, ...snap2.docs].forEach((d) => {
    const data = d.data();
    const otherId = data.userId1 === myId ? data.userId2 : data.userId1;
    const isRequester = data.requestedBy === myId;
    friends.push({
      id: otherId as string,
      username: isRequester ? data.otherUsername : data.requestedByUsername,
      avatar: isRequester ? null : data.requestedByAvatar ?? null,
    });
  });
  return friends;
}

/** Get someone else's friend list (respects friendListVisibility). */
export async function getOtherUserFriendList(
  myId: string,
  targetId: string,
  myFriendStatus: FriendStatus,
): Promise<Friend[] | null> {
  // Load target user's visibility setting
  const userSnap = await getDoc(doc(db, 'users', targetId));
  const visibility: string = userSnap.data()?.friendListVisibility ?? 'public';
  if (visibility === 'private') return null;
  if (visibility === 'friends' && myFriendStatus !== 'friends') return null;
  return getFriendList(targetId);
}
