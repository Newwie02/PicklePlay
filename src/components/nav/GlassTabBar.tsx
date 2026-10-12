import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { glass, palette } from '../../theme/glass';

type Descriptor = {
  options: {
    title?: string;
    tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => ReactNode;
  };
};

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, Descriptor>;
  navigation: {
    emit: (event: { type: 'tabPress'; target: string }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

const ICON_SIZE = 23;

/**
 * The floating glass pill used by both the client and the owner tab layouts.
 * Sits above the home indicator and lights up the active tab in lime.
 */
export function GlassTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.tint} />
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const color = focused ? palette.lime : 'rgba(255,255,255,0.65)';

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.item}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
            >
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                {options.tabBarIcon ? options.tabBarIcon({ focused, color, size: ICON_SIZE }) : null}
              </View>
              <Text numberOfLines={1} style={[styles.label, { color }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 6,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.border,
    paddingVertical: 8,
    paddingHorizontal: 6,
    // Lift the pill off the screen
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  tint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,45,33,0.72)' },
  item: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  iconWrap: {
    width: 42,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: 'rgba(212,243,74,0.18)' },
  label: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
});
