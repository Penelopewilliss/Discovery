import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { generateTravelJournal } from '../services/aiJournalService';
import { theme } from '../theme';

export default function PassiveContentScreen() {
  const [loading, setLoading] = useState(false);
  const [journal, setJournal] = useState<any | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const j = await generateTravelJournal('demo_user');
      setJournal(j);
    } catch (e) {
      setJournal(null);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700' }}>Passive Content Creator</Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>Generate trip recaps, caption ideas and mini-guides from your posts.</Text>

        <TouchableOpacity onPress={handleGenerate} style={{ marginTop: 16, padding: 12, backgroundColor: theme.colors.primary, borderRadius: 8 }}>
          <Text style={{ color: '#fff', textAlign: 'center' }}>{loading ? 'Generating…' : 'Generate Travel Journal (mock)'}</Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator style={{ marginTop: 16 }} color={theme.colors.primary} />}

        {journal && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>{journal.title}</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>{journal.intro}</Text>
            <Text style={{ color: theme.colors.text, marginTop: 12, fontWeight: '600' }}>Highlights</Text>
            {journal.highlights.map((h: string, i: number) => <Text key={i} style={{ color: theme.colors.text }}>{i+1}. {h}</Text>)}
            <Text style={{ color: theme.colors.text, marginTop: 12, fontWeight: '600' }}>Caption Ideas</Text>
            {journal.captions.map((c: string, i: number) => <Text key={i} style={{ color: theme.colors.textMuted }}>{c}</Text>)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
