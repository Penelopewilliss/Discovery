import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { theme } from '../theme';
import { AuthStackParamList } from '../navigation/types';

WebBrowser.maybeCompleteAuthSession();

const googleLoginConfigured = Boolean(
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
);

function getGoogleUsername(user: User) {
  const fallback = user.displayName || 'traveler';
  const base = (user.email?.split('@')[0] || fallback)
    .replace(/[^a-zA-Z0-9._]/g, '')
    .toLowerCase();

  return base || 'traveler';
}

async function ensureGoogleUserProfile(user: User) {
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) return;

    const username = getGoogleUsername(user);
    await setDoc(userRef, {
      id: user.uid,
      name: user.displayName || username,
      username,
      email: user.email || '',
      avatarUri: user.photoURL || null,
      bio: '',
      homeCountry: '',
      interests: [],
      authProvider: 'google',
      createdAt: serverTimestamp(),
    });
  } catch (_) {}
}

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  const onBack = () => navigation.goBack();
  const onSignUp = () => navigation.navigate('SignUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // onAuthStateChanged in UserContext handles setting the user state
    } catch (e: any) {
      const msg =
        e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential'
          ? 'Incorrect email or password.'
          : e.message;
      Alert.alert('Login failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#07070F', '#12102A']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            {/* Back */}
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.accent]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <Text style={styles.logoText}>T</Text>
              </LinearGradient>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Log in to your HiddenGems account</Text>
            </View>

            {/* Fields */}
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="you@email.com"
                    placeholderTextColor={theme.colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Your password"
                    placeholderTextColor={theme.colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                    <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {/* Login button */}
            <TouchableOpacity onPress={handleLogin} style={styles.primaryBtn} disabled={loading}>
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.accent]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.primaryGradient}
              >
                <Text style={styles.primaryText}>{loading ? 'Logging in...' : 'Log In'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.authDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {googleLoginConfigured ? (
              <GoogleLoginButton disabled={loading} />
            ) : (
              <GoogleLoginUnavailableButton disabled={loading} />
            )}

            <TouchableOpacity onPress={onSignUp} style={styles.switchBtn}>
              <Text style={styles.switchText}>
                Don't have an account?{' '}
                <Text style={styles.switchLink}>Sign Up</Text>
              </Text>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function GoogleLoginButton({ disabled }: { disabled: boolean }) {
  const [loading, setLoading] = useState(false);
  const [request, response, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    selectAccount: true,
  });

  useEffect(() => {
    let active = true;

    const signInWithGoogleResponse = async () => {
      if (!response) return;

      if (response.type !== 'success') {
        if (response.type === 'error') {
          Alert.alert('Google login failed', response.error?.message ?? 'Please try again.');
        }
        setLoading(false);
        return;
      }

      const idToken = response.params?.id_token ?? response.authentication?.idToken;

      if (!idToken) {
        Alert.alert('Google login failed', 'Google did not return an ID token.');
        setLoading(false);
        return;
      }

      try {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        await ensureGoogleUserProfile(userCredential.user);
      } catch (e: any) {
        Alert.alert('Google login failed', e.message ?? 'Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    };

    signInWithGoogleResponse();

    return () => {
      active = false;
    };
  }, [response]);

  const handleGoogleLogin = async () => {
    if (!request || loading || disabled) return;

    setLoading(true);
    try {
      const result = await promptGoogleAsync();
      if (result.type !== 'success') setLoading(false);
    } catch (e: any) {
      Alert.alert('Google login failed', e.message ?? 'Please try again.');
      setLoading(false);
    }
  };

  const isDisabled = disabled || loading || !request;

  return (
    <TouchableOpacity
      onPress={handleGoogleLogin}
      style={[styles.googleBtn, isDisabled && styles.disabledBtn]}
      disabled={isDisabled}
      activeOpacity={0.85}
    >
      <View style={styles.googleMark}>
        <Text style={styles.googleMarkText}>G</Text>
      </View>
      <Text style={styles.googleText}>{loading ? 'Connecting...' : 'Continue with Google'}</Text>
    </TouchableOpacity>
  );
}

function GoogleLoginUnavailableButton({ disabled }: { disabled: boolean }) {
  const handleUnavailable = () => {
    if (disabled) return;

    Alert.alert(
      'Google login not configured',
      'Add your Google OAuth client IDs to .env, then restart Expo.'
    );
  };

  return (
    <TouchableOpacity
      onPress={handleUnavailable}
      style={[styles.googleBtn, disabled && styles.disabledBtn]}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <View style={styles.googleMark}>
        <Text style={styles.googleMarkText}>G</Text>
      </View>
      <Text style={styles.googleText}>Continue with Google</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40 },
  backBtn: { marginBottom: 24, alignSelf: 'flex-start' },
  backText: { color: theme.colors.textSecondary, fontSize: 15 },
  header: { alignItems: 'center', marginBottom: 36 },
  logoGradient: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: theme.colors.textMuted, fontSize: 14 },
  form: { gap: 20, marginBottom: 28 },
  fieldGroup: { gap: 8 },
  label: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    paddingVertical: 14,
  },
  eyeBtn: { padding: 6 },
  eyeText: { fontSize: 18 },
  forgotBtn: { alignSelf: 'flex-end' },
  forgotText: { color: theme.colors.primaryLight, fontSize: 13, fontWeight: '500' },
  primaryBtn: { borderRadius: theme.borderRadius.full, overflow: 'hidden', marginBottom: 16 },
  primaryGradient: { paddingVertical: 17, alignItems: 'center', borderRadius: theme.borderRadius.full },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  authDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  googleBtn: {
    height: 54,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  googleMark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
  },
  googleMarkText: { color: '#4285F4', fontSize: 17, fontWeight: '800' },
  googleText: { color: '#202124', fontSize: 16, fontWeight: '700' },
  disabledBtn: { opacity: 0.58 },
  switchBtn: { alignItems: 'center', paddingVertical: 10 },
  switchText: { color: theme.colors.textMuted, fontSize: 14 },
  switchLink: { color: theme.colors.primaryLight, fontWeight: '600' },
});
