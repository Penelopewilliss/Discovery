/**
 * Seed script — creates 3 demo profiles with Firebase Auth accounts,
 * Firestore user docs, posts, stories and mutual follows.
 *
 * Run once:  node scripts/seed-demo.mjs
 */

const PROJECT   = 'hiddengems-87ca5';
const API_KEY   = 'AIzaSyCTBV-Qg8JzVMTIFjcqFGsu66jI7OvSxv0';
const AUTH_URL  = `https://identitytoolkit.googleapis.com/v1/accounts`;
const FS_BASE   = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// ── Firestore REST helpers ────────────────────────────────────────────────────

function toFV(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFV) } };
  if (typeof value === 'object') {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toFV(v)])) } };
  }
  return { nullValue: null };
}
function toDoc(obj) {
  return { fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFV(v)])) };
}

async function fsSet(path, data, idToken) {
  const headers = { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) };
  const res = await fetch(`${FS_BASE}/${path}?key=${API_KEY}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(toDoc(data)),
  });
  if (!res.ok) throw new Error(`fsSet ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fsAdd(col, data, idToken) {
  const headers = { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) };
  const res = await fetch(`${FS_BASE}/${col}?key=${API_KEY}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(toDoc(data)),
  });
  if (!res.ok) throw new Error(`fsAdd ${col}: ${res.status} ${await res.text()}`);
  const doc = await res.json();
  return doc.name.split('/').pop();
}

// ── Firebase Auth REST helpers ────────────────────────────────────────────────

async function signIn(email, password) {
  const res = await fetch(`${AUTH_URL}:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) return null; // might need sign-up instead
  return { uid: data.localId, idToken: data.idToken };
}

