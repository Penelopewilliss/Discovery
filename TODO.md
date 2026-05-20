# Discovery App — To-Do List

## Optional / Future
- [ ] **Google Sign-In** — requires `expo-auth-session` + OAuth setup in Firebase Console

## Completed ✅
- [x] HomeScreen Firestore real-time feed
- [x] PostCard — like, save, react, comment all wired to Firestore
- [x] PostCard — follow/unfollow wired to Firestore (`follows` collection)
- [x] PlaceCard — follow/unfollow wired to Firestore
- [x] GroupCard — join/leave/request wired to Firestore
- [x] LiveTripSummarySheet — trip sharing uses `createPostInFirestore`
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
- [x] ProfileScreen — shows real user data (name, avatar, username, bio from UserContext/Firestore)
- [x] ProfileSetupScreen — saves profile doc to Firestore on signup
- [x] Avatar upload — wired to Firebase Storage in both ProfileScreen and ProfileSetupScreen
- [x] Cover photo upload — wired to Firebase Storage in ProfileScreen
- [x] MessagesScreen — real-time Firestore conversations with unread badge counts
- [x] ChatScreen — real-time Firestore messages; send increments recipient's unread count
- [x] GroupsScreen — real-time Firestore groups with join/leave/request/create
- [x] SearchScreen — users and posts from Firestore, places from Foursquare API
- [x] Follow system — `follows` collection in Firestore; PostCard, PlaceCard wired
- [x] Friends system — `friends` collection; send/accept/decline requests; OtherUserProfile wired
- [x] Push notifications — `registerForPushNotifications` called on login, token saved to Firestore
- [x] Feed filtering — `listenToFeed` filters posts by followed users (falls back to global)
- [x] Profile stats — follower/following counts from Firestore `follows` collection
- [x] Group Trips — create, pin stops, add photos, all wired to Firestore subcollections
- [x] Stories — create, view, expire (18 h) wired to Firestore `stories` collection
- [x] CreatePostScreen — no mock data; all imports are live Firebase/Foursquare
