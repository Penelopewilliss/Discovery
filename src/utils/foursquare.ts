const FSQ_KEY = 'fsq3joi/CKjJHymaCKUhw0Jffyn1sI7b5PGh5fd30t+ega8=';
const BASE = 'https://api.foursquare.com/v3';
const HDR: Record<string, string> = { Authorization: FSQ_KEY, Accept: 'application/json' };

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
