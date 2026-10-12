import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { glass, palette, type } from '../theme/glass';

type Props = {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  error?: string | null;
};

/** A 6-box glass code field. One input under the hood, six boxes on screen. */
export function OtpInput({ value, onChange, length = 6, error }: Props) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);
  };

  const boxes = Array.from({ length }, (_, i) => value[i] ?? '');

  return (
    <View style={styles.group}>
      <Pressable onPress={() => inputRef.current?.focus()} style={styles.row}>
        {boxes.map((char, i) => {
          const active = focused && i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              style={[
                styles.box,
                active && styles.boxActive,
                !!error && styles.boxError,
                char ? styles.boxFilled : null,
              ]}
            >
              <Text style={styles.digit}>{char}</Text>
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hidden}
      />

      {error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.hint}>Tap the boxes, then type the code.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  box: {
    flex: 1,
    height: 58,
    borderRadius: glass.innerRadius,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: palette.lime, backgroundColor: 'rgba(212,243,74,0.14)' },
  boxFilled: { backgroundColor: 'rgba(255,255,255,0.22)' },
  boxError: { borderColor: palette.danger },
  digit: { fontSize: 22, fontWeight: '700', color: palette.white },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  error: { ...type.error },
  hint: { ...type.caption, fontSize: 12 },
});
