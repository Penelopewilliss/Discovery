import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Dimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import CreatePostScreen from './src/screens/CreatePostScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ChatScreen from './src/screens/ChatScreen';
import SearchScreen from './src/screens/SearchScreen';
import PassportScreen from './src/screens/PassportScreen';
import { UserProvider, useUser } from './src/context/UserContext';

const SCREEN_W = Dimensions.get('window').width;
import { AuthStackParamList, RootStackParamList } from './src/navigation/types';

// Configure how notifications appear when app is in foreground
// (expo-notifications requires a dev build — handler is no-op in Expo Go)

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const TABS = [
  { name: 'Feed', emoji: '🏠' },
  { name: 'Passport', emoji: '🛂' },
  { name: 'Groups', emoji: '👥' },
  { name: 'Search', emoji: '🔎' },
  { name: 'Messages', emoji: '💬' },
  { name: 'Profile', emoji: '👤' },
];

function TopBar({ active, onSelect }: { active: string; onSelect: (name: string) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#0A0A0F', '#12121A']} style={StyleSheet.absoluteFill} />
      <Text style={styles.brandName}>HiddenGems</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
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
      </ScrollView>
      <View style={styles.border} />
    </View>
  );
}

function MainScreen({ name }: { name: string }) {
  switch (name) {
    case 'Groups': return <GroupsScreen />;
    case 'Messages': return <MessagesScreen />;
    case 'Search': return <SearchScreen />;
    case 'Passport': return <PassportScreen />;
    case 'Profile': return <ProfileScreen />;
    default: return <HomeScreen />;
  }
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('Feed');
  const [showCreate, setShowCreate] = useState(false);
  const insets = useSafeAreaInsets();

  const handleTabSelect = (name: string) => {
    setActiveTab(name);
    setShowCreate(false);
  };

  const handleFab = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowCreate((v) => !v);
  };

  return (
    <View style={styles.root}>
      <TopBar active={showCreate ? '' : activeTab} onSelect={handleTabSelect} />
      <View style={styles.screen}>
        {showCreate ? <CreatePostScreen /> : <MainScreen name={activeTab} />}
      </View>
      {/* Floating create button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={handleFab}
        activeOpacity={0.85}
      >
        <LinearGradient colors={[theme.colors.primary, theme.colors.accent]} style={styles.fabGrad}>
          <Text style={styles.fabIcon}>{showCreate ? '✕' : '+'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </AuthStack.Navigator>
  );
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
  const { user, authLoading } = useUser();

  if (authLoading) {
    return (
      <View style={styles.splash}>
        <LinearGradient colors={['#07070F', '#12102A', '#1A0A2E']} style={StyleSheet.absoluteFill} />
        <Text style={styles.splashLogo}>✈️</Text>
        <Text style={styles.splashBrand}>HiddenGems</Text>
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  const isLoggedIn = !!user?.email;

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      {isLoggedIn ? (
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="MainApp" component={MainApp} />
          <RootStack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </RootStack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  screen: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  splashLogo: { fontSize: 56, marginBottom: 12 },
  splashBrand: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: 1,
  },
  tabBar: { backgroundColor: theme.colors.surface, zIndex: 100 },
  brandName: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
    paddingTop: 6,
    paddingBottom: 1,
  },
  tabs: { flexDirection: 'row', paddingBottom: 8, paddingHorizontal: 4 },
  tab: { width: Math.floor(SCREEN_W / 6), alignItems: 'center', paddingVertical: 4, position: 'relative' },
  tabEmoji: { fontSize: 18 },
  tabEmojiDim: { opacity: 0.45 },
  tabLabel: { fontSize: 8, color: theme.colors.textMuted, fontWeight: '500', marginTop: 2 },
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
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabGrad: {
    flex: 1,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
});
