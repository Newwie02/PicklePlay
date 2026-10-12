import { Pressable, ActivityIndicator, StyleSheet, Text, ViewStyle } from 'react-native';
import { glass, palette } from '../../theme/glass';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function GlassButton({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: Props) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isDanger && styles.danger,
        !isPrimary && !isDanger && styles.secondary,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? palette.ink : palette.white} />
      ) : (
        <Text
          style={[
            styles.text,
            { color: isPrimary ? palette.ink : isDanger ? palette.danger : palette.white },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: palette.lime,
    shadowColor: palette.lime,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  secondary: {
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: glass.border,
  },
  danger: {
    backgroundColor: 'rgba(255,138,138,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,138,138,0.6)',
  },
  text: { fontSize: 16, fontWeight: '600' },
});
