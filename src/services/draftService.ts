import AsyncStorage from '@react-native-async-storage/async-storage';
import { Post } from '../types';

const DRAFTS_KEY = 'local_post_drafts_v1';

export async function loadDrafts(): Promise<Post[]> {
  const raw = await AsyncStorage.getItem(DRAFTS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Post[]; } catch { return []; }
}

export async function saveDraft(draft: Post): Promise<void> {
  const existing = await loadDrafts();
  // replace if id exists
  const next = [draft, ...existing.filter((d) => d.id !== draft.id)].slice(0, 50);
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
}

export async function deleteDraft(id: string): Promise<void> {
  const existing = await loadDrafts();
  const next = existing.filter((d) => d.id !== id);
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
}

export default { loadDrafts, saveDraft, deleteDraft };
