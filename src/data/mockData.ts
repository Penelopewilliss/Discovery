import { Post, Place, Group, User, Stamp } from '../types';

export const mockUser: User = {
  id: 'user_1',
  username: 'aurora.travels',
  displayName: 'Aurora Voss',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
  bio: '🌍 Collecting sunsets & passport stamps | 42 countries & counting ✈️',
  countriesVisited: ['Albania', 'Japan', 'Portugal', 'Bali', 'France', 'Netherlands', 'Greece', 'Morocco'],
  placesFollowed: ['place_bali', 'place_albania', 'place_lisbon'],
  savedPosts: ['post_2', 'post_5'],
  travelStyleBadges: ['Solo Explorer', 'Hidden Gem Hunter', 'Sunset Chaser', 'Budget Pro', 'Culture Lover'],
  privateProfile: false,
  defaultDelayedPosting: '24h',
  hideExactLocation: true,
};

export const mockStamps: Stamp[] = [
  { country: 'Albania', emoji: '🇦🇱', visitedAt: '2024-07' },
  { country: 'Japan', emoji: '🇯🇵', visitedAt: '2024-03' },
  { country: 'Portugal', emoji: '🇵🇹', visitedAt: '2023-11' },
  { country: 'Indonesia', emoji: '🇮🇩', visitedAt: '2023-06' },
  { country: 'France', emoji: '🇫🇷', visitedAt: '2023-04' },
  { country: 'Netherlands', emoji: '🇳🇱', visitedAt: '2022-09' },
  { country: 'Greece', emoji: '🇬🇷', visitedAt: '2022-07' },
  { country: 'Morocco', emoji: '🇲🇦', visitedAt: '2021-12' },
];

export let mockPosts: Post[] = [
  {
    id: 'post_1',
    userId: 'user_2',
    username: 'nomad.lena',
    userAvatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80',
    caption: 'Ksamil beaches hit different. The water is literally turquoise crystal and there are almost no tourists. Albania is criminally underrated 🌊',
    locationArea: 'Southern Albania',
    destination: 'Ksamil, Albania',
    tags: ['beach', 'hidden gem', 'budget'],
    mood: 'wanderlust',
    likes: 2847,
    comments: 134,
    delay: '24h',
    privacy: 'public',
    hideExactLocation: true,
    blurLocation: false,
    hideStayLocation: true,
    createdAt: '2026-05-10T10:00:00Z',
    liked: false,
    saved: false,
  },
  {
    id: 'post_2',
    userId: 'user_3',
    username: 'kai.wanderlust',
    userAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80',
    caption: 'Tokyo at 3am is a different universe. Neon lights, empty streets, ramen that heals your soul. This city never stops surprising me 🍜',
    locationArea: 'Tokyo, Japan',
    destination: 'Tokyo, Japan',
    tags: ['city', 'food', 'culture'],
    mood: 'thrilled',
    likes: 5612,
    comments: 289,
    delay: 'now',
    privacy: 'public',
    hideExactLocation: false,
    blurLocation: false,
    hideStayLocation: false,
    createdAt: '2026-05-11T03:22:00Z',
    liked: true,
    saved: true,
  },
  {
    id: 'post_3',
    userId: 'user_4',
    username: 'sofia.roams',
    userAvatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=100&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    caption: 'Ubud rice terraces at golden hour. Bali keeps pulling me back every single year. There is magic here that you cannot explain 🌾',
    locationArea: 'Bali, Indonesia',
    destination: 'Ubud, Bali',
    tags: ['nature', 'adventure', 'culture'],
    mood: 'spiritual',
    likes: 3901,
    comments: 201,
    delay: '48h',
    privacy: 'public',
    hideExactLocation: true,
    blurLocation: true,
    hideStayLocation: true,
    createdAt: '2026-05-09T17:00:00Z',
    liked: false,
    saved: false,
  },
  {
    id: 'post_4',
    userId: 'user_5',
    username: 'marco.escapes',
    userAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80',
    caption: 'Paris from above. Cliché? Maybe. But standing on Montmartre watching the city glow below you never gets old ✨',
    locationArea: 'Paris, France',
    destination: 'Paris, France',
    tags: ['city', 'luxury', 'culture'],
    mood: 'romantic',
    likes: 7430,
    comments: 512,
    delay: 'after trip',
    privacy: 'public',
    hideExactLocation: false,
    blurLocation: false,
    hideStayLocation: true,
    createdAt: '2026-05-08T20:00:00Z',
    liked: false,
    saved: false,
  },
  {
    id: 'post_5',
    userId: 'user_6',
    username: 'luna.offpath',
    userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80',
    caption: 'Lisbon tram 28, late afternoon sun, old city tiles and fado music drifting from an open window. Some moments you just freeze in time 🎵',
    locationArea: 'Lisbon, Portugal',
    destination: 'Alfama, Lisbon',
    tags: ['city', 'culture', 'budget'],
    mood: 'relaxed',
    likes: 4102,
    comments: 176,
    delay: '6h',
    privacy: 'public',
    hideExactLocation: false,
    blurLocation: false,
    hideStayLocation: false,
    createdAt: '2026-05-07T16:00:00Z',
    liked: false,
    saved: true,
  },
  {
    id: 'post_6',
    userId: 'user_7',
    username: 'theo.highland',
    userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    caption: 'Camping above the clouds in the Swiss Alps. No wifi, no agenda, just stars and silence. This is what recharging actually feels like ⛰️',
    locationArea: 'Swiss Alps',
    destination: 'Swiss Alps',
    tags: ['nature', 'adventure', 'hidden gem'],
    mood: 'adventurous',
    likes: 6218,
    comments: 334,
    delay: 'after leaving',
    privacy: 'public',
    hideExactLocation: true,
    blurLocation: true,
    hideStayLocation: true,
    createdAt: '2026-05-06T08:00:00Z',
    liked: false,
    saved: false,
  },
];

