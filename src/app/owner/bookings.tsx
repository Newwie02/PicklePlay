import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GlassBackground } from '../../components/glass/GlassBackground';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassInput } from '../../components/glass/GlassInput';
import { GlassSelect } from '../../components/glass/GlassSelect';
import { Avatar } from '../../components/glass/Avatar';
import { ErrorBanner, SuccessBanner } from '../../components/glass/Banner';
import { GlassDatePicker } from '../../components/GlassDatePicker';
import {
  DbError,
  adminCreateBooking,
  adminFetchBookings,
  adminFetchUsers,
  adminSetBookingStatus,
  adminReviewPayment,
  fetchCourtSlots,
  fetchCourts,
} from '../../lib/db';
import type { FieldErrors } from '../../lib/api';
import { formatDate, formatShortDate, formatTime, relativeDay, todayISO } from '../../lib/format';
import { VENUE_NAME } from '../../lib/options';
import type { Booking, BookingStatus, Court, SlotState, User } from '../../lib/types';
import { glass, palette, type } from '../../theme/glass';

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'To verify', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

/**
 * One place for each status's rail colour, pill tint and text colour so the
 * card, the pill and the filter badge can never drift apart.
 * 'pending' is a booking that paid but hasn't been checked yet.
 */
const STATUS: Record<BookingStatus, { color: string; tint: string }> = {
  pending: { color: palette.warn, tint: 'rgba(255,213,138,0.14)' },
  confirmed: { color: palette.lime, tint: 'rgba(212,243,74,0.14)' },
  completed: { color: palette.mint, tint: 'rgba(94,234,212,0.14)' },
  cancelled: { color: palette.danger, tint: 'rgba(255,138,138,0.14)' },
};

/** Slot groups so the picker reads as a day, not a wall of times. */
const SLOT_GROUPS: { label: string; from: number; to: number }[] = [
  { label: 'Morning', from: 6, to: 11 },
  { label: 'Afternoon', from: 12, to: 16 },
  { label: 'Evening', from: 17, to: 21 },
];

function hourOf(time: string) {
  return Number(time.split(':')[0]);
}

