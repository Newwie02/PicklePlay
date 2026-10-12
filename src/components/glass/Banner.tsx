import { StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';

/** A soft glass strip that shows one strict-but-friendly message. */
export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.wrap}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.tint} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,138,138,0.55)',
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  tint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(255,138,138,0.18)' },
  text: { color: '#FFE3E3', fontSize: 13.5, fontWeight: '500', lineHeight: 19 },
});

/** Green counterpart, for "saved!" moments. */
export function SuccessBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={[styles.wrap, { borderColor: 'rgba(212,243,74,0.55)' }]}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.tint, { backgroundColor: 'rgba(212,243,74,0.16)' }]} />
      <Text style={[styles.text, { color: '#F2FFD0' }]}>{message}</Text>
    </View>
  );
}
