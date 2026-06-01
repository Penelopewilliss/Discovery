import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

type TravelJournal = {
  title: string;
  intro: string;
  days: Array<{ day: number; date?: string; entries: Array<{ time?: string; caption: string; media?: string[] }> }>;
  highlights: string[];
  captions: string[];
};

/**
 * Mock travel journal generator. In production this would call an AI endpoint.
 * For now it fetches posts for the user/trip and returns a plausible journal structure.
 */
export async function generateTravelJournal(userId: string, tripId?: string | null): Promise<TravelJournal> {
  // Fetch posts by user (optionally filtered to a trip via post.tripId if available)
  try {
    let q;
    if (tripId) {
      q = query(collection(db, 'posts'), where('userId', '==', userId), where('tripId', '==', tripId), orderBy('createdAt', 'asc'));
    } else {
      q = query(collection(db, 'posts'), where('userId', '==', userId), orderBy('createdAt', 'asc'));
    }
    const snap = await getDocs(q);
    const posts = snap.docs.map((d) => d.data());

    // Build mock structure
    const daysMap: Record<string, any> = {};
    for (const p of posts) {
      const created = p.createdAt?.toDate ? p.createdAt.toDate().toISOString() : (p.createdAt ?? new Date().toISOString());
      const date = created.split('T')[0];
      if (!daysMap[date]) daysMap[date] = [];
      daysMap[date].push({ time: created.split('T')[1]?.slice(0,5), caption: p.caption ?? '', media: (p.mediaItems || []).map((m: any) => m.uri) });
    }

    const days = Object.keys(daysMap).map((d, i) => ({ day: i+1, date: d, entries: daysMap[d] }));

    const highlights = posts.slice(0, 5).map((p: any) => p.caption ?? 'A memorable moment');
    const captions = posts.slice(0, 10).map((p: any) => `Remember when: ${ (p.caption || '').slice(0, 80) }`);

    const title = posts.length > 0 ? `Trip diary — ${posts[0].locationArea ?? posts[0].destination ?? 'My Trip'}` : 'My Travel Journal';
    const intro = `A short travel recap generated from ${posts.length} posts. Use this as a starting point — edit as you like.`;

    return { title, intro, days, highlights, captions };
  } catch (err) {
    // Fallback mock content when Firestore isn't available
    return {
      title: 'My Travel Journal (mock)',
      intro: 'This is a mock travel journal. Connect an AI service to generate richer content.',
      days: [{ day: 1, entries: [{ caption: 'Visited a hidden coffee spot with great vibes.' }] }],
      highlights: ['Sunset at the bay', 'Street food alley'],
      captions: ['Golden hour at the pier', 'Local market finds']
    };
  }
}

export default { generateTravelJournal };
