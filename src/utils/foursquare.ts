/**
 * Destinations service — powered by OpenStreetMap Nominatim (city search)
 * and Wikipedia (photos + descriptions). No API key required.
 */

const WIKI = 'https://en.wikipedia.org/w/api.php';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'DiscoveryApp/1.0';

// 30 world-famous travel destinations with hardcoded coordinates
const FEATURED_DESTINATIONS = [
  { wiki: 'Paris',          name: 'Paris',          country: 'France',        lat: 48.8566,  lon: 2.3522   },
  { wiki: 'Tokyo',          name: 'Tokyo',          country: 'Japan',         lat: 35.6762,  lon: 139.6503 },
  { wiki: 'Rome',           name: 'Rome',           country: 'Italy',         lat: 41.9028,  lon: 12.4964  },
  { wiki: 'Bali',           name: 'Bali',           country: 'Indonesia',     lat: -8.3405,  lon: 115.092  },
  { wiki: 'Barcelona',      name: 'Barcelona',      country: 'Spain',         lat: 41.3851,  lon: 2.1734   },
  { wiki: 'New York City',  name: 'New York',       country: 'USA',           lat: 40.7128,  lon: -74.006  },
  { wiki: 'Marrakesh',      name: 'Marrakech',      country: 'Morocco',       lat: 31.6295,  lon: -7.9811  },
  { wiki: 'Santorini',      name: 'Santorini',      country: 'Greece',        lat: 36.3932,  lon: 25.4615  },
  { wiki: 'Dubai',          name: 'Dubai',          country: 'UAE',           lat: 25.2048,  lon: 55.2708  },
  { wiki: 'Kyoto',          name: 'Kyoto',          country: 'Japan',         lat: 35.0116,  lon: 135.7681 },
  { wiki: 'Amsterdam',      name: 'Amsterdam',      country: 'Netherlands',   lat: 52.3676,  lon: 4.9041   },
  { wiki: 'Cape Town',      name: 'Cape Town',      country: 'South Africa',  lat: -33.9249, lon: 18.4241  },
  { wiki: 'Istanbul',       name: 'Istanbul',       country: 'Turkey',        lat: 41.0082,  lon: 28.9784  },
  { wiki: 'Rio de Janeiro', name: 'Rio de Janeiro', country: 'Brazil',        lat: -22.9068, lon: -43.1729 },
  { wiki: 'Prague',         name: 'Prague',         country: 'Czech Republic',lat: 50.0755,  lon: 14.4378  },
  { wiki: 'Bangkok',        name: 'Bangkok',        country: 'Thailand',      lat: 13.7563,  lon: 100.5018 },
  { wiki: 'Vienna',         name: 'Vienna',         country: 'Austria',       lat: 48.2082,  lon: 16.3738  },
  { wiki: 'Lisbon',         name: 'Lisbon',         country: 'Portugal',      lat: 38.7169,  lon: -9.1399  },
  { wiki: 'Singapore',      name: 'Singapore',      country: 'Singapore',     lat: 1.3521,   lon: 103.8198 },
  { wiki: 'Sydney',         name: 'Sydney',         country: 'Australia',     lat: -33.8688, lon: 151.2093 },
  { wiki: 'Havana',         name: 'Havana',         country: 'Cuba',          lat: 23.1136,  lon: -82.3666 },
  { wiki: 'Cairo',          name: 'Cairo',          country: 'Egypt',         lat: 30.0444,  lon: 31.2357  },
  { wiki: 'Mexico City',    name: 'Mexico City',    country: 'Mexico',        lat: 19.4326,  lon: -99.1332 },
  { wiki: 'Seoul',          name: 'Seoul',          country: 'South Korea',   lat: 37.5665,  lon: 126.978  },
  { wiki: 'Venice',         name: 'Venice',         country: 'Italy',         lat: 45.4408,  lon: 12.3155  },
  { wiki: 'Reykjavík',      name: 'Reykjavík',      country: 'Iceland',       lat: 64.1466,  lon: -21.9426 },
  { wiki: 'Petra',          name: 'Petra',          country: 'Jordan',        lat: 30.3285,  lon: 35.4444  },
  { wiki: 'Machu Picchu',   name: 'Machu Picchu',   country: 'Peru',          lat: -13.1631, lon: -72.545  },
  { wiki: 'Angkor Wat',     name: 'Angkor Wat',     country: 'Cambodia',      lat: 13.4125,  lon: 103.8670 },
  { wiki: 'Maldives',       name: 'Maldives',       country: 'Maldives',      lat: 3.2028,   lon: 73.2207  },
];

