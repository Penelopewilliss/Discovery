import React, { useState } from 'react';
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
import { theme } from '../theme';

type Props = {
  onLogin: () => void;
  onBack: () => void;
  onSignUp: () => void;
};

export default function LoginScreen({ onLogin, onBack, onSignUp }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    // Simulate network call
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 800);
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
              <Text style={styles.subtitle}>Log in to your TRAVLORA account</Text>
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
  switchBtn: { alignItems: 'center', paddingVertical: 10 },
  switchText: { color: theme.colors.textMuted, fontSize: 14 },
  switchLink: { color: theme.colors.primaryLight, fontWeight: '600' },
});
