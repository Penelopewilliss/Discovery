import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import CreatePostScreen from './src/screens/CreatePostScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const TABS = [
  { name: 'Home', emoji: '🏠' },
  { name: 'Explore', emoji: '🔍' },
  { name: 'Create', emoji: '✈️' },
  { name: 'Groups', emoji: '👥' },
  { name: 'Profile', emoji: '👤' },
];

function TopBar({ active, onSelect }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#0A0A0F', '#12121A']} style={StyleSheet.absoluteFill} />
      <View style={styles.tabRow}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.logoGradient}
        >
          <Text style={styles.logoText}>TRAVLORA</Text>
        </LinearGradient>
        <View style={styles.tabs}>
          {TABS.map((tab) => {
            const focused = active === tab.name;
            return (
              <TouchableOpacity key={tab.name} onPress={() => onSelect(tab.name)} style={styles.tab}>
                <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{tab.name}</Text>
                {focused && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={styles.border} />
    </View>
  );
}

function Screen({ name }) {
  switch (name) {
    case 'Explore': return <ExploreScreen />;
    case 'Create': return <CreatePostScreen />;
    case 'Groups': return <GroupsScreen />;
    case 'Profile': return <ProfileScreen />;
    default: return <HomeScreen />;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.root}>
        <TopBar active={activeTab} onSelect={setActiveTab} />
        <View style={styles.screen}>
          <Screen name={activeTab} />
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  screen: { flex: 1 },
  tabBar: { backgroundColor: theme.colors.surface, zIndex: 100 },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    gap: theme.spacing.sm,
  },
  logoGradient: {
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: theme.spacing.xs,
  },
  logoText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  tabs: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  tab: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 6, position: 'relative' },
  tabEmoji: { fontSize: 22 },
  tabEmojiDim: { opacity: 0.45 },
  tabLabel: { fontSize: 10, color: theme.colors.textMuted, fontWeight: '500', marginTop: 2 },
  tabLabelActive: { color: theme.colors.primary },
  activeIndicator: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.primary,
  },
  border: { height: 1, backgroundColor: theme.colors.border },
});