export const mockPlaces: Place[] = [
  {
    id: 'place_bali',
    name: 'Bali',
    country: 'Indonesia',
    coverImage: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80',
    followersCount: 284700,
    trendingPosts: ['post_3'],
    travelTips: [
      'Visit during dry season (April–October) for best weather',
      'Rent a scooter in Ubud, most locals use them',
      'Avoid Kuta if you want authentic Bali vibes',
      'Offerman season sunrises at Mount Batur are incredible',
    ],
    safetyNotes: [
      'Always carry travel insurance',
      'Drink bottled water only',
      'Be cautious with monkey interactions at temples',
    ],
    followed: true,
  },
  {
    id: 'place_albania',
    name: 'Albania',
    country: 'Albania',
    coverImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    followersCount: 47200,
    trendingPosts: ['post_1'],
    travelTips: [
      'Ksamil beaches rival Greek islands at a fraction of the cost',
      'Try Byrek and Fërgësa, local food is incredible',
      'Gjirokastër old city is a UNESCO gem worth visiting',
      'Cash is king, carry Lek for smaller towns',
    ],
    safetyNotes: [
      'Albania is generally very safe for solo travelers',
      'Road conditions can be rough outside main highways',
      'Mobile data coverage is good in tourist areas',
    ],
    followed: true,
  },
  {
    id: 'place_paris',
    name: 'Paris',
    country: 'France',
    coverImage: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80',
    followersCount: 1200000,
    trendingPosts: ['post_4'],
    travelTips: [
      'Paris Museum Pass saves time and money',
      'Visit the Eiffel Tower at night for the light show',
      'Montmartre and Le Marais for local neighbourhood vibes',
      'Learn a few French phrases, locals appreciate the effort',
    ],
    safetyNotes: [
      'Watch for pickpockets in tourist areas and on Metro',
      'Keep bags zipped and in front of your body',
    ],
    followed: false,
  },
  {
    id: 'place_tokyo',
    name: 'Tokyo',
    country: 'Japan',
    coverImage: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80',
    followersCount: 980000,
    trendingPosts: ['post_2'],
    travelTips: [
      'Get an IC card (Suica/Pasmo) for seamless transit',
      'Convenience stores (7-Eleven, Lawson) have amazing food',
      'Book popular restaurants weeks in advance',
      'Shibuya, Shinjuku, Asakusa — each feel like a different city',
    ],
    safetyNotes: [
      'Tokyo is one of the safest cities in the world',
      'Always be quiet on public transport, it is cultural norm',
    ],
    followed: false,
  },
  {
    id: 'place_amsterdam',
    name: 'Amsterdam',
    country: 'Netherlands',
    coverImage: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5702?w=600&q=80',
    followersCount: 512000,
    trendingPosts: [],
    travelTips: [
      'Rent a bike, it is the true Amsterdam experience',
      'Visit Jordaan neighbourhood for local cafés and markets',
      'Anne Frank House — book tickets months in advance',
      'Stroopwafels fresh from the market are life-changing',
    ],
    safetyNotes: [
      'Watch for cyclists, they have right of way everywhere',
      'Be aware of your surroundings in the Red Light District',
    ],
    followed: false,
  },
  {
    id: 'place_ksamil',
    name: 'Ksamil',
    country: 'Albania',
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
    followersCount: 18900,
    trendingPosts: ['post_1'],
    travelTips: [
      'Go in June or September to avoid the July–August rush',
      'Take a boat to the small islands just offshore',
      'Seafood restaurants along the promenade are excellent',
      'Butrint archaeological site is a 10-min drive, do not miss it',
    ],
    safetyNotes: [
      'Very safe destination, popular with families',
      'Water shoes recommended, some beaches are rocky',
    ],
    followed: true,
  },
  {
    id: 'place_lisbon',
    name: 'Lisbon',
    country: 'Portugal',
    coverImage: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&q=80',
    followersCount: 634000,
    trendingPosts: ['post_5'],
    travelTips: [
      'Tram 28 through Alfama is iconic — go early to avoid queues',
      'Pastéis de Belém for the original custard tarts',
      'LX Factory on weekends has amazing food and culture',
      'Sunset from Miradouro da Graça beats Miradouro de Santa Catarina',
    ],
    safetyNotes: [
      'Beware of pickpockets on Tram 28 and in Alfama',
      'Hills can be slippery in cobblestone areas when wet',
    ],
    followed: true,
  },
];

