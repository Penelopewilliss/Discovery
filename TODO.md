# Discovery App — To-Do List

## Auth & User
- [ ] **ProfileScreen — show real user data** (name, avatar, username, bio — currently uses hardcoded `mockUser`)
- [ ] **ProfileSetupScreen — save profile doc to Firestore** after signup (so the fallback minimal user gets replaced)
- [ ] **Avatar upload** — wire the image picker in ProfileScreen to Firebase Storage + update Firestore user doc
- [ ] **Google Sign-In** (later — requires `expo-auth-session` + OAuth setup)

## Screens Still on Mock Data
- [ ] **MessagesScreen** — replace `mockConversations` with real Firestore conversations/DMs
- [ ] **SearchScreen** — replace `mockPosts` / `mockPlaces` / `mockUser` with real Firestore queries
- [ ] **GroupsScreen** — replace `mockGroups` / `addGroup` / `toggleJoinGroup` with Firestore
- [ ] **ChatScreen** — replace `getMessages` / `sendMessage` / `toggleLocationSharing` with real Firestore

## Components Still on Mock Data
- [ ] **PostCard** — `toggleFollowUser` / `isFollowing` still from mockData (follow system not in Firestore)
- [ ] **PlaceCard** — `toggleFollowPlace` still from mockData
- [ ] **GroupCard** — `toggleJoinGroup` still from mockData
- [ ] **LiveTripSummarySheet** — `addPost` still from mockData (should use `createPostInFirestore`)

## Features
- [ ] **Follow system** — store following/followers in Firestore, wire PostCard + PlaceCard
- [ ] **Push notifications** — `src/utils/notifications.ts` exists but not fully wired
- [ ] **Feed filtering** — currently loads last 40 posts globally; should filter by followed users
- [ ] **Profile stats** — followers/following counts should come from Firestore, not mock numbers

## Cleanup
- [ ] **CreatePostScreen** — remove unused `import { addPost, mockPlaces }` from mockData
- [ ] **Remove `mockUser` dependency** from ProfileScreen and SearchScreen entirely once real data is wired

## Completed ✅
- [x] HomeScreen Firestore real-time feed
- [x] PostCard — like, save, react, comment all wired to Firestore
- [x] Firebase Auth persistence (AsyncStorage)
- [x] Firestore security rules deployed
- [x] Storage security rules deployed
- [x] Logout button in ProfileScreen
- [x] Forgot password in ProfileScreen
- [x] Expo tunnel fix (`@expo/ngrok` installed)
- [x] Worldwide place search for trip stops (Photon/Komoot API)
- [x] Trip sharing wired to Firestore feed
- [x] Auth flow fix — Firebase-driven loading state, no more "Not logged in" on post
- [x] Email/Password sign-in enabled in Firebase Console