/** "2026-10-12" -> "2026-10-13" without touching the machine's timezone. */
function nextDay(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Owner POV — every booking on every court, plus the "book on behalf of a
 * client" sheet (clients also see their own bookings from Home).
 */
export default function OwnerBookingsScreen() {
  const { new: openNew } = useLocalSearchParams<{ new?: string }>();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /* The booking whose reference is being turned down, and why. */
  const [rejecting, setRejecting] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  /* ---------- New booking sheet ---------- */
  const [sheet, setSheet] = useState(openNew === '1');
  const [clientId, setClientId] = useState('');
  const [courtId, setCourtId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      // Always pull the full list: the counts on the filter pills are only
      // trustworthy against every booking, and filtering locally makes
      // switching pills instant instead of a round trip per tap.
      const [b, c, ct] = await Promise.all([
        adminFetchBookings('all'),
        adminFetchUsers(),
        fetchCourts(),
      ]);
      setBookings(b);
      setClients(c.users);
      setCourts(ct);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load bookings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /* Re-open the sheet when the dashboard's "New booking" action lands here
     with ?new=1 (tabs stay mounted, so the initial state alone isn't enough). */
  const handledNew = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      load();
      if (openNew && openNew !== handledNew.current) {
        handledNew.current = openNew;
        if (openNew === '1') setSheet(true);
      }
    }, [load, openNew])
  );

  /* First client/court act as defaults until the owner picks one. */
  const activeClientId = clientId || clients[0]?.id || '';
  const activeCourtId = courtId || courts[0]?.id || '';

  /* Free slots for the chosen court + day (taken times are hidden). */
  const slotsKey = `${activeCourtId}|${date}`;
  const [slotData, setSlotData] = useState<{ key: string; slots: SlotState[] } | null>(null);
  const slots = sheet && slotData?.key === slotsKey ? slotData.slots : [];
  const slotsLoading = sheet && !!activeCourtId && !!date && slotData?.key !== slotsKey;
  const freeCount = slots.filter((s) => s.status === 'available').length;

  useEffect(() => {
    if (!sheet || !activeCourtId || !date) return;
    let alive = true;
    fetchCourtSlots(activeCourtId, date)
      .then((list) => {
        if (!alive) return;
        setSlotData({ key: `${activeCourtId}|${date}`, slots: list });
        setTime((prev) => (list.some((s) => s.time === prev && s.status === 'available') ? prev : ''));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [sheet, activeCourtId, date]);

  /** Totals behind each filter pill, from the unfiltered list. */
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: bookings.length,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const b of bookings) c[b.status] += 1;
    return c;
  }, [bookings]);

  const visible = useMemo(
    () => (status === 'all' ? bookings : bookings.filter((b) => b.status === status)),
    [bookings, status]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of visible) {
      const list = map.get(b.date) ?? [];
      list.push(b);
      map.set(b.date, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [visible]);

  const setStatusOf = async (booking: Booking, next: BookingStatus) => {
    setBusyId(booking.id);
    setError(null);
    setSuccess(null);
    try {
      await adminSetBookingStatus(booking.id, next);
      setSuccess(
        next === 'cancelled'
          ? 'Booking cancelled — that slot is open again.'
          : 'Booking marked as completed.'
      );
      await load();
    } catch (e) {
      setError(e instanceof DbError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * The whole point of the flow: match the reference the client typed
   * against the GCash/bank records. Approving confirms the booking;
   * rejecting cancels it, which gives the slot back to everyone else.
   */
  const reviewPayment = async (
    booking: Booking,
    decision: 'approved' | 'rejected',
    reason = ''
  ) => {
    setBusyId(booking.id);
    setError(null);
    setSuccess(null);
    try {
      await adminReviewPayment(booking.id, decision, reason);
      setSuccess(
        decision === 'approved'
          ? 'Reference verified — the booking is confirmed.'
          : 'Reference rejected — that slot is open again, and the client can see why.'
      );
      await load();
    } catch (e) {
      setError(e instanceof DbError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusyId(null);
      setRejecting(null);
      setRejectReason('');
    }
  };

  const createBooking = async () => {
    setFieldErrors({});
    setSaveError(null);
    setSaving(true);
    try {
      await adminCreateBooking({
        userId: activeClientId,
        courtId: activeCourtId,
        date,
        time,
        note: note.trim(),
      });
      setSheet(false);
      setNote('');
      setTime('');
      setSuccess('Booking created. The client can see it on their Home screen right away.');
      await load();
    } catch (e) {
      const message = e instanceof DbError ? e.message : 'Something went wrong. Please try again.';
      // The RPC returns one sentence; pin it to the control it's about so
      // the inline hint under that picker still lights up.
      const lc = message.toLowerCase();
      const field =
        lc.includes('court') && !lc.includes('court owner')
          ? 'courtId'
          : lc.includes('player') || lc.includes('choose')
          ? 'userId'
          : lc.includes('date')
          ? 'date'
          : lc.includes('time') || lc.includes('slot')
          ? 'time'
          : undefined;
      if (field) setFieldErrors({ [field]: message });
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const clientOptions = clients.map((c) => `${c.firstName} ${c.lastName} · ${c.email}`);
  const selectedClientLabel =
    clientOptions[clients.findIndex((c) => c.id === activeClientId)] ?? '';
  const selectedClient = clients.find((c) => c.id === activeClientId);
  const selectedCourt = courts.find((c) => c.id === activeCourtId);

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={palette.lime}
            />
          }
        >
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <Text style={type.h1}>Bookings</Text>
              <Text style={[type.caption, { marginTop: 4 }]}>
                {counts.pending > 0 ? `${counts.pending} to verify · ` : ''}
                {counts.all} on record · {courts.length} courts
              </Text>
            </View>
            <Pressable style={styles.addButton} onPress={() => setSheet(true)}>
              <Ionicons name="add" size={20} color={palette.ink} />
              <Text style={styles.addText}>New</Text>
            </Pressable>
          </View>

          {/* ---------- Status filter — each pill carries its live count ---------- */}
          <View style={styles.filters}>
            {STATUS_FILTERS.map((f) => {
              const active = f.value === status;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => setStatus(f.value)}
                  style={[styles.filter, active && styles.filterActive]}
                >
                  <Text style={[styles.filterText, active && { color: palette.ink }]}>
                    {f.label}
                  </Text>
                  <View style={[styles.filterCount, active && styles.filterCountActive]}>
                    <Text style={[styles.filterCountText, active && { color: palette.ink }]}>
                      {counts[f.value] ?? 0}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <ErrorBanner message={error} />
          <SuccessBanner message={success} />

          {/* ---------- List ---------- */}
          {loading && bookings.length === 0 ? (
            <View style={styles.loading}>
              <ActivityIndicator color={palette.lime} size="large" />
              <Text style={type.caption}>Loading bookings…</Text>
            </View>
          ) : bookings.length === 0 ? (
            <GlassCard style={{ alignItems: 'center', gap: 8, paddingVertical: 30 }}>
              <Ionicons name="calendar-outline" size={34} color={palette.faint} />
              <Text style={type.h3}>No bookings yet</Text>
              <Text style={[type.caption, { textAlign: 'center' }]}>
                Tap “New” to put a client on a free court slot.
              </Text>
            </GlassCard>
          ) : visible.length === 0 ? (
            <GlassCard style={{ alignItems: 'center', gap: 8, paddingVertical: 30 }}>
              <Ionicons name="funnel-outline" size={30} color={palette.faint} />
              <Text style={type.h3}>No {status} bookings</Text>
              <Pressable onPress={() => setStatus('all')} hitSlop={8}>
                <Text style={type.link}>Show every booking</Text>
              </Pressable>
            </GlassCard>
          ) : (
            grouped.map(([day, items]) => {
              const rel = relativeDay(day);
              const label = rel ? `${rel} · ${formatDate(day)}` : formatDate(day);
              return (
                <View key={day} style={styles.dayBlock}>
                  <View style={styles.dayRow}>
                    <Text style={styles.dayTitle} numberOfLines={1}>
                      {label.toUpperCase()}
                    </Text>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>{items.length}</Text>
                    </View>
                  </View>
                  <View style={styles.dayRule} />

                  {items.map((b) => {
                    const { color, tint } = STATUS[b.status];
                    const busy = busyId === b.id;
                    return (
                      <GlassCard key={b.id} accent={color} style={styles.bookingCard}>
                        <View style={[styles.timeTile, { backgroundColor: tint }]}>
                          <Text style={styles.timeText}>{formatTime(b.time).split(' ')[0]}</Text>
                          <Text style={[styles.timeSuffix, { color }]}>
                            {formatTime(b.time).split(' ')[1]}
                          </Text>
                        </View>

                        <View style={styles.bookingBody}>
                          <View style={styles.nameRow}>
                            <Avatar
                              avatar={b.user?.avatar}
                              firstName={b.user?.firstName ?? '?'}
                              lastName={b.user?.lastName ?? ''}
                              size={24}
                            />
                            <Text style={[type.h3, styles.nameText]} numberOfLines={1}>
                              {b.user
                                ? `${b.user.firstName} ${b.user.lastName}`
                                : 'Deleted account'}
                            </Text>
                          </View>

                          <View style={styles.metaRow}>
                            <View style={styles.courtChip}>
                              <Ionicons name="grid-outline" size={11} color={palette.mint} />
                              <Text style={styles.courtChipText}>Court {b.court?.number}</Text>
                            </View>
                            <View style={{ flex: 1 }} />
                            <View style={[styles.pill, { borderColor: color, backgroundColor: tint }]}>
                              <View style={[styles.pillDot, { backgroundColor: color }]} />
                              <Text style={[styles.pillText, { color }]}>{b.status}</Text>
                            </View>
                          </View>

                          {/* What the client handed over — the numbers the
                              admin compares against their GCash/bank records. */}
                          {b.payment.status !== 'none' ? (
                            <View style={styles.payRow}>
                              <View style={styles.payChip}>
                                <Ionicons
                                  name={
                                    b.payment.method === 'gcash'
                                      ? 'phone-portrait-outline'
                                      : 'business-outline'
                                  }
                                  size={11}
                                  color={palette.mint}
                                />
                                <Text style={styles.payChipText}>
                                  {b.payment.method === 'gcash' ? 'GCash' : 'Bank'} ·{' '}
                                  {b.payment.reference}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }} />
                              <Text style={styles.payAmount}>₱{b.payment.amount}</Text>
                            </View>
                          ) : null}

                          {b.note ? (
                            <Text style={styles.note} numberOfLines={2}>
                              “{b.note}”
                            </Text>
                          ) : null}

                          {/* A booking that paid is 'pending' until the owner
                              has matched the reference — approve to confirm,
                              reject to give the slot back. */}
                          {b.status === 'pending' ? (
                            <View style={styles.actionRow}>
                              <Pressable
                                disabled={busy}
                                onPress={() => reviewPayment(b, 'approved')}
                                style={[
                                  styles.actionBtn,
                                  styles.actionPrimary,
                                  busy && styles.actionBusy,
                                ]}
                              >
                                <Ionicons name="shield-checkmark" size={13} color={palette.ink} />
                                <Text style={styles.actionPrimaryText}>Reference OK</Text>
                              </Pressable>
                              <Pressable
                                disabled={busy}
                                onPress={() => {
                                  setRejecting(b);
                                  setRejectReason('');
                                }}
                                style={[
                                  styles.actionBtn,
                                  styles.actionGhost,
                                  busy && styles.actionBusy,
                                ]}
                              >
                                <Ionicons name="close" size={13} color={palette.danger} />
                                <Text style={styles.actionGhostText}>Reject</Text>
                              </Pressable>
                            </View>
                          ) : b.status === 'confirmed' ? (
                            <View style={styles.actionRow}>
                              <Pressable
                                disabled={busy}
                                onPress={() => setStatusOf(b, 'completed')}
                                style={[styles.actionBtn, styles.actionPrimary, busy && styles.actionBusy]}
                              >
                                <Ionicons name="checkmark" size={13} color={palette.ink} />
                                <Text style={styles.actionPrimaryText}>Done</Text>
                              </Pressable>
                              <Pressable
                                disabled={busy}
                                onPress={() => setStatusOf(b, 'cancelled')}
                                style={[styles.actionBtn, styles.actionGhost, busy && styles.actionBusy]}
                              >
                                <Ionicons name="close" size={13} color={palette.danger} />
                                <Text style={styles.actionGhostText}>Cancel</Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      </GlassCard>
                    );
                  })}
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ---------- Book on behalf of a client ---------- */}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <Pressable style={styles.backdrop} onPress={() => setSheet(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.sheetTint} />
              <ScrollView contentContainerStyle={styles.sheetInner} keyboardShouldPersistTaps="handled">
                <View style={styles.grabber} />
                <View style={styles.sheetHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h2}>New booking</Text>
                    <Text style={[type.caption, { marginTop: 4 }]}>
                      Book a free slot on a client’s behalf.
                    </Text>
                  </View>
                  <Pressable onPress={() => setSheet(false)} hitSlop={10} style={styles.sheetClose}>
                    <Ionicons name="close" size={18} color={palette.white} />
                  </Pressable>
                </View>

                <ErrorBanner message={saveError} />

                <View style={{ gap: 14 }}>
                  <GlassSelect
                    label="Client"
                    placeholder="Pick a player"
                    value={selectedClientLabel}
                    options={clientOptions}
                    onSelect={(label) => {
                      const idx = clientOptions.indexOf(label);
                      if (idx >= 0) setClientId(clients[idx].id);
                      setFieldErrors((p) => ({ ...p, userId: '' }));
                    }}
                    error={fieldErrors.userId}
                    searchable
                  />
                  <GlassSelect
                    label="Court"
                    placeholder="Pick a court"
                    value={courts.find((c) => c.id === activeCourtId)?.name ?? ''}
                    options={courts.map((c) => c.name)}
                    onSelect={(name) => {
                      const court = courts.find((c) => c.name === name);
                      if (court) {
                        setCourtId(court.id);
                        setTime('');
                      }
                      setFieldErrors((p) => ({ ...p, courtId: '' }));
                    }}
                    error={fieldErrors.courtId}
                  />
                  <GlassDatePicker
                    label="Date"
                    value={date}
                    onChange={(v) => {
                      setDate(v);
                      setTime('');
                      setFieldErrors((p) => ({ ...p, date: '' }));
                    }}
                    error={fieldErrors.date}
                  />

                  <View style={{ gap: 8 }}>
                    <View style={styles.slotHead}>
                      <Text style={styles.fieldLabel}>Time slot</Text>
                      {slots.length > 0 ? (
                        <Text style={styles.slotFree}>
                          {freeCount} of {slots.length} free
                        </Text>
                      ) : null}
                    </View>

                    {slotsLoading ? (
                      <ActivityIndicator color={palette.lime} style={{ marginVertical: 10 }} />
                    ) : (
                      SLOT_GROUPS.map((g) => {
                        const group = slots.filter(
                          (s) => hourOf(s.time) >= g.from && hourOf(s.time) <= g.to
                        );
                        if (!group.length) return null;
                        const openInGroup = group.filter((s) => s.status === 'available').length;
                        return (
                          <View key={g.label} style={{ gap: 6 }}>
                            <View style={styles.groupRow}>
                              <Text style={styles.groupLabel}>{g.label}</Text>
                              <Text style={styles.groupCount}>
                                {openInGroup}/{group.length} free
                              </Text>
                            </View>
                            <View style={styles.slotGrid}>
                              {group.map((s) => {
                                const open = s.status === 'available';
                                const isPast = s.status === 'past';
                                const active = s.time === time;
                                // "Taken" and "Past" look identical if collapsed into one
                                // word — a grid of past slots reads as a fully booked day,
                                // which is what made the owner think booking was broken.
                                const label = open
                                  ? active
                                    ? 'Selected'
                                    : 'Open'
                                  : isPast
                                  ? 'Past'
                                  : 'Taken';
                                const stateColor = open
                                  ? active
                                    ? palette.ink
                                    : palette.lime
                                  : isPast
                                  ? palette.faint
                                  : palette.warn;
                                return (
                                  <Pressable
                                    key={s.time}
                                    disabled={!open}
                                    onPress={() => {
                                      setTime(s.time);
                                      setFieldErrors((p) => ({ ...p, time: '' }));
                                    }}
                                    style={[
                                      styles.slot,
                                      open ? styles.slotOpen : isPast ? styles.slotPast : styles.slotClosed,
                                      active && styles.slotActive,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.slotTime,
                                        !open && { color: isPast ? palette.faint : palette.muted },
                                      ]}
                                    >
                                      {formatTime(s.time)}
                                    </Text>
                                    <Text style={[styles.slotState, { color: stateColor }]}>
                                      {label}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        );
                      })
                    )}
                    {slots.length > 0 && freeCount === 0 ? (
                      <View style={styles.noFree}>
                        <Ionicons name="calendar-clear-outline" size={15} color={palette.warn} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.noFreeText}>
                            Nothing open on {formatShortDate(date)} — every slot is taken or has
                            already started.
                          </Text>
                          <Pressable
                            hitSlop={8}
                            onPress={() => {
                              setDate(nextDay(date));
                              setTime('');
                              setFieldErrors((p) => ({ ...p, date: '', time: '' }));
                            }}
                          >
                            <Text style={type.link}>Move to the next day →</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                    {fieldErrors.time ? <Text style={type.error}>{fieldErrors.time}</Text> : null}
                    {date < todayISO() ? (
                      <Text style={[type.caption, { fontSize: 12 }]}>
                        That day already passed — pick an upcoming date.
                      </Text>
                    ) : null}
                  </View>

                  <GlassInput
                    label="Note (optional)"
                    placeholder="e.g. Weekly league match"
                    value={note}
                    onChangeText={setNote}
                    multiline
                    maxLength={200}
                    counter={{ length: note.length, max: 200 }}
                  />
                </View>

                {/* What is about to be booked — one glance before committing. */}
                <GlassCard style={styles.summary} accent={time ? palette.lime : palette.warn}>
                  <View style={styles.summaryIcon}>
                    <Ionicons
                      name={time ? 'checkmark-circle' : 'time-outline'}
                      size={20}
                      color={time ? palette.lime : palette.warn}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h3} numberOfLines={1}>
                      {selectedClient
                        ? `${selectedClient.firstName} ${selectedClient.lastName}`
                        : 'Pick a player'}
                    </Text>
                    <Text style={[type.caption, { marginTop: 3 }]} numberOfLines={2}>
                      {selectedCourt ? `Court ${selectedCourt.number}` : 'Pick a court'} ·{' '}
                      {formatDate(date)} · {time ? formatTime(time) : 'time not set'}
                    </Text>
                    {!time ? (
                      <Text style={styles.needTime}>
                        Tap an open time above to enable Create booking.
                      </Text>
                    ) : null}
                  </View>
                </GlassCard>

                <View style={styles.sheetActions}>
                  <GlassButton title="Cancel" variant="secondary" onPress={() => setSheet(false)} style={{ flex: 1 }} />
                  <GlassButton
                    title="Create booking"
                    onPress={createBooking}
                    loading={saving}
                    disabled={!activeClientId || !activeCourtId || !time}
                    style={{ flex: 1.4 }}
                  />
                </View>
                <Text style={[type.caption, styles.venue]}>{VENUE_NAME}</Text>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------- Reject a reference: why wasn't it legit? ---------- */}
      <Modal
        visible={!!rejecting}
        transparent
        animationType="slide"
        onRequestClose={() => setRejecting(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <Pressable style={styles.backdrop} onPress={() => setRejecting(null)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.sheetTint} />
              <ScrollView
                contentContainerStyle={styles.sheetInner}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.grabber} />
                <View style={styles.sheetHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h2}>Reject reference</Text>
                    <Text style={[type.caption, { marginTop: 4 }]}>
                      The slot goes back to everyone else, and the client sees your reason.
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setRejecting(null)}
                    hitSlop={10}
                    style={styles.sheetClose}
                  >
                    <Ionicons name="close" size={18} color={palette.white} />
                  </Pressable>
                </View>

                {rejecting ? (
                  <View style={{ gap: 14 }}>
                    <GlassCard accent={palette.warn}>
                      <View style={styles.payRow}>
                        <View style={styles.payChip}>
                          <Ionicons
                            name={
                              rejecting.payment.method === 'gcash'
                                ? 'phone-portrait-outline'
                                : 'business-outline'
                            }
                            size={11}
                            color={palette.mint}
                          />
                          <Text style={styles.payChipText}>
                            {rejecting.payment.method === 'gcash' ? 'GCash' : 'Bank'} ·{' '}
                            {rejecting.payment.reference}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }} />
                        <Text style={styles.payAmount}>₱{rejecting.payment.amount}</Text>
                      </View>
                      <Text style={[type.caption, { marginTop: 8 }]}>
                        {rejecting.user
                          ? `${rejecting.user.firstName} ${rejecting.user.lastName}`
                          : 'Deleted account'}
                        {' · '}Court {rejecting.court?.number} · {formatDate(rejecting.date)} ·{' '}
                        {formatTime(rejecting.time)}
                      </Text>
                    </GlassCard>

                    <GlassInput
                      label="Why is it not legit? (optional)"
                      placeholder="e.g. Reference not found in GCash"
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      maxLength={120}
                    />
                  </View>
                ) : null}

                <View style={styles.sheetActions}>
                  <GlassButton
                    title="Back"
                    variant="secondary"
                    onPress={() => setRejecting(null)}
                    style={{ flex: 1 }}
                  />
                  <GlassButton
                    title="Reject payment"
                    variant="danger"
                    onPress={() =>
                      rejecting && reviewPayment(rejecting, 'rejected', rejectReason.trim())
                    }
                    loading={!!rejecting && busyId === rejecting.id}
                    style={{ flex: 1.4 }}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgTop },
  container: { padding: 20, gap: 14, paddingBottom: 130 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.lime,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  addText: { color: palette.ink, fontWeight: '700', fontSize: 13.5 },
  filters: { flexDirection: 'row', gap: 8 },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: glass.border,
  },
  filterActive: { backgroundColor: palette.lime, borderColor: palette.lime },
  filterText: { fontSize: 12.5, fontWeight: '700', color: palette.white },
  filterCount: {
    minWidth: 21,
    paddingHorizontal: 5,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 3,
  },
  filterCountActive: { backgroundColor: 'rgba(15,26,20,0.25)' },
  filterCountText: { fontSize: 11, fontWeight: '800', color: palette.white },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  dayBlock: { gap: 10, marginTop: 6 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayTitle: { ...type.eyebrow, flex: 1 },
  dayBadge: {
    minWidth: 24,
    paddingHorizontal: 7,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(212,243,74,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(212,243,74,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: { fontSize: 11, fontWeight: '800', color: palette.lime },
  dayRule: { height: 1, backgroundColor: 'rgba(255,255,255,0.16)', marginTop: 3 },
  bookingCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  timeTile: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 58,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.white,
    fontVariant: ['tabular-nums'],
  },
  timeSuffix: { fontSize: 10, fontWeight: '800' },
  bookingBody: { flex: 1, gap: 7 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameText: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  courtChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(94,234,212,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.35)',
  },
  courtChipText: { fontSize: 11, fontWeight: '700', color: palette.mint },
  note: { fontSize: 12, fontStyle: 'italic', color: palette.faint, lineHeight: 17 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  payChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(94,234,212,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.4)',
  },
  payChipText: { fontSize: 11.5, fontWeight: '700', color: palette.mint, letterSpacing: 0.2 },
  payAmount: { fontSize: 13, fontWeight: '800', color: palette.lime },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  pillText: { fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 2 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionBusy: { opacity: 0.5 },
  actionPrimary: { backgroundColor: palette.lime, borderColor: palette.lime },
  actionPrimaryText: { fontSize: 12, fontWeight: '800', color: palette.ink },
  actionGhost: { backgroundColor: 'rgba(255,138,138,0.12)', borderColor: 'rgba(255,138,138,0.5)' },
  actionGhostText: { fontSize: 12, fontWeight: '800', color: palette.danger },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(4,26,18,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.border,
    maxHeight: '92%',
  },
  sheetTint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(11,61,42,0.94)',
  },
  sheetInner: { padding: 20, paddingBottom: 30 },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginBottom: 14,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: glass.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: 16 },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { ...type.caption, color: palette.white },
  slotHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotFree: { fontSize: 12, fontWeight: '700', color: palette.lime },
  groupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: palette.muted,
  },
  groupCount: { fontSize: 11, fontWeight: '600', color: palette.faint },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    width: '31%',
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 1,
  },
  slotOpen: { backgroundColor: 'rgba(212,243,74,0.14)', borderColor: 'rgba(212,243,74,0.55)' },
  slotClosed: { backgroundColor: 'rgba(255,213,138,0.10)', borderColor: 'rgba(255,213,138,0.42)' },
  slotPast: { backgroundColor: 'rgba(255,255,255,0.035)', borderColor: 'rgba(255,255,255,0.10)' },
  slotActive: { backgroundColor: palette.lime, borderColor: palette.lime },
  noFree: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,213,138,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,213,138,0.4)',
  },
  noFreeText: { fontSize: 12.5, color: palette.muted, lineHeight: 17, marginBottom: 4 },
  needTime: { fontSize: 12, fontWeight: '600', color: palette.warn, marginTop: 5 },
  slotTime: { fontSize: 12.5, fontWeight: '700', color: palette.white },
  slotState: { fontSize: 10, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  venue: { textAlign: 'center', fontSize: 11.5, marginTop: 12 },
});