export const mockGroups: Group[] = [
  {
    id: 'group_1',
    name: 'Backpackers Europe',
    description: 'Budget travel tips, hostel reviews, hidden gems and route planning across Europe.',
    isPrivate: false,
    memberCount: 47800,
    coverImage: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=600&q=80',
    joined: true,
    requested: false,
  },
  {
    id: 'group_2',
    name: 'Solo Female Travelers',
    description: 'A safe, empowering space for women exploring the world alone. Tips, support and community.',
    isPrivate: false,
    memberCount: 92100,
    coverImage: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=80',
    joined: false,
    requested: false,
  },
  {
    id: 'group_3',
    name: 'Albania Hidden Tips',
    description: 'Secret spots, local knowledge and travel guides for the most underrated country in Europe.',
    isPrivate: false,
    memberCount: 8340,
    coverImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    joined: true,
    requested: false,
  },
  {
    id: 'group_4',
    name: 'Luxury Escapes',
    description: 'Curated luxury travel experiences, 5-star stays, private villas and first class adventures.',
    isPrivate: false,
    memberCount: 31600,
    coverImage: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80',
    joined: false,
    requested: false,
  },
  {
    id: 'group_5',
    name: 'Digital Nomads',
    description: 'Work from anywhere. Coworking spaces, visa tips, fast wifi spots and nomad city guides.',
    isPrivate: false,
    memberCount: 64200,
    coverImage: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=600&q=80',
    joined: false,
    requested: false,
  },
  {
    id: 'group_6',
    name: 'My Summer Trip 🌞',
    description: 'Private group for our summer 2026 trip. Planning, logistics and photos only for us.',
    isPrivate: true,
    memberCount: 6,
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
    joined: true,
    requested: false,
  },
  {
    id: 'group_7',
    name: 'Japan Deep Dive',
    description: 'Beyond Tokyo. Rural Japan, onsen culture, yen-saving tips and authentic local experiences.',
    isPrivate: true,
    memberCount: 2890,
    coverImage: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&q=80',
    joined: false,
    requested: true,
  },
];

export function addPost(post: Post): void {
  mockPosts = [post, ...mockPosts];
}

export function toggleLike(postId: string): void {
  mockPosts = mockPosts.map((p) => {
    if (p.id !== postId) return p;
    return {
      ...p,
      liked: !p.liked,
      likes: p.liked ? p.likes - 1 : p.likes + 1,
    };
  });
}

export function toggleSave(postId: string): void {
  mockPosts = mockPosts.map((p) => {
    if (p.id !== postId) return p;
    return { ...p, saved: !p.saved };
  });
}

export function toggleFollowPlace(placeId: string): void {
  const place = mockPlaces.find((pl) => pl.id === placeId);
  if (!place) return;
  place.followed = !place.followed;
  place.followersCount += place.followed ? 1 : -1;
}

export function toggleJoinGroup(groupId: string): void {
  const group = mockGroups.find((g) => g.id === groupId);
  if (!group) return;
  if (group.isPrivate && !group.joined) {
    group.requested = !group.requested;
  } else {
    group.joined = !group.joined;
    group.memberCount += group.joined ? 1 : -1;
  }
}
