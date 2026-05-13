import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../theme';

const INTERESTS = [
  'beach', 'food', 'hidden gem', 'city', 'nature',
  'budget', 'luxury', 'adventure', 'culture', 'solo',
  'backpacking', 'photography', 'hiking', 'road trips', 'islands',
];

type Props = {
  name: string;
  username: string;
  onComplete: () => void;
};

export default function ProfileSetupScreen({ name, username, onComplete }: Props) {
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [homeCountry, setHomeCountry] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access in settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const takeAvatar = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access in settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleComplete = () => {
    if (selectedInterests.length === 0) {
      Alert.alert('Pick your interests', 'Select at least one travel interest.');
      return;
    }
    onComplete();
  };

  const firstLetter = name ? name[0].toUpperCase() : 'T';

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#07070F', '#12102A', '#1A0A2E']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            {/* Progress */}
            <View style={styles.progressRow}>
              <View style={styles.progressDone} />
              <View style={styles.progressActive} />
            </View>

            <Text style={styles.title}>Set up your profile</Text>
            <Text style={styles.subtitle}>Hi {name.split(' ')[0]}! Tell travellers a little about you 🌍</Text>

            {/* Avatar */}
            <View style={styles.avatarSection}>
              <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrap}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <LinearGradient
                    colors={[theme.colors.primary, theme.colors.accent]}
                    style={styles.avatarPlaceholder}
                  >
                    <Text style={styles.avatarInitial}>{firstLetter}</Text>
                  </LinearGradient>
                )}
                <View style={styles.avatarEditBadge}>
                  <Text style={styles.avatarEditText}>📷</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.avatarBtns}>
                <TouchableOpacity onPress={pickAvatar} style={styles.avatarBtn}>
                  <Text style={styles.avatarBtnText}>Choose Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={takeAvatar} style={styles.avatarBtn}>
                  <Text style={styles.avatarBtnText}>Take Photo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bio */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Bio <Text style={styles.optional}>(optional)</Text></Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g. Solo traveller, chasing sunsets & street food 🌅"
                  placeholderTextColor={theme.colors.textMuted}
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={150}
                />
              </View>
              <Text style={styles.charCount}>{bio.length}/150</Text>
            </View>

            {/* Home Country */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Home Country <Text style={styles.optional}>(optional)</Text></Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. United Kingdom"
                  placeholderTextColor={theme.colors.textMuted}
                  value={homeCountry}
                  onChangeText={setHomeCountry}
                />
              </View>
            </View>

            {/* Travel Interests */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Travel Interests</Text>
              <Text style={styles.labelSub}>Pick everything that describes your travel style</Text>
              <View style={styles.chips}>
                {INTERESTS.map((interest) => {
                  const active = selectedInterests.includes(interest);
                  return (
                    <TouchableOpacity key={interest} onPress={() => toggleInterest(interest)}>
                      {active ? (
                        <LinearGradient
                          colors={[theme.colors.primary, theme.colors.accent]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={styles.chip}
                        >
                          <Text style={styles.chipTextActive}>{interest}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={styles.chipInactive}>
                          <Text style={styles.chipText}>{interest}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Complete */}
            <TouchableOpacity onPress={handleComplete} style={styles.primaryBtn}>
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.accent]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.primaryGradient}
              >
                <Text style={styles.primaryText}>Let's Go! ✈️</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onComplete} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip for now</Text>
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
  scroll: { padding: 24, paddingBottom: 48 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 28 },
  progressDone: { flex: 1, height: 3, borderRadius: 2, backgroundColor: theme.colors.primary },
  progressActive: { flex: 1, height: 3, borderRadius: 2, backgroundColor: theme.colors.accent },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 28 },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 42, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  avatarEditText: { fontSize: 14 },
  avatarBtns: { flexDirection: 'row', gap: 10 },
  avatarBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarBtnText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '500' },
  fieldGroup: { marginBottom: 20 },
  label: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  labelSub: { color: theme.colors.textMuted, fontSize: 12, marginBottom: 10 },
  optional: { color: theme.colors.textMuted, fontWeight: '400' },
  inputWrap: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
  },
  input: { color: theme.colors.text, fontSize: 15, paddingVertical: 14 },
  textArea: { minHeight: 80, paddingTop: 14 },
  charCount: { color: theme.colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
  },
  chipTextActive: { color: '#fff', fontSize: 13, fontWeight: '600' },
  chipInactive: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipText: { color: theme.colors.textMuted, fontSize: 13 },
  primaryBtn: { borderRadius: theme.borderRadius.full, overflow: 'hidden', marginBottom: 12, marginTop: 8 },
  primaryGradient: { paddingVertical: 17, alignItems: 'center', borderRadius: theme.borderRadius.full },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipText: { color: theme.colors.textMuted, fontSize: 13 },
});
