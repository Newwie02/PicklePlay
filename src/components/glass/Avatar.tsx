import { Image, StyleSheet, Text, View } from 'react-native';
import { palette } from '../../theme/glass';
import { initials } from '../../lib/format';

type Props = {
  avatar?: string | null;
  firstName: string;
  lastName: string;
  size?: number;
};

/** Shows the chosen photo, or a lime initials disc when there is none. */
export function Avatar({ avatar, firstName, lastName, size = 44 }: Props) {
  const radius = size / 2;
  if (avatar) {
    return (
      <Image
        source={{ uri: avatar }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: 'rgba(255,255,255,0.2)' }}
      />
    );
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>
        {initials(firstName, lastName)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: palette.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontWeight: '800', color: palette.ink },
});
