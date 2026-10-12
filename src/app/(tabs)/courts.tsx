import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassBackground } from '../../components/glass/GlassBackground';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassInput } from '../../components/glass/GlassInput';
import { ErrorBanner, SuccessBanner } from '../../components/glass/Banner';
import { DbError, createBooking, fetchSlotsForDay } from '../../lib/db';
import { formatDate, formatTime, VENUE } from '../../lib/format';
import type { Court, SlotState } from '../../lib/types';
import { glass, palette, type } from '../../theme/glass';

type SlotsResponse = { date: string; slots: { court: Court; slots: SlotState[] }[] };

const COURT_FEE = 250;

function nextDays(count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CourtsScreen() {
  const days = nextDays(7);
  const [date, setDate] = useState(days[0]);
  const [courtId, setCourtId] = useState<string | null>(null);
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Payment checkout sheet state
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedSlotTime, setSelectedSlotTime] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'gcash'>('bank');
  const [refNumber, setRefNumber] = useState('');
  const [note, setNote] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchSlotsForDay(date);
      setData(res);
      if (!courtId && res.slots.length) setCourtId(res.slots[0].court.id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load court times.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date, courtId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const selected = data?.slots.find((s) => s.court.id === courtId) ?? null;

  const openBookingSheet = (time: string) => {
    setSelectedSlotTime(time);
    setPaymentMethod('bank');
    setRefNumber('');
    setNote('');
    setSheetError(null);
    setSheetVisible(true);
  };

  const confirmAndPay = async () => {
    if (!courtId || !selectedSlotTime) return;

    if (!refNumber.trim()) {
      setSheetError(
        paymentMethod === 'bank'
          ? 'Please enter your Bank Transfer reference number.'
          : 'Please enter your GCash reference number.'
      );
      return;
    }

    setSheetError(null);
    setSubmitting(true);

    try {
      await createBooking({
        courtId,
        date,
        time: selectedSlotTime,
        note: note.trim(),
        // Passing this is what holds the slot as 'pending' instead of
        // confirming it outright — the admin has to match the reference first.
        payment: { method: paymentMethod, reference: refNumber.trim() },
      });
      setSheetVisible(false);
      setSuccess(
        `Slot held for ${formatTime(selectedSlotTime)} on ${formatDate(date)}. The admin will check your ${
          paymentMethod === 'bank' ? 'Bank Transfer' : 'GCash'
        } reference — it shows as Pending until they approve it.`
      );
      await load();
    } catch (e) {
      setSheetError(e instanceof DbError ? e.message : 'Something went wrong. Please try again.');
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const slotLabel = (slot: SlotState) => {
    if (slot.status === 'booked') return slot.mine ? 'You' : slot.bookedBy ?? 'Booked';
    if (slot.status === 'past') return 'Closed';
    return 'Open';
  };

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.lime} />}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text style={type.h1}>Book a court</Text>
            <Text style={[type.caption, { marginTop: 4 }]}>{VENUE}</Text>
          </View>

          {/* ---------- Date strip ---------- */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
            {days.map((d) => {
              const active = d === date;
              const day = new Date(`${d}T00:00:00`);
              return (
                <Pressable key={d} onPress={() => setDate(d)} style={[styles.dateChip, active && styles.dateChipActive]}>
                  <Text style={[styles.dateChipDay, active && { color: palette.ink }]}>
                    {WEEKDAY[day.getDay()]}
                  </Text>
                  <Text style={[styles.dateChipNum, active && { color: palette.ink }]}>{day.getDate()}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ErrorBanner message={error} />
          <SuccessBanner message={success} />

          {/* ---------- Court tabs ---------- */}
          <View style={styles.courtTabs}>
            {(data?.slots ?? []).map((s) => {
              const active = s.court.id === courtId;
              return (
                <Pressable key={s.court.id} onPress={() => setCourtId(s.court.id)} style={[styles.courtTab, active && styles.courtTabActive]}>
                  <Text style={[styles.courtTabText, active && { color: palette.ink }]}>
                    Court {s.court.number}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ---------- Slots ---------- */}
          {loading && !data ? (
            <View style={styles.loading}>
              <ActivityIndicator color={palette.lime} size="large" />
              <Text style={type.caption}>Loading court times…</Text>
            </View>
          ) : selected ? (
            <GlassCard>
              <Text style={type.h2}>{formatDate(date)}</Text>
              <View style={styles.slotGrid}>
                {selected.slots.map((slot) => {
                  const open = slot.status === 'available';
                  const busy = submitting && selectedSlotTime === slot.time;
                  return (
                    <Pressable
                      key={slot.time}
                      disabled={!open || busy}
                      onPress={() => openBookingSheet(slot.time)}
                      style={[
                        styles.slot,
                        open ? styles.slotOpen : styles.slotClosed,
                        slot.mine && styles.slotMine,
                        busy && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={[styles.slotTime, !open && { color: palette.faint }]}>
                        {formatTime(slot.time)}
                      </Text>
                      <Text
                        style={[
                          styles.slotState,
                          { color: open ? palette.lime : palette.faint },
                          slot.mine && { color: palette.mint },
                        ]}
                      >
                        {busy ? 'Booking…' : slotLabel(slot)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.legend}>
                <Legend color={palette.lime} label="Open — tap to book" />
                <Legend color="rgba(255,255,255,0.35)" label="Booked / past" />
                <Legend color={palette.mint} label="Your booking" />
              </View>
            </GlassCard>
          ) : (
            <Text style={type.caption}>No courts available for that day.</Text>
          )}

          <GlassCard style={styles.ruleCard}>
            <Ionicons name="information-circle" size={17} color={palette.mint} />
            <Text style={[type.caption, { flex: 1 }]}>
              Times that already started can&apos;t be booked — including the slot happening right now.
              Pick the next open one instead.
            </Text>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>

      {/* ---------- Payment & Booking Checkout Modal ---------- */}
      <Modal
        visible={sheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !submitting && setSheetVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => !submitting && setSheetVisible(false)}
          >
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <ScrollView contentContainerStyle={styles.sheetInner} keyboardShouldPersistTaps="handled">
                <View style={styles.grabber} />

                <View>
                  <Text style={styles.sheetTitle}>Confirm & Pay</Text>
                  <Text style={styles.sheetSub}>
                    {selected ? `Court ${selected.court.number}` : 'Court'} · {formatDate(date)} ·{' '}
                    {selectedSlotTime ? formatTime(selectedSlotTime) : ''}
                  </Text>
                </View>

                {/* Booking Summary Card */}
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.summaryCourtName}>
                        {selected?.court.name ?? 'Court'} (1 hour)
                      </Text>
                      <Text style={styles.summaryVenue} numberOfLines={1}>
                        {selected?.court.venue ?? VENUE}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.summaryPrice}>₱{COURT_FEE}</Text>
                      <Text style={styles.summaryRateLabel}>Hourly slot</Text>
                    </View>
                  </View>
                </View>

                {/* Payment Method Selector */}
                <Text style={styles.sectionLabel}>Select Payment Method</Text>
                <View style={styles.payMethodRow}>
                  <Pressable
                    onPress={() => setPaymentMethod('bank')}
                    style={[styles.payMethodChip, paymentMethod === 'bank' && styles.payMethodChipActive]}
                  >
                    <Ionicons
                      name="business"
                      size={14}
                      color={paymentMethod === 'bank' ? palette.ink : palette.white}
                    />
                    <Text
                      style={[
                        styles.payMethodText,
                        paymentMethod === 'bank' && styles.payMethodTextActive,
                      ]}
                    >
                      Bank Transfer
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setPaymentMethod('gcash')}
                    style={[styles.payMethodChip, paymentMethod === 'gcash' && styles.payMethodChipActive]}
                  >
                    <Ionicons
                      name="phone-portrait"
                      size={14}
                      color={paymentMethod === 'gcash' ? palette.ink : palette.white}
                    />
                    <Text
                      style={[
                        styles.payMethodText,
                        paymentMethod === 'gcash' && styles.payMethodTextActive,
                      ]}
                    >
                      GCash
                    </Text>
                  </Pressable>
                </View>

                {/* Method Specific Details */}
                {paymentMethod === 'bank' && (
                  <View style={styles.bankInfoCard}>
                    <View style={styles.autoConfirmBadge}>
                      <Ionicons name="hourglass-outline" size={15} color={palette.lime} />
                      <Text style={styles.autoConfirmText}>
                        SLOT HELD · ADMIN CHECKS YOUR REFERENCE
                      </Text>
                    </View>
                    <Text style={styles.bankInfoNotice}>
                      Transfer ₱{COURT_FEE} to the court bank account, then enter the reference below.
                      Your slot is held straight away and turns Confirmed once the admin matches your
                      reference against the bank records.
                    </Text>

                    <View style={styles.bankDetailDivider} />

                    <View style={styles.bankDetailRow}>
                      <Text style={styles.bankDetailLabel}>Bank:</Text>
                      <Text style={styles.bankDetailVal}>BDO Unibank</Text>
                    </View>
                    <View style={styles.bankDetailRow}>
                      <Text style={styles.bankDetailLabel}>Account Name:</Text>
                      <Text style={styles.bankDetailVal}>Spin & Smash Pickleball</Text>
                    </View>
                    <View style={styles.bankDetailRow}>
                      <Text style={styles.bankDetailLabel}>Account No.:</Text>
                      <Text style={[styles.bankDetailVal, { color: palette.lime }]}>
                        0042-8910-3342
                      </Text>
                    </View>
                    <View style={styles.bankDetailRow}>
                      <Text style={styles.bankDetailLabel}>Amount:</Text>
                      <Text style={[styles.bankDetailVal, { color: palette.lime }]}>
                        ₱{COURT_FEE}.00
                      </Text>
                    </View>

                    <View style={{ marginTop: 6 }}>
                      <GlassInput
                        label="Bank Reference Number (Numbers only) *"
                        placeholder="e.g. 102938475612"
                        value={refNumber}
                        onChangeText={(v) => {
                          const numericOnly = v.replace(/[^0-9]/g, '').slice(0, 16);
                          setRefNumber(numericOnly);
                          if (sheetError) setSheetError(null);
                        }}
                        keyboardType="number-pad"
                        maxLength={16}
                        counter={{ length: refNumber.length, max: 16 }}
                        hint="Numbers only · Maximum 16 digits"
                      />
                    </View>
                  </View>
                )}

                {paymentMethod === 'gcash' && (
                  <View style={styles.bankInfoCard}>
                    <View style={styles.autoConfirmBadge}>
                      <Ionicons name="hourglass-outline" size={15} color={palette.lime} />
                      <Text style={styles.autoConfirmText}>
                        SLOT HELD · ADMIN CHECKS YOUR REFERENCE
                      </Text>
                    </View>
                    <Text style={styles.bankInfoNotice}>
                      Send ₱{COURT_FEE} via GCash, then paste the reference below. Your slot is held
                      right away and turns Confirmed once the admin has matched your reference to the
                      payment.
                    </Text>

                    <View style={styles.bankDetailDivider} />

                    <View style={styles.bankDetailRow}>
                      <Text style={styles.bankDetailLabel}>GCash Name:</Text>
                      <Text style={styles.bankDetailVal}>Spin & Smash Pavilion</Text>
                    </View>
                    <View style={styles.bankDetailRow}>
                      <Text style={styles.bankDetailLabel}>GCash Mobile:</Text>
                      <Text style={[styles.bankDetailVal, { color: palette.lime }]}>
                        0917-882-9912
                      </Text>
                    </View>
                    <View style={styles.bankDetailRow}>
                      <Text style={styles.bankDetailLabel}>Amount:</Text>
                      <Text style={[styles.bankDetailVal, { color: palette.lime }]}>
                        ₱{COURT_FEE}.00
                      </Text>
                    </View>

                    <View style={{ marginTop: 6 }}>
                      <GlassInput
                        label="GCash Reference Number (Numbers only) *"
                        placeholder="e.g. 100293841928"
                        value={refNumber}
                        onChangeText={(v) => {
                          const numericOnly = v.replace(/[^0-9]/g, '').slice(0, 16);
                          setRefNumber(numericOnly);
                          if (sheetError) setSheetError(null);
                        }}
                        keyboardType="number-pad"
                        maxLength={16}
                        counter={{ length: refNumber.length, max: 16 }}
                        hint="Numbers only · Maximum 16 digits"
                      />
                    </View>
                  </View>
                )}

                <GlassInput
                  label="Player Note (optional)"
                  placeholder="e.g. Training with friends"
                  value={note}
                  onChangeText={setNote}
                  maxLength={100}
                />

                <ErrorBanner message={sheetError} />

                <View style={styles.sheetActions}>
                  <GlassButton
                    title="Cancel"
                    variant="secondary"
                    onPress={() => setSheetVisible(false)}
                    style={{ flex: 1 }}
                    disabled={submitting}
                  />
                  <GlassButton
                    title={`Pay ₱${COURT_FEE} & Submit`}
                    onPress={confirmAndPay}
                    loading={submitting}
                    style={{ flex: 1.6 }}
                  />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgTop },
  container: { padding: 20, gap: 16, paddingBottom: 130 },
  dateStrip: { gap: 10, paddingVertical: 2 },
  dateChip: {
    width: 58,
    paddingVertical: 10,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  dateChipActive: { backgroundColor: palette.lime, borderColor: palette.lime },
  dateChipDay: { fontSize: 11, fontWeight: '700', color: palette.muted, textTransform: 'uppercase' },
  dateChipNum: { fontSize: 18, fontWeight: '700', color: palette.white, marginTop: 2 },
  courtTabs: { flexDirection: 'row', gap: 10 },
  courtTab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  courtTabActive: { backgroundColor: palette.lime, borderColor: palette.lime },
  courtTabText: { fontSize: 13.5, fontWeight: '700', color: palette.white },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  slot: {
    width: '47.5%',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'flex-start',
    gap: 2,
  },
  slotOpen: { backgroundColor: 'rgba(212,243,74,0.14)', borderColor: 'rgba(212,243,74,0.55)' },
  slotClosed: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.16)' },
  slotMine: { backgroundColor: 'rgba(94,234,212,0.16)', borderColor: 'rgba(94,234,212,0.6)' },
  slotTime: { fontSize: 14, fontWeight: '700', color: palette.white },
  slotState: { fontSize: 11.5, fontWeight: '600' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  ruleCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 16 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(4,26,18,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.border,
    maxHeight: '90%',
    backgroundColor: 'rgba(11,61,42,0.97)',
  },
  sheetInner: { padding: 20, paddingBottom: 36, gap: 14 },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
  },
  sheetTitle: { ...type.h2, color: palette.white },
  sheetSub: { ...type.caption, color: palette.muted, marginTop: 2 },
  summaryCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: glass.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryCourtName: { fontSize: 15, fontWeight: '700', color: palette.white },
  summaryVenue: { ...type.caption, color: palette.muted, marginTop: 2 },
  summaryPrice: { fontSize: 22, fontWeight: '800', color: palette.lime },
  summaryRateLabel: { fontSize: 11, fontWeight: '600', color: palette.muted },
  sectionLabel: { ...type.caption, color: palette.white, fontWeight: '700', marginTop: 4 },
  payMethodRow: { flexDirection: 'row', gap: 8 },
  payMethodChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: glass.border,
  },
  payMethodChipActive: {
    backgroundColor: palette.lime,
    borderColor: palette.lime,
  },
  payMethodText: { fontSize: 12, fontWeight: '700', color: palette.white },
  payMethodTextActive: { color: palette.ink },
  bankInfoCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(212,243,74,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(212,243,74,0.3)',
    gap: 8,
  },
  autoConfirmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  autoConfirmText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: palette.lime,
    letterSpacing: 0.5,
  },
  bankInfoNotice: {
    fontSize: 12.5,
    color: palette.white,
    lineHeight: 17,
  },
  bankDetailDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 4,
  },
  bankDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  bankDetailLabel: { ...type.caption, color: palette.faint },
  bankDetailVal: { fontSize: 13.5, fontWeight: '700', color: palette.white },
  cashInfoCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: glass.border,
    gap: 4,
  },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
});
