import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette, type } from '../../theme/glass';

/** Title + optional trailing action, used above every list section. */
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={type.h2}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  link: { ...type.link, color: palette.lime },
});