// ─── Wikipedia helpers ────────────────────────────────────────────────────────

async function wikiThumb(title: string): Promise<string> {
  try {
    const p = new URLSearchParams({
      action: 'query', prop: 'pageimages', pithumbsize: '800',
      titles: title, format: 'json',
    });
    const r = await fetch(`${WIKI}?${p}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return '';
    const d = await r.json();
    const pages = Object.values(d.query?.pages ?? {}) as Record<string, unknown>[];
    const page = pages[0] as { thumbnail?: { source?: string } } | undefined;
    return page?.thumbnail?.source ?? '';
  } catch { return ''; }
}

async function wikiExtract(title: string): Promise<string> {
  try {
    const p = new URLSearchParams({
      action: 'query', prop: 'extracts', exintro: '1',
      exsentences: '8', explaintext: '1', titles: title, format: 'json',
    });
    const r = await fetch(`${WIKI}?${p}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return '';
    const d = await r.json();
    const pages = Object.values(d.query?.pages ?? {}) as Record<string, unknown>[];
    return (pages[0] as { extract?: string })?.extract ?? '';
  } catch { return ''; }
}

async function wikiImages(title: string): Promise<string[]> {
  try {
    const p = new URLSearchParams({
      action: 'query', prop: 'pageimages', piprop: 'thumbnail',
      pithumbsize: '800', titles: title,
      generator: 'images', gimlimit: '20', format: 'json',
    });
    const r = await fetch(`${WIKI}?${p}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return [];
    const d = await r.json();
    const pages = Object.values(d.query?.pages ?? {}) as Record<string, unknown>[];
    const urls: string[] = [];
    for (const page of pages) {
      const src = (page as { thumbnail?: { source?: string } }).thumbnail?.source ?? '';
      if (src && /\.(jpe?g|png)$/i.test(src)) urls.push(src);
      if (urls.length >= 5) break;
    }
    return urls;
  } catch { return []; }
}

function extractToTips(text: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 400)
    .slice(0, 6);
}

function countryFromDisplayName(displayName: string): string {
  const parts = displayName.split(',').map((s) => s.trim());
  return parts[parts.length - 1] ?? '';
}

// ─── Exported types (kept compatible with ExploreScreen) ─────────────────────

export interface FsqPlace {
  fsq_id: string; // Wikipedia article title used as stable ID
  name: string;
  location: { country?: string; locality?: string };
  geocodes?: { main?: { latitude: number; longitude: number } };
  stats?: { total_ratings?: number };
}

export interface FsqPlaceWithPhoto extends FsqPlace {
  photoUrl: string;
}

// Session-level cache
let _featuredCache: FsqPlaceWithPhoto[] | null = null;

// ─── Public API ───────────────────────────────────────────────────────────────

/** Load 30 featured world destinations with real Wikipedia photos. Cached. */
export async function getFeaturedPlaces(): Promise<FsqPlaceWithPhoto[]> {
  if (_featuredCache) return _featuredCache;

  const results = await Promise.all(
    FEATURED_DESTINATIONS.map(async (dest) => {
      const photo = await wikiThumb(dest.wiki);
      return {
        fsq_id: dest.wiki,
        name: dest.name,
        location: { country: dest.country },
        geocodes: { main: { latitude: dest.lat, longitude: dest.lon } },
        stats: { total_ratings: 50000 + dest.name.length * 3000 },
        photoUrl: photo,
      } as FsqPlaceWithPhoto;
    })
  );

  _featuredCache = results;
  return _featuredCache;
}

/** Search cities worldwide using OpenStreetMap Nominatim. */
export async function searchFsqPlaces(query: string): Promise<FsqPlace[]> {
  try {
    const p = new URLSearchParams({
      q: query, format: 'json', limit: '20',
      addressdetails: '1',
    });
    const r = await fetch(`${NOMINATIM}?${p}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
    });
    if (!r.ok) return [];
    const data: Array<{
      name: string;
      display_name: string;
      lat: string;
      lon: string;
      address?: { country?: string };
    }> = await r.json();

    return data.map((item) => ({
      fsq_id: item.name || item.display_name.split(',')[0].trim(),
      name: item.name || item.display_name.split(',')[0].trim(),
      location: {
        country: item.address?.country ?? countryFromDisplayName(item.display_name),
        locality: item.display_name.split(',')[0].trim(),
      },
      geocodes: {
        main: { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) },
      },
      stats: { total_ratings: 10000 },
    }));
  } catch { return []; }
}

