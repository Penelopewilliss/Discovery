/**
 * Destinations service — Google Places API (New).
 * Set EXPO_PUBLIC_GOOGLE_PLACES_KEY in your .env file.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/op-overview
 */

const KEY: string = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? '';
const BASE = 'https://places.googleapis.com/v1';

const FEATURED_DESTINATIONS = [
  { wiki: 'Paris',          name: 'Paris',          country: 'France',         lat: 48.8566,  lon:  2.3522  },
  { wiki: 'Tokyo',          name: 'Tokyo',          country: 'Japan',          lat: 35.6762,  lon: 139.6503 },
  { wiki: 'Rome',           name: 'Rome',           country: 'Italy',          lat: 41.9028,  lon:  12.4964 },
  { wiki: 'Bali',           name: 'Bali',           country: 'Indonesia',      lat: -8.3405,  lon: 115.092  },
  { wiki: 'Barcelona',      name: 'Barcelona',      country: 'Spain',          lat: 41.3851,  lon:   2.1734 },
  { wiki: 'New York City',  name: 'New York',       country: 'USA',            lat: 40.7128,  lon: -74.006  },
  { wiki: 'Marrakesh',      name: 'Marrakech',      country: 'Morocco',        lat: 31.6295,  lon:  -7.9811 },
  { wiki: 'Santorini',      name: 'Santorini',      country: 'Greece',         lat: 36.3932,  lon:  25.4615 },
  { wiki: 'Dubai',          name: 'Dubai',          country: 'UAE',            lat: 25.2048,  lon:  55.2708 },
  { wiki: 'Kyoto',          name: 'Kyoto',          country: 'Japan',          lat: 35.0116,  lon: 135.7681 },
  { wiki: 'Amsterdam',      name: 'Amsterdam',      country: 'Netherlands',    lat: 52.3676,  lon:   4.9041 },
  { wiki: 'Cape Town',      name: 'Cape Town',      country: 'South Africa',   lat: -33.9249, lon:  18.4241 },
  { wiki: 'Istanbul',       name: 'Istanbul',       country: 'Turkey',         lat: 41.0082,  lon:  28.9784 },
  { wiki: 'Rio de Janeiro', name: 'Rio de Janeiro', country: 'Brazil',         lat: -22.9068, lon: -43.1729 },
  { wiki: 'Prague',         name: 'Prague',         country: 'Czech Republic', lat: 50.0755,  lon:  14.4378 },
  { wiki: 'Bangkok',        name: 'Bangkok',        country: 'Thailand',       lat: 13.7563,  lon: 100.5018 },
  { wiki: 'Vienna',         name: 'Vienna',         country: 'Austria',        lat: 48.2082,  lon:  16.3738 },
  { wiki: 'Lisbon',         name: 'Lisbon',         country: 'Portugal',       lat: 38.7169,  lon:  -9.1399 },
  { wiki: 'Singapore',      name: 'Singapore',      country: 'Singapore',      lat:  1.3521,  lon: 103.8198 },
  { wiki: 'Sydney',         name: 'Sydney',         country: 'Australia',      lat: -33.8688, lon: 151.2093 },
  { wiki: 'Havana',         name: 'Havana',         country: 'Cuba',           lat: 23.1136,  lon: -82.3666 },
  { wiki: 'Cairo',          name: 'Cairo',          country: 'Egypt',          lat: 30.0444,  lon:  31.2357 },
  { wiki: 'Mexico City',    name: 'Mexico City',    country: 'Mexico',         lat: 19.4326,  lon: -99.1332 },
  { wiki: 'Seoul',          name: 'Seoul',          country: 'South Korea',    lat: 37.5665,  lon: 126.978  },
  { wiki: 'Venice',         name: 'Venice',         country: 'Italy',          lat: 45.4408,  lon:  12.3155 },
  { wiki: 'Reykjavik',      name: 'Reykjavik',      country: 'Iceland',        lat: 64.1466,  lon: -21.9426 },
  { wiki: 'Petra',          name: 'Petra',          country: 'Jordan',         lat: 30.3285,  lon:  35.4444 },
  { wiki: 'Machu Picchu',   name: 'Machu Picchu',   country: 'Peru',           lat: -13.1631, lon: -72.545  },
  { wiki: 'Angkor Wat',     name: 'Angkor Wat',     country: 'Cambodia',       lat: 13.4125,  lon: 103.867  },
  { wiki: 'Maldives',       name: 'Maldives',       country: 'Maldives',       lat:  3.2028,  lon:  73.2207 },
];

interface GooglePhoto { name: string }
interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  photos?: GooglePhoto[];
  rating?: number;
  userRatingCount?: number;
  editorialSummary?: { text: string };
  reviews?: Array<{ text?: { text: string } }>;
}

