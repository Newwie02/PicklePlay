import type { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { glass } from '../../theme/glass';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  strong?: boolean;
  /**
   * Paints a rail down the card's left edge. Absolute, so it never shifts the
   * content, and it inherits the card's border radius via overflow hidden.
   */
  accent?: string;
};

/**
 * The glass card.
 *
 * The chrome (blur, tint, border, radius, shadow) and the content layout live
 * on ONE element on purpose. They used to be two nested views, with `style`
 * landing on the outer one — which meant `flexDirection`, `alignItems`, `gap`
 * and `padding` never reached the children, because those are properties of
 * the element that actually holds them. Rows rendered as columns, centered
 * empty states rendered left-aligned, and the inner `padding: 20` was added on
 * top of whatever padding the caller had already passed.
 *
 * Callers can therefore treat `style` as both the card's own style and the
 * layout of its contents: `<GlassCard style={{ flexDirection: 'row' }}>` lays
 * its children out in a row, and `padding` replaces the default 20 rather than
 * stacking with it.
 */
export function GlassCard({ children, style, intensity = glass.blurIntensity, strong = false, accent }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.tint, strong && { backgroundColor: glass.fillStrong }]} />
      {accent ? <View pointerEvents="none" style={[styles.accent, { backgroundColor: accent }]} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: glass.radius,
    borderWidth: 1,
    borderColor: glass.border,
    overflow: 'hidden',
    padding: 20,
    // Soft shadow gives the card lift against the gradient
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  tint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: glass.fill,
  },
  accent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },
});