/** Fetch up to 5 real Wikipedia photos for the detail view. */
export async function getPlacePhotos(wikiTitle: string): Promise<string[]> {
  return wikiImages(wikiTitle);
}

/** Fetch Wikipedia description split into readable tip sentences. */
export async function getPlaceTips(wikiTitle: string): Promise<string[]> {
  const extract = await wikiExtract(wikiTitle);
  return extractToTips(extract);
}


// Tourist attraction, landmark, museum, beach, nature, historic site
const CATS = '16032,16040,16026,10027,16020,16019';

const FEATURED_CITIES = [
  'Paris, France',
  'Tokyo, Japan',
  'Rome, Italy',
  'Bali, Indonesia',
  'Barcelona, Spain',
  'New York, USA',
  'Marrakech, Morocco',
  'Santorini, Greece',
  'Dubai, UAE',
  'Kyoto, Japan',
  'Amsterdam, Netherlands',
  'Cape Town, South Africa',
];

export interface FsqPlace {
  fsq_id: string;
  name: string;
  location: {
    country?: string;
    locality?: string;
    formatted_address?: string;
  };
  geocodes?: {
    main?: { latitude: number; longitude: number };
  };
  stats?: {
    total_ratings?: number;
  };
}

export interface FsqPlaceWithPhoto extends FsqPlace {
  photoUrl: string;
}

// Module-level cache — persists for the lifetime of the app session
let _featuredCache: FsqPlaceWithPhoto[] | null = null;

async function fetchFirstPhoto(fsqId: string): Promise<string> {
  try {
    const r = await fetch(`${BASE}/places/${fsqId}/photos?limit=1`, { headers: HDR });
    if (!r.ok) return '';
    const arr: Array<{ prefix: string; suffix: string }> = await r.json();
    if (!arr.length) return '';
    return `${arr[0].prefix}800x600${arr[0].suffix}`;
  } catch {
    return '';
  }
}

/** Fetches top attractions from a curated set of world cities. Results are cached. */
export async function getFeaturedPlaces(): Promise<FsqPlaceWithPhoto[]> {
  if (_featuredCache) return _featuredCache;

  const cityResults = await Promise.all(
    FEATURED_CITIES.map(async (near): Promise<FsqPlace[]> => {
      try {
        const params = new URLSearchParams({
          categories: CATS,
          near,
          limit: '3',
          fields: 'fsq_id,name,location,geocodes,stats',
          sort: 'RATING',
        });
        const r = await fetch(`${BASE}/places/search?${params}`, { headers: HDR });
        if (!r.ok) return [];
        const d: { results?: FsqPlace[] } = await r.json();
        return d.results ?? [];
      } catch {
        return [];
      }
    })
  );

  const all = cityResults.flat();
  const photos = await Promise.all(all.map((p) => fetchFirstPhoto(p.fsq_id)));
  _featuredCache = all.map((p, i) => ({ ...p, photoUrl: photos[i] }));
  return _featuredCache;
}

/** Search for places matching a free-text query. */
export async function searchFsqPlaces(query: string): Promise<FsqPlace[]> {
  try {
    const params = new URLSearchParams({
      query,
      categories: CATS,
      limit: '30',
      fields: 'fsq_id,name,location,geocodes,stats',
    });
    const r = await fetch(`${BASE}/places/search?${params}`, { headers: HDR });
    if (!r.ok) return [];
    const d: { results?: FsqPlace[] } = await r.json();
    return d.results ?? [];
  } catch {
    return [];
  }
}

/** Fetch up to 5 photos for a place detail view. */
export async function getPlacePhotos(fsqId: string): Promise<string[]> {
  try {
    const r = await fetch(`${BASE}/places/${fsqId}/photos?limit=5`, { headers: HDR });
    if (!r.ok) return [];
    const arr: Array<{ prefix: string; suffix: string }> = await r.json();
    return arr.map((p) => `${p.prefix}800x600${p.suffix}`);
  } catch {
    return [];
  }
}

/** Fetch the most popular user tips for a place. */
export async function getPlaceTips(fsqId: string): Promise<string[]> {
  try {
    const r = await fetch(`${BASE}/places/${fsqId}/tips?limit=6&sort=POPULAR`, { headers: HDR });
    if (!r.ok) return [];
    const arr: Array<{ text: string }> = await r.json();
    return arr.map((t) => t.text).filter(Boolean);
  } catch {
    return [];
  }
}
