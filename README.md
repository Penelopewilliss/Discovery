# ✈️ TRAVLORA

> A modern, cinematic travel social hub — like Instagram & TikTok but built exclusively for travel.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo Go app on your phone (iOS or Android), **or** an iOS/Android simulator

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start Expo
npx expo start
```

Then:
- Press `i` to open in iOS Simulator
- Press `a` to open in Android Emulator
- Scan the QR code with **Expo Go** on your phone

---

## 📁 File Structure

```
travlora/
├── App.tsx                          # Root navigator with bottom tabs
├── package.json
├── tsconfig.json
├── babel.config.js
└── src/
    ├── theme.ts                     # Dark cinematic design tokens
    ├── types.ts                     # TypeScript interfaces
    ├── data/
    │   └── mockData.ts              # Mock backend (replaceable with Firebase/Supabase)
    ├── components/
    │   ├── GlassCard.tsx            # Reusable glassmorphism card
    │   ├── PostCard.tsx             # Social feed post card
    │   ├── PlaceCard.tsx            # Destination card with follow
    │   └── GroupCard.tsx            # Group card with join/request
    └── screens/
        ├── HomeScreen.tsx           # Vertical travel feed with tag filters
        ├── ExploreScreen.tsx        # Discover & follow destinations
        ├── CreatePostScreen.tsx     # Create post with safety options
        ├── GroupsScreen.tsx         # Travel communities
        └── ProfileScreen.tsx        # User profile, passport, privacy
```

---

## ✨ Features

### 🏠 Home Feed
- Vertical social feed with travel posts
- Tag filters: beach, food, hidden gem, city, nature, budget, luxury
- Like, save, comment & share interactions
- Privacy delay labels: *"Posted 24h later for privacy"*

### 🔍 Explore
- Search destinations by name or country
- Horizontal trending destinations carousel
- Place detail view with travel tips & safety notes
- Follow / unfollow destinations

### ✈️ Create Post
- Caption, destination, travel category, mood
- **Safety delayed posting**: Now / 6h / 24h / 48h / After leaving / After trip ends
- Privacy levels: Public / Followers only / Private group only
- Location privacy toggles: hide exact location, blur to city, hide stay location
- Safety notice shown prominently

### 👥 Groups
- Public & private travel communities
- Join public groups, request access to private ones
- Filter by: All / Public / Private / Joined
- Search by name or description

### 👤 Profile
- User avatar, bio, stats (countries, places followed, saved)
- Travel style badges with gradient colours
- **Travel Passport** — digital stamps for visited countries
- Saved posts gallery
- Privacy settings: private profile toggle, default delay, hide location

---

## 🛡️ Safety Design

- **No live location tracking** — not built, not planned
- **No exact coordinates** displayed anywhere
- **No nearby users** feature
- **No stranger tracking**
- Delayed posting system lets users control when a post appears
- Prominent safety reminder on the Create Post screen
- Location privacy toggles on every post

---

## 🔄 Mock Backend → Real Backend

All data lives in `src/data/mockData.ts`. To switch to Firebase or Supabase:

1. Replace `mockPosts`, `mockPlaces`, `mockGroups`, `mockUser` with Firestore/Supabase queries
2. Replace `addPost()`, `toggleLike()`, `toggleSave()`, etc. with API calls
3. The TypeScript types in `src/types.ts` map directly to database schemas

---

## 🎨 Design System

| Token | Value |
|---|---|
| Background | `#0A0A0F` |
| Surface | `#12121A` |
| Primary | `#7C5CFC` |
| Accent | `#FC5C7D` |
| Accent Blue | `#00C2FF` |
| Glass | `rgba(255,255,255,0.06)` |

Fonts, spacing, border radii and gradients are all defined in `src/theme.ts`.

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `expo` | Core framework |
| `expo-linear-gradient` | Gradient backgrounds & buttons |
| `expo-blur` | Glassmorphism blur effects |
| `@react-navigation/native` | Navigation container |
| `@react-navigation/bottom-tabs` | Tab bar |
| `react-native-safe-area-context` | Safe area handling |
| `@react-native-async-storage/async-storage` | Local persistence layer |

---

*Built with ❤️ for modern travellers.*
