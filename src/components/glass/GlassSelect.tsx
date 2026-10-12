import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { glass, palette, type } from '../../theme/glass';

type Props = {
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  error?: string | null;
  searchable?: boolean;
};

/**
 * A glass dropdown. One tap opens a full list inside a glass sheet,
 * which keeps the native pickers out of the visual language.
 */
export function GlassSelect({
  label,
  placeholder,
  value,
  options,
  onSelect,
  error,
  searchable,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = searchable
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        style={[styles.field, !!error && styles.fieldError]}
      >
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[styles.tint, !!error && { backgroundColor: 'rgba(255,138,138,0.16)' }]} />
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.sheetTint} />
            <View style={styles.sheetInner}>
              <View style={styles.grabber} />
              <Text style={[type.h2, { marginBottom: 10 }]}>{label}</Text>

              {searchable ? (
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  style={styles.search}
                  autoCorrect={false}
                />
              ) : null}

              <FlatList
                data={filtered}
                keyExtractor={(item) => item}
                style={{ maxHeight: 360 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={[type.caption, { padding: 16 }]}>Nothing matched that search.</Text>
                }
                renderItem={({ item }) => {
                  const active = item === value;
                  return (
                    <Pressable
                      onPress={() => {
                        onSelect(item);
                        setOpen(false);
                      }}
                      style={[styles.option, active && styles.optionActive]}
                    >
                      <Text style={[styles.optionText, active && { color: palette.ink }]}>
                        {item}
                      </Text>
                      {active ? <Text style={styles.check}>✓</Text> : null}
                    </Pressable>
                  );
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  label: { ...type.caption, color: palette.white },
  field: {
    minHeight: 52,
    borderRadius: glass.innerRadius,
    borderWidth: 1,
    borderColor: glass.border,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  fieldError: { borderColor: palette.danger },
  tint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: glass.fill },
  value: { flex: 1, color: palette.white, fontSize: 15, paddingVertical: 15 },
  placeholder: { color: 'rgba(255,255,255,0.55)' },
  chevron: { color: palette.lime, fontSize: 18, fontWeight: '700' },
  error: { ...type.error },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,26,18,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.border,
    maxHeight: '80%',
  },
  sheetTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,61,42,0.86)' },
  sheetInner: { padding: 20, paddingBottom: 30 },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginBottom: 14,
  },
  search: {
    backgroundColor: glass.fill,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: glass.border,
    color: palette.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 15,
  },
  option: {
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionActive: { backgroundColor: palette.lime },
  optionText: { color: palette.white, fontSize: 15, fontWeight: '500' },
  check: { color: palette.ink, fontSize: 15, fontWeight: '800' },
});
