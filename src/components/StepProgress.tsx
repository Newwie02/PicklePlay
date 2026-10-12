import type { ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../theme/glass';

/** The three-segment progress bar shown on every sign-up step. */
export function StepProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <View>
      <Text style={styles.caption}>Step {step} of 3</Text>
      <View style={styles.row}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.segment, n <= step ? styles.on : styles.off]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 13, fontWeight: '500', color: palette.muted, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 3 } as ViewStyle,
  on: { backgroundColor: palette.lime },
  off: { backgroundColor: 'rgba(255,255,255,0.25)' },
});
