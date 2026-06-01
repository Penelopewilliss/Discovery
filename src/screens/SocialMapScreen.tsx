import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LeafletMapView, { LMarker, LRegion } from '../components/LeafletMapView';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import PostCard from '../components/PostCard';
import { Post, TravelTag } from '../types';
import { theme } from '../theme';

const FILTERS: { key: string; label: string; tag?: TravelTag }[] = [
  { key: 'all', label: 'All' },
  { key: 'hidden', label: 'Hidden Gems', tag: 'hidden gem' },
  { key: 'food', label: 'Food', tag: 'food' },
  { key: 'beach', label: 'Beach', tag: 'beach' },
  { key: 'city', label: 'City', tag: 'city' },
  { key: 'nature', label: 'Nature', tag: 'nature' },
  { key: 'safety', label: 'Safety' },
  { key: 'local', label: 'Local Tips' },
];

export default function SocialMapScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Fetch recent published posts. We respect visibilityStatus if present.
        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Post));
        if (mounted) setPosts(docs.filter((p) => p.visibilityStatus ? p.visibilityStatus === 'published' : true));
      } catch (e) {
        console.warn('Map load failed', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const markers = useMemo(() => {
    const now = Date.now();
    return posts
      .filter((p) => {
        // Respect location privacy
        if (p.locationPrivacy === 'hidden') return false;
        if (p.visibilityStatus && p.visibilityStatus !== 'published') return false;
        if (filter !== 'all') {
          const f = FILTERS.find((x) => x.key === filter);
          if (f?.tag && (!p.tags || !p.tags.includes(f.tag))) return false;
          if (filter === 'safety' && !(p.tags || []).includes('safety')) return false;
        }
        return true;
      })
      .map((p) => {
        // Determine coordinates: prefer approximateLocation, otherwise try tripShare stopCoords or fallback
        let lat = p.approximateLocation?.lat ?? p.tripShare?.stopCoords?.[0]?.lat ?? 0;
        let lon = p.approximateLocation?.lon ?? p.tripShare?.stopCoords?.[0]?.lon ?? 0;
        // If approximate, jitter inside radius
        if (p.locationPrivacy === 'approximate' && p.approximateLocation) {
          const rKm = p.approximateLocation.radiusKm ?? 5;
          const jitterLat = (Math.random() - 0.5) * (rKm / 110); // rough conversion km->deg
          const jitterLon = (Math.random() - 0.5) * (rKm / 110);
          lat = lat + jitterLat;
          lon = lon + jitterLon;
        }
        return { id: p.id, latitude: lat, longitude: lon, label: p.caption?.slice(0, 80), sublabel: p.locationArea, raw: p } as any;
      })
      .filter((m) => m.latitude !== 0 || m.longitude !== 0);
  }, [posts, filter]);

  const region: LRegion = { latitude: 20, longitude: 0, latitudeDelta: 140, longitudeDelta: 140 };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Social Travel Map</Text>
      </View>
      <View style={styles.filterBar}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}>
            <Text style={[styles.filterTxt, filter === f.key && styles.filterTxtActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.mapWrap}>
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <LeafletMapView
            region={region}
            markers={markers}
            onMarkerPress={(id) => {
              const p = posts.find((x) => x.id === id);
              if (p) setSelectedPost(p);
            }}
          />
        )}
      </View>

      <Modal visible={!!selectedPost} animationType="slide">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            {selectedPost && (
              <PostCard post={selectedPost} onUpdate={() => {}} onDelete={() => setSelectedPost(null)} onArchive={() => setSelectedPost(null)} />
            )}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedPost(null)}>
            <Text style={styles.closeTxt}>Close</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: 12 },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  mapWrap: { flex: 1 },
  filterBar: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  filterBtn: { padding: 8, margin: 6, borderRadius: 18, backgroundColor: theme.colors.surface },
  filterBtnActive: { backgroundColor: theme.colors.primary },
  filterTxt: { color: theme.colors.textMuted },
  filterTxtActive: { color: '#fff' },
  closeBtn: { padding: 16, alignItems: 'center', borderTopWidth: 1, borderColor: theme.colors.border },
  closeTxt: { color: theme.colors.primary, fontWeight: '700' },
});
