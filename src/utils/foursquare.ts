/**
 * Destinations service.
 * Uses Google Places API (New) when EXPO_PUBLIC_GOOGLE_PLACES_KEY is set.
 * Falls back to Photon (komoot, built on OSM) → Nominatim — free, no key needed.
 */

const KEY    = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? '';
const GBASE  = 'https://places.googleapis.com/v1';
const WIKI   = 'https://en.wikipedia.org/w/api.php';
const NOM    = 'https://nominatim.openstreetmap.org/search';
const PHOTON = 'https://photon.komoot.io/api';
const UA     = 'DiscoveryApp/1.0';

export const FEATURED_DESTINATIONS = [
  { wiki: 'Paris',          name: 'Paris',          country: 'France',         lat: 48.8566,  lon:   2.3522 },
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

// ─── Wikipedia helpers (always free, no key needed) ──────────────────────────

async function wikiThumb(title: string): Promise<string> {
  try {
    const params = new URLSearchParams({
      action: 'query', prop: 'pageimages', pithumbsize: '800',
      titles: title, format: 'json',
    });
    const r = await fetch(`${WIKI}?${params}&origin=*`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return '';
    const d = await r.json();
    const pages = Object.values(d?.query?.pages ?? {}) as any[];
    return pages[0]?.thumbnail?.source ?? '';
  } catch { return ''; }
}

async function wikiExtract(title: string): Promise<string> {
  try {
    const params = new URLSearchParams({
      action: 'query', prop: 'extracts', exintro: '1', exsentences: '8',
      explaintext: '1', titles: title, format: 'json',
    });
    const r = await fetch(`${WIKI}?${params}&origin=*`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return '';
    const d = await r.json();
    const pages = Object.values(d?.query?.pages ?? {}) as any[];
    return pages[0]?.extract ?? '';
  } catch { return ''; }
}

async function wikiImages(title: string): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      action: 'query', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '800',
      titles: title, generator: 'images', gimlimit: '20', format: 'json',
    });
    const r = await fetch(`${WIKI}?${params}&origin=*`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return [];
    const d = await r.json();
    const pages = Object.values(d?.query?.pages ?? {}) as any[];
    const urls: string[] = [];
    for (const page of pages) {
      const src: string = (page as any)?.thumbnail?.source ?? '';
      if (src && /\.(jpe?g|png)$/i.test(src)) urls.push(src);
      if (urls.length >= 5) break;
    }
    return urls;
  } catch { return []; }
}

function extractToTips(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 400)
    .slice(0, 6);
}

// ─── Google Places helpers (used when KEY is available) ──────────────────────

interface GooglePhoto { name: string }
interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  photos?: GooglePhoto[];
  userRatingCount?: number;
  editorialSummary?: { text: string };
  reviews?: Array<{ text?: { text: string } }>;
}

const _detailsCache = new Map<string, { googleId: string; photoNames: string[] }>();

function googlePhotoUrl(photoName: string): string {
  return `${GBASE}/${photoName}/media?maxWidthPx=800&key=${KEY}`;
}

