import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { AuthStackParamList } from '../navigation/types';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const onGetStarted = () => navigation.navigate('SignUp');
  const onLogin = () => navigation.navigate('Login');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#07070F', '#12102A', '#1A0A2E']}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Logo */}
          <View style={styles.logoWrap}>
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Text style={styles.logoText}>T</Text>
            </LinearGradient>
            <Text style={styles.appName}>HiddenGems</Text>
          </View>

          <Text style={styles.tagline}>Your world.{'\n'}Your story.{'\n'}Your timeline.</Text>
          <Text style={styles.sub}>
            A social space built for travellers who want to share beautiful moments — safely, on their own terms.
          </Text>

          {/* Features */}
          <View style={styles.features}>
            {[
              { icon: '🛡️', text: 'Post with a safety delay — share after you leave' },
              { icon: '🌍', text: 'Discover places, groups & fellow travellers' },
              { icon: '✈️', text: 'Build your travel passport & stamp collection' },
            ].map((f) => (
              <View key={f.text} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          {/* Buttons */}
          <TouchableOpacity onPress={onGetStarted} style={styles.primaryBtn}>
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGradient}
            >
              <Text style={styles.primaryText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onLogin} style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>
              Already have an account?{' '}
              <Text style={styles.secondaryLink}>Log In</Text>
            </Text>
          </TouchableOpacity>

        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  orb1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: theme.colors.primary,
    opacity: 0.15,
    top: -80,
    right: -80,
  },
  orb2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: theme.colors.accent,
    opacity: 0.1,
    bottom: 100,
    left: -60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  logoGradient: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
  },
  appName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
  },
  tagline: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 44,
    marginBottom: 16,
  },
  sub: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 32,
  },
  features: {
    gap: 14,
    marginBottom: 40,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: { fontSize: 20 },
  featureText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  primaryBtn: {
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    marginBottom: 16,
  },
  primaryGradient: {
    paddingVertical: 17,
    alignItems: 'center',
    borderRadius: theme.borderRadius.full,
  },
  primaryText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  secondaryLink: {
    color: theme.colors.primaryLight,
    fontWeight: '600',
  },
});
