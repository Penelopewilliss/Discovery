import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../theme';
import { useUser } from '../context/UserContext';
import { LiveTripPin, CompletedLiveTrip, VisitedPlace } from '../context/UserContext';

type ManualStop = {
  id: string;
  placeName: string;
  photoUri?: string;
  note: string;
  timestamp: number;
  addToVisited: boolean;
};

const PRIVACY_OPTIONS: Array<{ value: CompletedLiveTrip['privacy']; label: string }> = [
  { value: 'public', label: '🌍 Public' },
  { value: 'followers', label: '👥 Followers' },
  { value: 'close-friends', label: '⭐ Close Friends' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function CreateTripModal({ visible, onClose }: Props) {
  const { addManualTrip, markVisited } = useUser();

  // Trip-level state
  const [tripName, setTripName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [privacy, setPrivacy] = useState<CompletedLiveTrip['privacy']>('public');
  const [stops, setStops] = useState<ManualStop[]>([]);

  // Add-stop sheet state
  const [showAddStop, setShowAddStop] = useState(false);
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [stopName, setStopName] = useState('');
  const [stopNote, setStopNote] = useState('');
  const [stopPhoto, setStopPhoto] = useState<string | undefined>();
  const [stopAddToVisited, setStopAddToVisited] = useState(true);

  const resetStopForm = () => {
    setStopName('');
    setStopNote('');
    setStopPhoto(undefined);
    setStopAddToVisited(true);
    setEditingStopId(null);
  };

  const openAddStop = () => {
    resetStopForm();
    setShowAddStop(true);
  };

  const openEditStop = (stop: ManualStop) => {
    setStopName(stop.placeName);
    setStopNote(stop.note);
    setStopPhoto(stop.photoUri);
    setStopAddToVisited(stop.addToVisited);
    setEditingStopId(stop.id);
    setShowAddStop(true);
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) setStopPhoto(result.assets[0].uri);
  };

  const confirmStop = () => {
    if (!stopName.trim()) {
      Alert.alert('Place name required', 'Enter the name of this stop.');
      return;
    }
    const stop: ManualStop = {
      id: editingStopId ?? `stop_${Date.now()}`,
      placeName: stopName.trim(),
      photoUri: stopPhoto,
      note: stopNote.trim(),
      timestamp: Date.now(),
      addToVisited: stopAddToVisited,
    };
    if (editingStopId) {
      setStops((prev) => prev.map((s) => (s.id === editingStopId ? stop : s)));
    } else {
      setStops((prev) => [...prev, stop]);
    }
    resetStopForm();
    setShowAddStop(false);
  };

  const removeStop = (id: string) =>
    setStops((prev) => prev.filter((s) => s.id !== id));

  const parseDate = (str: string): number => {
    if (!str.trim()) return Date.now();
    const d = new Date(str.trim());
    return isNaN(d.getTime()) ? Date.now() : d.getTime();
  };

  const saveTrip = () => {
    if (!tripName.trim()) {
      Alert.alert('Trip name required', 'Give your trip a name.');
      return;
    }
    if (stops.length === 0) {
      Alert.alert('No stops yet', 'Add at least one stop to your trip.');
      return;
    }

    const pins: LiveTripPin[] = stops.map((s) => ({
      id: s.id,
      latitude: 0,
      longitude: 0,
      photoUri: s.photoUri,
      note: s.note,
      placeName: s.placeName,
      timestamp: s.timestamp,
      addToVisited: s.addToVisited ? 'now' : 'no',
    }));

    const startedAt = parseDate(startDate) || pins[0].timestamp;
    const endedAt = parseDate(endDate) || pins[pins.length - 1].timestamp;

    const trip: CompletedLiveTrip = {
      id: `manual_${Date.now()}`,
      name: tripName.trim(),
      startedAt,
      endedAt,
      pins,
      privacy,
      status: 'active',
      source: 'manual',
    };

    // Mark chosen stops as visited
    stops.forEach((s) => {
      if (s.addToVisited) {
        const vp: VisitedPlace = {
          id: s.id,
          name: s.placeName,
          country: '',
          lat: 0,
          lon: 0,
          coverImage: s.photoUri ?? '',
          visitedAt: new Date(s.timestamp).toLocaleDateString(),
        };
        markVisited(vp);
      }
    });

    addManualTrip(trip);

    // Reset
    setTripName('');
    setStartDate('');
    setEndDate('');
    setPrivacy('public');
    setStops([]);
    onClose();
  };

  const resetAll = () => {
    setTripName('');
    setStartDate('');
    setEndDate('');
    setPrivacy('public');
    setStops([]);
    resetStopForm();
    setShowAddStop(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={resetAll} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add a Trip</Text>
          <TouchableOpacity onPress={saveTrip} style={[styles.headerBtn, styles.saveBtn]}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* Trip name */}
            <Text style={styles.label}>Trip Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Summer in Portugal"
              placeholderTextColor={theme.colors.textMuted}
              value={tripName}
              onChangeText={setTripName}
            />

            {/* Date range */}
            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Start Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. June 1, 2025"
                  placeholderTextColor={theme.colors.textMuted}
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>End Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. June 14, 2025"
                  placeholderTextColor={theme.colors.textMuted}
                  value={endDate}
                  onChangeText={setEndDate}
                />
              </View>
            </View>

            {/* Privacy */}
            <Text style={styles.label}>Who can see this?</Text>
            <View style={styles.privacyRow}>
              {PRIVACY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.privacyChip, privacy === opt.value && styles.privacyChipActive]}
                  onPress={() => setPrivacy(opt.value)}
                >
                  <Text style={[styles.privacyChipText, privacy === opt.value && styles.privacyChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Stops */}
            <View style={styles.stopsHeader}>
              <Text style={styles.label}>Stops ({stops.length})</Text>
            </View>

            {stops.length === 0 && (
              <Text style={styles.emptyStops}>
                Add the places you visited — with photos and notes.
              </Text>
            )}

            {stops.map((stop, i) => (
              <View key={stop.id} style={styles.stopCard}>
                <View style={styles.stopNumBadge}>
                  <Text style={styles.stopNum}>{i + 1}</Text>
                </View>
                <View style={styles.stopBody}>
                  <Text style={styles.stopName} numberOfLines={1}>{stop.placeName}</Text>
                  {stop.note ? <Text style={styles.stopNote} numberOfLines={2}>{stop.note}</Text> : null}
                  {stop.addToVisited && (
                    <Text style={styles.stopVisitedBadge}>📍 Added to visited</Text>
                  )}
                </View>
                {stop.photoUri ? (
                  <Image source={{ uri: stop.photoUri }} style={styles.stopThumb} />
                ) : null}
                <View style={styles.stopActions}>
                  <TouchableOpacity onPress={() => openEditStop(stop)}>
                    <Text style={styles.stopActionEdit}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeStop(stop.id)}>
                    <Text style={styles.stopActionDelete}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addStopBtn} onPress={openAddStop}>
              <Text style={styles.addStopBtnText}>+ Add a Stop</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Add/Edit Stop sheet */}
        <Modal visible={showAddStop} animationType="slide" presentationStyle="formSheet">
          <SafeAreaView style={styles.sheetRoot}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => { resetStopForm(); setShowAddStop(false); }}>
                <Text style={styles.headerBtnText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{editingStopId ? 'Edit Stop' : 'Add Stop'}</Text>
              <TouchableOpacity onPress={confirmStop} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>{editingStopId ? 'Update' : 'Add'}</Text>
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.label}>Place Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Alfama, Lisbon"
                  placeholderTextColor={theme.colors.textMuted}
                  value={stopName}
                  onChangeText={setStopName}
                />

                <Text style={styles.label}>Photo</Text>
                <TouchableOpacity style={styles.photoPickerBtn} onPress={pickPhoto}>
                  {stopPhoto ? (
                    <Image source={{ uri: stopPhoto }} style={styles.photoPreview} />
                  ) : (
                    <Text style={styles.photoPickerText}>📷  Tap to pick a photo</Text>
                  )}
                </TouchableOpacity>
                {stopPhoto && (
                  <TouchableOpacity onPress={() => setStopPhoto(undefined)}>
                    <Text style={styles.removePhoto}>Remove photo</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.label}>Note (optional)</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  placeholder="What did you do here? What was it like?"
                  placeholderTextColor={theme.colors.textMuted}
                  value={stopNote}
                  onChangeText={setStopNote}
                  multiline
                  numberOfLines={4}
                />

                <TouchableOpacity
                  style={styles.visitedRow}
                  onPress={() => setStopAddToVisited((v) => !v)}
                >
                  <View style={[styles.checkbox, stopAddToVisited && styles.checkboxChecked]}>
                    {stopAddToVisited && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.visitedLabel}>Add to My Travel Map</Text>
                    <Text style={styles.visitedSub}>Mark this place as visited on your map</Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  headerBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    color: theme.colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputMulti: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dateRow: {
    flexDirection: 'row',
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  privacyChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  privacyChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  privacyChipText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  privacyChipTextActive: {
    color: '#fff',
  },
  stopsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyStops: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 20,
    fontStyle: 'italic',
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stopNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNum: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  stopBody: {
    flex: 1,
    gap: 3,
  },
  stopName: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  stopNote: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  stopVisitedBadge: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  stopThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  stopActions: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
  },
  stopActionEdit: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  stopActionDelete: {
    color: theme.colors.error ?? '#FF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  addStopBtn: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
  },
  addStopBtnText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  sheetRoot: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  photoPickerBtn: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  photoPickerText: {
    color: theme.colors.textMuted,
    fontSize: 15,
  },
  removePhoto: {
    color: theme.colors.error ?? '#FF4444',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  visitedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  visitedLabel: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  visitedSub: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
});
