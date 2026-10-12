import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { glass, palette, type } from '../theme/glass';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Props = {
  label: string;
  /** ISO date (YYYY-MM-DD) or '' when unset. */
  value: string;
  onChange: (iso: string) => void;
  error?: string | null;
  /** Oldest birthday we accept. */
  minYear?: number;
};

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** A glass calendar sheet — three wheels, no native dialog. */
export function GlassDatePicker({ label, value, onChange, error, minYear = 1940 }: Props) {
  const [open, setOpen] = useState(false);

  const now = useMemo(() => new Date(), []);
  const maxYear = now.getFullYear();

  const initial = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
    return { year: maxYear - 18, month: now.getMonth(), day: now.getDate() };
  }, [value, maxYear, now]);

  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);
  const [year, setYear] = useState(initial.year);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y--) list.push(y);
    return list;
  }, [maxYear, minYear]);

  const maxDay = daysInMonth(year, month);
  const days = useMemo(
    () => Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1),
    [year, month]
  );

  const display = value
    ? `${MONTH_SHORT[initial.month]} ${initial.day}, ${initial.year}`
    : '';

  const confirm = () => {
    const safeDay = Math.min(day, maxDay);
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
    onChange(iso);
    setOpen(false);
  };

  const openSheet = () => {
    setMonth(initial.month);
    setDay(Math.min(initial.day, daysInMonth(initial.year, initial.month)));
    setYear(initial.year);
    setOpen(true);
  };

  const renderColumn = <T,>(
    data: T[],
    key: (item: T) => string,
    selected: T,
    onSelect: (item: T) => void,
    title: string
  ) => (
    <View style={styles.column}>
      <Text style={styles.columnTitle}>{title}</Text>
      <FlatList
        data={data}
        keyExtractor={key}
        style={{ height: 220 }}
        showsVerticalScrollIndicator={false}
        initialScrollIndex={Math.max(0, data.indexOf(selected))}
        getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })}
        renderItem={({ item }) => {
          const active = item === selected;
          return (
            <Pressable onPress={() => onSelect(item)} style={[styles.cell, active && styles.cellActive]}>
              <Text style={[styles.cellText, active && { color: palette.ink, fontWeight: '700' }]}>
                {key(item)}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={openSheet} style={[styles.field, !!error && styles.fieldError]}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[styles.tint, !!error && { backgroundColor: 'rgba(255,138,138,0.16)' }]} />
        <Text style={[styles.value, !value && styles.placeholder]}>{display || 'Pick a date'}</Text>
        <Ionicons name="calendar" size={18} color={palette.lime} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.sheetTint} />
            <View style={styles.sheetInner}>
              <View style={styles.grabber} />
              <Text style={[type.h2, { marginBottom: 14 }]}>{label}</Text>

              <View style={styles.columns}>
                {renderColumn(MONTHS, (m) => m, MONTHS[month], (m) => setMonth(MONTHS.indexOf(m)), 'Month')}
                {renderColumn(days, (d) => String(d), Math.min(day, maxDay), setDay, 'Day')}
                {renderColumn(years, (y) => String(y), year, setYear, 'Year')}
              </View>

              <View style={styles.actions}>
                <Pressable onPress={() => setOpen(false)} style={styles.cancel}>
                  <Text style={type.caption}>Cancel</Text>
                </Pressable>
                <Pressable onPress={confirm} style={styles.done}>
                  <Text style={styles.doneText}>Set date</Text>
                </Pressable>
              </View>
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
  error: { ...type.error },
  backdrop: { flex: 1, backgroundColor: 'rgba(4,26,18,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.border,
  },
  sheetTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,61,42,0.9)' },
  sheetInner: { padding: 20, paddingBottom: 30 },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginBottom: 14,
  },
  columns: { flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  columnTitle: {
    ...type.caption,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cell: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginBottom: 4,
  },
  cellActive: { backgroundColor: palette.lime },
  cellText: { color: palette.white, fontSize: 14.5, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  cancel: {
    flex: 1,
    height: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: glass.border,
  },
  done: {
    flex: 2,
    height: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.lime,
  },
  doneText: { color: palette.ink, fontSize: 16, fontWeight: '700' },
});
