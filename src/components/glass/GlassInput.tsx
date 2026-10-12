import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { glass, palette, type } from '../../theme/glass';

type Props = TextInputProps & {
  label: string;
  right?: ReactNode;
  error?: string | null;
  hint?: string;
  counter?: { length: number; max: number };
};

export function GlassInput({ label, right, error, hint, counter, multiline, ...inputProps }: Props) {
  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {counter ? (
          <Text style={[styles.counter, counter.length > counter.max && { color: palette.danger }]}>
            {counter.length}/{counter.max}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          !!error && styles.fieldError,
        ]}
      >
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[styles.tint, !!error && { backgroundColor: 'rgba(255,138,138,0.16)' }]} />
        <TextInput
          placeholderTextColor="rgba(255,255,255,0.55)"
          style={[styles.input, multiline && styles.inputMultiline]}
          multiline={multiline}
          {...inputProps}
        />
        {right}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...type.caption, color: palette.white },
  counter: { fontSize: 12, fontWeight: '600', color: palette.faint },
  field: {
    minHeight: 52,
    borderRadius: glass.innerRadius,
    borderWidth: 1,
    borderColor: glass.border,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  fieldMultiline: { minHeight: 96, alignItems: 'flex-start', paddingVertical: 14 },
  fieldError: { borderColor: palette.danger },
  tint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: glass.fill },
  input: { flex: 1, color: palette.white, fontSize: 15, paddingVertical: 14 },
  inputMultiline: { minHeight: 68, textAlignVertical: 'top', paddingVertical: 0 },
  error: { ...type.error },
  hint: { ...type.caption, fontSize: 12 },
});
