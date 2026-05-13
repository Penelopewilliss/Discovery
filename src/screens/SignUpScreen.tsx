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
  onNext: (data: { name: string; username: string; email: string }) => void;
  onBack: () => void;
  onLogin: () => void;
};

export default function SignUpScreen({ onNext, onBack, onLogin }: Props) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleNext = () => {
    if (!name.trim() || !username.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (username.includes('@')) {
      Alert.alert('Invalid username', 'Username cannot contain @. Just use letters, numbers and dots.');
      return;
    }
    onNext({ name, username: username.replace(/[^a-zA-Z0-9._]/g, '').toLowerCase(), email });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#07070F', '#12102A']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>Join the TRAVLORA community</Text>
            </View>

            <View style={styles.form}>
              {[
                { label: 'Full Name', value: name, setter: setName, placeholder: 'Your full name', auto: 'words' as const },
                { label: 'Username', value: username, setter: setUsername, placeholder: '@yourusername', auto: 'none' as const },
                { label: 'Email', value: email, setter: setEmail, placeholder: 'you@email.com', auto: 'none' as const, keyboard: 'email-address' as const },
              ].map((field) => (
                <View key={field.label} style={styles.fieldGroup}>
                  <Text style={styles.label}>{field.label}</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      placeholder={field.placeholder}
                      placeholderTextColor={theme.colors.textMuted}
                      value={field.value}
                      onChangeText={field.setter}
                      autoCapitalize={field.auto}
                      autoCorrect={false}
                      keyboardType={field.keyboard}
                    />
                  </View>
                </View>
              ))}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Min 6 characters"
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

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="Repeat password"
                    placeholderTextColor={theme.colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </View>

            <Text style={styles.terms}>
              By signing up you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>

            <TouchableOpacity onPress={handleNext} style={styles.primaryBtn}>
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.accent]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.primaryGradient}
              >
                <Text style={styles.primaryText}>Continue →</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onLogin} style={styles.switchBtn}>
              <Text style={styles.switchText}>
                Already have an account?{' '}
                <Text style={styles.switchLink}>Log In</Text>
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
  header: { marginBottom: 32 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: theme.colors.textMuted, fontSize: 14 },
  form: { gap: 18, marginBottom: 20 },
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
  input: { flex: 1, color: theme.colors.text, fontSize: 15, paddingVertical: 14 },
  eyeBtn: { padding: 6 },
  eyeText: { fontSize: 18 },
  terms: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 24 },
  termsLink: { color: theme.colors.primaryLight, fontWeight: '500' },
  primaryBtn: { borderRadius: theme.borderRadius.full, overflow: 'hidden', marginBottom: 16 },
  primaryGradient: { paddingVertical: 17, alignItems: 'center', borderRadius: theme.borderRadius.full },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  switchBtn: { alignItems: 'center', paddingVertical: 10 },
  switchText: { color: theme.colors.textMuted, fontSize: 14 },
  switchLink: { color: theme.colors.primaryLight, fontWeight: '600' },
});