/** Module-level caches — live for the whole app session. */
const _detailsCache = new Map<string, { googleId: string; photoNames: string[] }>();
let _featuredCache: FsqPlaceWithPhoto[] | null = null;

function photoUrl(photoName: string): string {
  return `${BASE}/${photoName}/media?maxWidthPx=800&key=${KEY}`;
}

const SEARCH_MASK = 'places.id,places.displayName,places.location,places.photos,places.userRatingCount,places.formattedAddress';

async function googleSearchText(query: string, limit = 1): Promise<GooglePlace[]> {
  if (!KEY) return [];
  try {
    const r = await fetch(`${BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': KEY,
        'X-Goog-FieldMask': SEARCH_MASK,
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'en', maxResultCount: limit }),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.places as GooglePlace[]) ?? [];
  } catch { return []; }
}

export interface FsqPlace {
  fsq_id: string;
  name: string;
  location: { country?: string; locality?: string };
  geocodes?: { main?: { latitude: number; longitude: number } };
  stats?: { total_ratings?: number };
}

export interface FsqPlaceWithPhoto extends FsqPlace {
  photoUrl: string;
}

/** Fetches 30 curated world destinations with Google Places photos. Cached per session. */
export async function getFeaturedPlaces(): Promise<FsqPlaceWithPhoto[]> {
  if (_featuredCache) return _featuredCache;

  const results = await Promise.all(
    FEATURED_DESTINATIONS.map(async (dest) => {
      const [place] = await googleSearchText(`${dest.name} ${dest.country}`);
      let photo = '';
      if (place) {
        const photoNames = (place.photos ?? []).map((p) => p.name);
        _detailsCache.set(dest.wiki, { googleId: place.id, photoNames });
        if (photoNames.length > 0) photo = photoUrl(photoNames[0]);
      }
      return {
        fsq_id: dest.wiki,
        name: dest.name,
        location: { country: dest.country },
        geocodes: { main: { latitude: dest.lat, longitude: dest.lon } },
        stats: { total_ratings: place?.userRatingCount ?? 50000 },
        photoUrl: photo,
      } as FsqPlaceWithPhoto;
    })
  );

  _featuredCache = results;
  return _featuredCache;
}

/** Search for destinations by text query. */
export async function searchFsqPlaces(query: string): Promise<FsqPlace[]> {
  const places = await googleSearchText(`${query} travel destination`, 20);
  return places.map((p) => {
    const photoNames = (p.photos ?? []).map((ph) => ph.name);
    _detailsCache.set(p.displayName?.text ?? p.id, { googleId: p.id, photoNames });
    const parts = (p.formattedAddress ?? '').split(',').map((s) => s.trim());
    return {
      fsq_id: p.displayName?.text ?? p.id,
      name: p.displayName?.text ?? 'Unknown',
      location: {
        country: parts[parts.length - 1] ?? '',
        locality: parts[0] ?? '',
      },
      geocodes: p.location
        ? { main: { latitude: p.location.latitude, longitude: p.location.longitude } }
        : undefined,
      stats: { total_ratings: p.userRatingCount ?? 1000 },
    };
  });
}

/** Returns up to 5 Google Places photos for a destination detail view. */
export async function getPlacePhotos(wiki: string): Promise<string[]> {
  let cached = _detailsCache.get(wiki);
  if (!cached) {
    const [place] = await googleSearchText(wiki);
    if (!place) return [];
    const photoNames = (place.photos ?? []).map((p) => p.name);
    cached = { googleId: place.id, photoNames };
    _detailsCache.set(wiki, cached);
  }
  return cached.photoNames.slice(0, 5).map(photoUrl);
}

/** Returns editorial summary + user reviews as tips for a destination. */
export async function getPlaceTips(wiki: string): Promise<string[]> {
  let cached = _detailsCache.get(wiki);
  if (!cached) {
    const [place] = await googleSearchText(wiki);
    if (!place) return [];
    cached = { googleId: place.id, photoNames: (place.photos ?? []).map((p) => p.name) };
    _detailsCache.set(wiki, cached);
  }
  if (!KEY) return [];
  try {
    const r = await fetch(`${BASE}/places/${cached.googleId}`, {
      headers: {
        'X-Goog-Api-Key': KEY,
        'X-Goog-FieldMask': 'editorialSummary,reviews',
      },
    });
    if (!r.ok) return [];
    const d: GooglePlace = await r.json();
    const tips: string[] = [];
    if (d.editorialSummary?.text) tips.push(d.editorialSummary.text);
    for (const rev of d.reviews ?? []) {
      const t = rev.text?.text ?? '';
      if (t.length > 30) tips.push(t);
      if (tips.length >= 6) break;
    }
    return tips;
  } catch { return []; }
}
