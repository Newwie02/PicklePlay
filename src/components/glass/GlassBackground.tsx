import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { palette } from '../../theme/glass';

/**
 * Full-screen gradient with soft colored blobs behind the glass cards.
 * Place it as the first child of a screen, inside a View with flex: 1.
 */
export function GlassBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[palette.bgTop, palette.bgMid, palette.bgBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, { top: -70, right: -90, backgroundColor: palette.lime, opacity: 0.35 }]} />
      <View style={[styles.blob, { top: 320, left: -120, width: 280, height: 280, backgroundColor: palette.mint, opacity: 0.25 }]} />
      <View style={[styles.blob, { bottom: -60, right: 20, width: 200, height: 200, backgroundColor: palette.lime, opacity: 0.18 }]} />
      {/* Softens the blobs so they read as light, not shapes */}
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 999,
  },
});