async function googleSearch(query: string, limit = 1, signal?: AbortSignal): Promise<GooglePlace[]> {
  if (!KEY) return [];
  try {
    const r = await fetch(`${GBASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.photos,places.userRatingCount,places.formattedAddress',
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'en', maxResultCount: limit }),
      signal,
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.places as GooglePlace[]) ?? [];
  } catch { return []; }
}

// ─── Public exports ───────────────────────────────────────────────────────────

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

let _featuredCache: FsqPlaceWithPhoto[] | null = null;

export async function getFeaturedPlaces(): Promise<FsqPlaceWithPhoto[]> {
  if (_featuredCache) return _featuredCache;

  const results = await Promise.all(
    FEATURED_DESTINATIONS.map(async (dest) => {
      let photo = '';
      let ratingCount = 50000;

      // Try Google Places first
      const [gPlace] = await googleSearch(`${dest.name} ${dest.country}`);
      if (gPlace) {
        const photoNames = (gPlace.photos ?? []).map((p) => p.name);
        _detailsCache.set(dest.wiki, { googleId: gPlace.id, photoNames });
        if (photoNames.length > 0) photo = googlePhotoUrl(photoNames[0]);
        ratingCount = gPlace.userRatingCount ?? ratingCount;
      }

      // Fall back to Wikipedia thumbnail if no Google photo
      if (!photo) photo = await wikiThumb(dest.wiki);

      return {
        fsq_id: dest.wiki,
        name: dest.name,
        location: { country: dest.country },
        geocodes: { main: { latitude: dest.lat, longitude: dest.lon } },
        stats: { total_ratings: ratingCount },
        photoUrl: photo,
      } as FsqPlaceWithPhoto;
    })
  );

  _featuredCache = results;
  return _featuredCache;
}

export async function searchFsqPlaces(query: string, signal?: AbortSignal): Promise<FsqPlace[]> {
  // 1. Try Google Places (when key is available)
  const gPlaces = await googleSearch(`${query} travel destination`, 20, signal);
  if (gPlaces.length > 0) {
    return gPlaces.map((p) => {
      const photoNames = (p.photos ?? []).map((ph) => ph.name);
      _detailsCache.set(p.displayName?.text ?? p.id, { googleId: p.id, photoNames });
      const parts = (p.formattedAddress ?? '').split(',').map((s) => s.trim());
      return {
        fsq_id: p.displayName?.text ?? p.id,
        name: p.displayName?.text ?? 'Unknown',
        location: { country: parts[parts.length - 1] ?? '', locality: parts[0] ?? '' },
        geocodes: p.location
          ? { main: { latitude: p.location.latitude, longitude: p.location.longitude } }
          : undefined,
        stats: { total_ratings: p.userRatingCount ?? 1000 },
      };
    });
  }

  // 2. Photon (komoot) — full OpenStreetMap data, every place type, worldwide, no key
  try {
    const params = new URLSearchParams({ q: query, limit: '15', lang: 'en' });
    const r = await fetch(`${PHOTON}?${params}`, {
      headers: { 'User-Agent': UA },
      signal,
    });
    if (r.ok) {
      const json = await r.json();
      const features: any[] = json.features ?? [];
      // Filter out pure street/road results
      const SKIP_OSM_VALUES = new Set([
        'residential', 'unclassified', 'tertiary', 'secondary', 'primary',
        'trunk', 'motorway', 'path', 'footway', 'cycleway', 'track', 'service',
        'house', 'building',
      ]);
      const results: FsqPlace[] = features
        .filter((f: any) => {
          const props = f.properties ?? {};
          const osmValue: string = props.osm_value ?? '';
          if (SKIP_OSM_VALUES.has(osmValue)) return false;
          // Must have a name
          if (!props.name && !props.city && !props.locality) return false;
          return true;
        })
        .map((f: any) => {
          const props = f.properties ?? {};
          const [lon, lat] = f.geometry?.coordinates ?? [0, 0];
          const name = props.name || props.city || props.locality || props.county || props.state || '';
          const country = props.country ?? '';
          const locality = props.city || props.locality || props.county || '';
          return {
            fsq_id: `photon_${props.osm_id ?? Math.random()}`,
            name,
            location: { country, locality },
            geocodes: { main: { latitude: lat, longitude: lon } },
            stats: { total_ratings: 1000 },
          };
        })
        .filter((p) => p.name.length > 0);

      if (results.length > 0) return results;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return [];
  }

  // 3. Nominatim fallback (OpenStreetMap) — less strict filtering
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '20',
      addressdetails: '1',
      namedetails: '1',
    });
    const r = await fetch(`${NOM}?${params}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
      signal,
    });
    if (!r.ok) return [];
    const data: any[] = await r.json();
    const SKIP_TYPES = new Set([
      'path', 'track', 'service', 'residential', 'motorway', 'primary',
      'secondary', 'tertiary', 'trunk', 'unclassified', 'footway', 'cycleway',
      'house', 'building', 'yes', 'pedestrian', 'living_street',
    ]);
    return data
      .filter((item: any) => !SKIP_TYPES.has(item.type) && (item.name || item.namedetails?.name))
      .sort((a: any, b: any) => (b.importance ?? 0) - (a.importance ?? 0))
      .slice(0, 12)
      .map((item: any) => {
        const displayParts = (item.display_name as string).split(',').map((s: string) => s.trim());
        const name = item.namedetails?.name || item.name || displayParts[0];
        const country = item.address?.country ?? displayParts[displayParts.length - 1] ?? '';
        return {
          fsq_id: String(item.place_id),
          name,
          location: { country, locality: item.address?.city || item.address?.town || item.address?.village || '' },
          geocodes: { main: { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) } },
          stats: { total_ratings: Math.round((item.importance ?? 0.1) * 100000) },
        };
      });
  } catch (err: any) {
    if (err?.name === 'AbortError') return [];
    return [];
  }
}

export async function getPlacePhotos(wiki: string): Promise<string[]> {
  // Check Google cache first
  const cached = _detailsCache.get(wiki);
  if (cached?.photoNames.length) return cached.photoNames.slice(0, 5).map(googlePhotoUrl);

  // Try Google search
  if (KEY) {
    const [place] = await googleSearch(wiki);
    if (place) {
      const photoNames = (place.photos ?? []).map((p) => p.name);
      _detailsCache.set(wiki, { googleId: place.id, photoNames });
      if (photoNames.length) return photoNames.slice(0, 5).map(googlePhotoUrl);
    }
  }

  // Fall back to Wikipedia image gallery
  return wikiImages(wiki);
}

export async function getPlaceTips(wiki: string): Promise<string[]> {
  // Try Google Places reviews/editorial
  const cached = _detailsCache.get(wiki);
  if (cached?.googleId && KEY) {
    try {
      const r = await fetch(`${GBASE}/places/${cached.googleId}`, {
        headers: {
          'X-Goog-Api-Key': KEY,
          'X-Goog-FieldMask': 'editorialSummary,reviews',
        },
      });
      if (r.ok) {
        const d: GooglePlace = await r.json();
        const tips: string[] = [];
        if (d.editorialSummary?.text) tips.push(d.editorialSummary.text);
        for (const rev of d.reviews ?? []) {
          const t = rev.text?.text ?? '';
          if (t.length > 30) tips.push(t);
          if (tips.length >= 6) break;
        }
        if (tips.length) return tips;
      }
    } catch { /* fall through to Wikipedia */ }
  }

  // Fall back to Wikipedia extract
  const extract = await wikiExtract(wiki);
  return extractToTips(extract);
}