async function signUp(email, password) {
  const res = await fetch(`${AUTH_URL}:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`signUp ${email}: ${data.error?.message}`);
  return { uid: data.localId, idToken: data.idToken };
}

async function getAuth(email, password) {
  const existing = await signIn(email, password);
  if (existing) return existing;
  return signUp(email, password);
}

// ── Demo profile definitions ──────────────────────────────────────────────────

const ago = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000);

const DEMO_DEFS = [
  {
    email: 'demo.sophia@hiddengems.app',
    password: 'Demo@Sophia2026!',
    username: 'sophia.explores',
    name: 'Sophia Chen',
    bio: 'Travel photographer 📸 | Chasing sunsets and hidden gems 🌅',
    avatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&q=80',
    posts: [
      { image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80', caption: 'Lost in the temples of Bali 🛕 Found this spot completely off the tourist trail — pure magic.', location: 'Ubud, Bali, Indonesia', area: 'Bali', tags: ['hidden gem', 'nature'], mood: 'wanderlust', likes: 142, hoursAgo: 3 },
      { image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&q=80', caption: 'Santorini at golden hour. Overrated? Maybe. Breathtaking? Absolutely 🌅', location: 'Oia, Santorini, Greece', area: 'Santorini', tags: ['beach', 'luxury'], mood: 'happy', likes: 289, hoursAgo: 30 },
      { image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80', caption: 'Neon-lit streets of Tokyo at midnight. The energy here is unlike anywhere on earth 🏙️✨', location: 'Shinjuku, Tokyo, Japan', area: 'Tokyo', tags: ['city', 'hidden gem'], mood: 'excited', likes: 198, hoursAgo: 72 },
    ],
    story: { image: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&q=80', text: '📍 Chiang Mai, Thailand', location: 'Chiang Mai', music: { title: 'Golden Hour', artist: 'JVKE' }, hoursAgo: 2 },
  },
  {
    email: 'demo.marco@hiddengems.app',
    password: 'Demo@Marco2026!',
    username: 'marco.adventures',
    name: 'Marco Rivera',
    bio: 'Food & culture explorer 🍜 | Making memories one bite at a time',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
    posts: [
      { image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', caption: 'Lisbon\'s trams, tiles and pastéis de nata. Best budget city in Europe 🇵🇹', location: 'Alfama, Lisbon, Portugal', area: 'Lisbon', tags: ['city', 'budget', 'food'], mood: 'content', likes: 167, hoursAgo: 5 },
      { image: 'https://images.unsplash.com/photo-1539020140153-e479b8e2eb62?w=800&q=80', caption: 'Djemaa el-Fna, Marrakech 🧡 The smells, sounds, chaos — 10/10 would get lost again.', location: 'Medina, Marrakech, Morocco', area: 'Marrakech', tags: ['food', 'hidden gem', 'city'], mood: 'excited', likes: 211, hoursAgo: 48 },
      { image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80', caption: 'Bangkok street food at 2am. Best meal of my life. Cost €1.50. Travel is wild 🍜🔥', location: 'Yaowarat, Bangkok, Thailand', area: 'Bangkok', tags: ['food', 'budget', 'city'], mood: 'happy', likes: 334, hoursAgo: 96 },
    ],
    story: { image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80', text: '🍷 Dinner with a view 🇮🇹', location: 'Amalfi Coast, Italy', music: { title: 'Firestone', artist: 'Kygo ft. Conrad' }, hoursAgo: 4 },
  },
  {
    email: 'demo.luna@hiddengems.app',
    password: 'Demo@Luna2026!',
    username: 'luna.wanderlust',
    name: 'Luna Andersen',
    bio: 'Nature lover 🌿 | Finding beauty in forgotten places 🏔️',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&q=80',
    posts: [
      { image: 'https://images.unsplash.com/photo-1531168556467-80aace0d0144?w=800&q=80', caption: 'Aurora borealis over Iceland ❄️💚 Waited 4 nights for this shot. Worth every freezing second.', location: 'Kirkjufell, Iceland', area: 'Iceland', tags: ['nature', 'hidden gem'], mood: 'inspired', likes: 512, hoursAgo: 8 },
      { image: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=800&q=80', caption: 'Scottish Highlands with zero phone signal and zero complaints 🏴󠁧󠁢󠁳󠁣󠁴󠁿', location: 'Isle of Skye, Scotland, UK', area: 'Scotland', tags: ['nature', 'hidden gem'], mood: 'peaceful', likes: 378, hoursAgo: 36 },
      { image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80', caption: 'Norwegian fjords from a kayak 🚣‍♀️🌊 Got completely lost. It was perfect.', location: 'Geirangerfjord, Norway', area: 'Norway', tags: ['nature', 'budget'], mood: 'adventurous', likes: 429, hoursAgo: 120 },
    ],
    story: { image: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80', text: '🌙 Paris never gets old', location: 'Paris, France', music: { title: 'Dreams', artist: 'Fleetwood Mac' }, hoursAgo: 6 },
  },
];

// ── Main seeding function ─────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding demo profiles into Firestore...\n');

  const seeded = []; // { uid, idToken, def }

  // 1. Auth + user docs
  console.log('👤 Creating Firebase Auth accounts and user documents...');
  for (const def of DEMO_DEFS) {
    const { uid, idToken } = await getAuth(def.email, def.password);
    await fsSet(`users/${uid}`, {
      username: def.username,
      name: def.name,
      bio: def.bio,
      avatar: def.avatar,
      followersCount: 2,
      followingCount: 2,
      postsCount: def.posts.length,
      isDemo: true,
      allowStoryShares: true,
      createdAt: ago(30 * 24),
    }, idToken);
    seeded.push({ uid, idToken, def });
    console.log(`  ✓ ${def.username}  (uid: ${uid})`);
  }

  // 2. Posts — deterministic IDs so re-running is idempotent (no duplicates)
  // First, delete any old random-ID posts from previous runs
  console.log('\n🧹 Cleaning up old posts...');
  for (const { uid, idToken, def } of seeded) {
    const keepIds = new Set(def.posts.map((_, i) => `${uid}_post_${i}`));
    const qRes = await fetch(`${FS_BASE}:runQuery?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: 'posts' }],
        where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } },
      }}),
    });
    const docs = await qRes.json();
    for (const item of docs) {
      if (!item.document) continue;
      const docId = item.document.name.split('/').pop();
      if (!keepIds.has(docId)) {
        await fetch(`https://firestore.googleapis.com/v1/${item.document.name}?key=${API_KEY}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${idToken}` },
        });
        console.log(`  🗑  ${def.username}: deleted old post ${docId}`);
      }
    }
  }

  console.log('\n📸 Creating posts...');
  for (const { uid, idToken, def } of seeded) {
    for (let i = 0; i < def.posts.length; i++) {
      const p = def.posts[i];
      await fsSet(`posts/${uid}_post_${i}`, {
        userId: uid,
        username: def.username,
        userAvatar: def.avatar,
        imageUrl: p.image,
        mediaItems: [{ uri: p.image, type: 'photo' }],
        caption: p.caption,
        locationArea: p.area,
        destination: p.location,
        tags: p.tags,
        mood: p.mood,
        likesCount: p.likes,
        commentsCount: 0,
        delay: 'now',
        privacy: 'public',
        hideExactLocation: false,
        blurLocation: false,
        hideStayLocation: false,
        reactions: {},
        reactionsEnabled: true,
        allowStoryShares: true,
        createdAt: ago(p.hoursAgo),
      }, idToken);
      console.log(`  ✓ ${def.username}: ${p.area}`);
    }
  }

  // 3. Stories — deterministic ID per user; always fresh so they never expire on re-run
  // First, delete any old random-ID story docs
  console.log('\n🧹 Cleaning up old stories...');
  for (const { uid, idToken, def } of seeded) {
    const keepId = `${uid}_story`;
    const qRes = await fetch(`${FS_BASE}:runQuery?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: 'stories' }],
        where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } },
      }}),
    });
    const docs = await qRes.json();
    for (const item of docs) {
      if (!item.document) continue;
      const docId = item.document.name.split('/').pop();
      if (docId !== keepId) {
        await fetch(`https://firestore.googleapis.com/v1/${item.document.name}?key=${API_KEY}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${idToken}` },
        });
        console.log(`  🗑  ${def.username}: deleted old story ${docId}`);
      }
    }
  }

  console.log('\n📖 Creating stories...');
  for (const { uid, idToken, def } of seeded) {
    const s = def.story;
    const createdAt = new Date(); // always fresh — prevents expiry between seed runs
    const expiresAt = new Date(createdAt.getTime() + 18 * 60 * 60 * 1000);
    await fsSet(`stories/${uid}_story`, {
      userId: uid,
      username: def.username,
      userAvatar: def.avatar,
      image: s.image,
      videoUri: null,
      overlayText: s.text,
      location: s.location,
      music: s.music,
      mentions: [],
      createdAt,
      expiresAt,
    }, idToken);
    console.log(`  ✓ ${def.username}: ${s.location}`);
  }

  // 4. Mutual follows between the 3 demo users
  console.log('\n🤝 Creating mutual follows between demo users...');
  for (const a of seeded) {
    for (const b of seeded) {
      if (a.uid === b.uid) continue;
      await fsSet(`follows/${a.uid}_${b.uid}`, {
        followerId: a.uid,
        followerUsername: a.def.username,
        followerAvatar: a.def.avatar,
        followeeId: b.uid,
        followeeUsername: b.def.username,
        createdAt: ago(30 * 24),
      }, a.idToken);
      console.log(`  ✓ ${a.def.username} → ${b.def.username}`);
    }
  }

  console.log('\n✅ Done! The 3 friends will auto-follow you on your next login.');

  // Print UIDs for reference
  console.log('\nDemo user UIDs (stored in Firestore with isDemo: true):');
  for (const { uid, def } of seeded) {
    console.log(`  ${def.username}: ${uid}`);
  }
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
