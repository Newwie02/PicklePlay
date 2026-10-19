import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../theme/glass';

type Props = {
  /** Square size in dp. Works at any size (36 in the login header, 96 on a splash). */
  size?: number;
  style?: ViewStyle;
};

/**
 * PicklePlay logo mark — the app icon drawn with plain views, so it always
 * matches `assets/logo/icon.svg` without shipping any extra image assets.
 */
export function LogoMark({ size = 36, style }: Props) {
  const radius = size * 0.28;

  return (
    <View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: radius,
          shadowRadius: size * 0.3,
          elevation: 6,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[palette.bgBottom, palette.bgMid, palette.bgTop]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      >
        {/* Paddle */}
        <View style={styles.centered}>
          <View style={styles.paddle}>
            <View
              style={[
                styles.head,
                { width: size * 0.38, height: size * 0.5, borderRadius: size * 0.09 },
              ]}
            >
              <View
                style={[
                  styles.sheen,
                  { width: size * 0.12, height: size * 0.32, borderRadius: size * 0.06 },
                ]}
              />
            </View>
            <View
              style={[
                styles.handle,
                {
                  width: size * 0.105,
                  height: size * 0.28,
                  borderRadius: size * 0.055,
                  marginTop: -size * 0.015,
                },
              ]}
            >
              {/* Wrapped grip */}
              <View style={[styles.grip, { height: size * 0.155 }]} />
            </View>
          </View>
        </View>

        {/* Ball */}
        <View
          style={[
            styles.ball,
            {
              width: size * 0.19,
              height: size * 0.19,
              borderRadius: size * 0.095,
              top: size * 0.15,
              right: size * 0.12,
            },
          ]}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    backgroundColor: palette.bgTop,
    shadowColor: palette.lime,
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 0 },
  },
  centered: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paddle: { alignItems: 'center', transform: [{ rotate: '-18deg' }] },
  head: { backgroundColor: palette.lime, justifyContent: 'flex-start' },
  sheen: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginLeft: '8%',
    marginTop: '8%',
    alignSelf: 'flex-start',
  },
  handle: {
    backgroundColor: palette.white,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  grip: {
    backgroundColor: palette.bgTop,
    opacity: 0.8,
    width: '100%',
  },
  ball: { position: 'absolute', backgroundColor: palette.white },
});
