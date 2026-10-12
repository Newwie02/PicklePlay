import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { glass, palette, type } from '../theme/glass';
import { initials } from '../lib/format';

type Props = {
  label: string;
  value: string | null;
  onChange: (dataUri: string | null) => void;
  firstName: string;
  lastName: string;
  error?: string | null;
};

/**
 * Photo chooser for Step 3. Sends a compact base64 data-URI to the API,
 * and falls back to an initials disc so the flow never blocks on permissions.
 */
export function AvatarPicker({ label, value, onChange, firstName, lastName, error }: Props) {
  const [busy, setBusy] = useState(false);

  const pick = async (source: 'library' | 'camera') => {
    try {
      setBusy(true);
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          source === 'camera'
            ? 'Camera access is off. You can allow it in Settings, or pick a photo instead.'
            : 'Photo access is off. You can allow it in Settings, or take a photo instead.'
        );
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.6,
              base64: true,
            });

      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const uri = asset.base64
        ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
        : asset.uri;
      onChange(uri);
    } catch {
      Alert.alert('Hmm, that did not work', 'We could not read that photo. Please try another one.');
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = () => {
    Alert.alert('Remove photo?', 'Your initials will be shown instead.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onChange(null) },
    ]);
  };

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.card, !!error && { borderColor: palette.danger }]}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.tint} />

        <View style={styles.inner}>
          <View style={styles.previewWrap}>
            {value ? (
              <Image source={{ uri: value }} style={styles.preview} />
            ) : (
              <View style={[styles.preview, styles.initials]}>
                <Text style={styles.initialsText}>{initials(firstName, lastName)}</Text>
              </View>
            )}
            {busy ? (
              <View style={styles.loading}>
                <ActivityIndicator color={palette.ink} />
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.action} onPress={() => pick('library')} disabled={busy}>
              <Ionicons name="image" size={17} color={palette.lime} />
              <Text style={styles.actionText}>Gallery</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={() => pick('camera')} disabled={busy}>
              <Ionicons name="camera" size={17} color={palette.lime} />
              <Text style={styles.actionText}>Camera</Text>
            </Pressable>
            {value ? (
              <Pressable style={styles.action} onPress={confirmRemove} disabled={busy}>
                <Ionicons name="trash" size={17} color={palette.danger} />
                <Text style={[styles.actionText, { color: palette.danger }]}>Remove</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.help}>
            {value
              ? 'Looking good! Tap Remove if you change your mind.'
              : 'Pick a photo so teammates can spot you — or use your initials.'}
          </Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  label: { ...type.caption, color: palette.white },
  card: {
    borderRadius: glass.innerRadius,
    borderWidth: 1,
    borderColor: glass.border,
    overflow: 'hidden',
  },
  tint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: glass.fill },
  inner: { padding: 16, alignItems: 'center', gap: 14 },
  previewWrap: { position: 'relative' },
  preview: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.16)' },
  initials: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.lime },
  initialsText: { fontSize: 32, fontWeight: '800', color: palette.lime },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: 10 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: glass.border,
  },
  actionText: { color: palette.white, fontSize: 13.5, fontWeight: '600' },
  help: { ...type.caption, fontSize: 12.5, textAlign: 'center' },
  error: { ...type.error },
});
