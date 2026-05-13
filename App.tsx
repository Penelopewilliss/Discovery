import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import CreatePostScreen from './src/screens/CreatePostScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import { UserProvider, useUser } from './src/context/UserContext';

type AuthState = 'welcome' | 'login' | 'signup' | 'setup' | 'app';

const TABS = [
  { name: 'Home', emoji: '🏠' },
  { name: 'Explore', emoji: '🔍' },
  { name: 'Create', emoji: '✈️' },
  { name: 'Groups', emoji: '👥' },
  { name: 'Profile', emoji: '👤' },
];

function TopBar({ active, onSelect }: { active: string; onSelect: (name: string) => void }) {
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
                <Text style={[styles.tabEmoji, !focused && styles.tabEmojiDim]}>{tab.emoji}</Text>
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

function MainScreen({ name }: { name: string }) {
  switch (name) {
    case 'Explore': return <ExploreScreen />;
    case 'Create': return <CreatePostScreen />;
    case 'Groups': return <GroupsScreen />;
    case 'Profile': return <ProfileScreen />;
    default: return <HomeScreen />;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <UserProvider>
        <AppNavigator />
      </UserProvider>
    </SafeAreaProvider>
  );
}

function AppNavigator() {
  const { setUser } = useUser();
  const [authState, setAuthState] = useState<AuthState>('welcome');
  const [activeTab, setActiveTab] = useState('Home');
  const [signUpData, setSignUpData] = useState({ name: '', username: '', email: '' });

  const saveAndEnter = async (userData: Parameters<typeof setUser>[0]) => {
    setUser(userData);
    try {
      await AsyncStorage.setItem('@travlora_user', JSON.stringify(userData));
    } catch (_) {}
    setAuthState('app');
  };

  const loginAndEnter = async (email: string) => {
    try {
      const stored = await AsyncStorage.getItem('@travlora_user');
      if (stored) {
        setUser(JSON.parse(stored));
      } else {
        // Build a basic profile from the email
        const namePart = email.split('@')[0].replace(/[^a-zA-Z]/g, ' ').trim();
        const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        setUser({ name, username: namePart.toLowerCase(), email, avatarUri: null, bio: '', homeCountry: '', interests: [] });
      }
    } catch (_) {}
    setAuthState('app');
  };

  if (authState === 'welcome') {
    return (
      <>
        <StatusBar style="light" />
        <WelcomeScreen
          onGetStarted={() => setAuthState('signup')}
          onLogin={() => setAuthState('login')}
        />
      </>
    );
  }

  if (authState === 'login') {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen
          onLogin={(email) => loginAndEnter(email)}
          onBack={() => setAuthState('welcome')}
          onSignUp={() => setAuthState('signup')}
        />
      </>
    );
  }

  if (authState === 'signup') {
    return (
      <>
        <StatusBar style="light" />
        <SignUpScreen
          onNext={(data) => { setSignUpData(data); setAuthState('setup'); }}
          onBack={() => setAuthState('welcome')}
          onLogin={() => setAuthState('login')}
        />
      </>
    );
  }

  if (authState === 'setup') {
    return (
      <>
        <StatusBar style="light" />
        <ProfileSetupScreen
          name={signUpData.name}
          username={signUpData.username}
          onComplete={(setupData) => {
            saveAndEnter({
              name: signUpData.name,
              username: signUpData.username,
              email: signUpData.email,
              avatarUri: setupData.avatarUri,
              bio: setupData.bio,
              homeCountry: setupData.homeCountry,
              interests: setupData.interests,
            });
          }}
        />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.root}>
        <TopBar active={activeTab} onSelect={setActiveTab} />
        <View style={styles.screen}>
          <MainScreen name={activeTab} />
        </View>
      </View>
    </>
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
