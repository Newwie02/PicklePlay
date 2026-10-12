import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassBackground } from '../../components/glass/GlassBackground';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassButton } from '../../components/glass/GlassButton';
import { ErrorBanner, SuccessBanner } from '../../components/glass/Banner';
import { DbError, cancelBooking, fetchMyBookings } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { formatDate, formatTime, VENUE } from '../../lib/format';
import type { Booking } from '../../lib/types';
import { palette, type } from '../../theme/glass';

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetchMyBookings(user.id);
      const found = res.bookings.find((b) => b.id === id) ?? null;
      setBooking(found);
      setError(found ? null : 'We could not find that booking. It may have been cancelled.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that booking.');
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const cancel = () => {
    Alert.alert('Cancel this booking?', 'The court opens up for someone else right away.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          setBusy(true);
          try {
            await cancelBooking(String(id));
            setSuccess('Booking cancelled. The slot is open again.');
            await load();
          } catch (e) {
            setError(e instanceof DbError ? e.message : 'Something went wrong. Please try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.head}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
              <Ionicons name="chevron-back" size={20} color={palette.white} />
            </Pressable>
            <Text style={type.h1}>Your booking</Text>
          </View>

          <ErrorBanner message={error} />
          <SuccessBanner message={success} />

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={palette.lime} size="large" />
            </View>
          ) : booking ? (
            <>
              <GlassCard strong>
                <View style={styles.statusRow}>
                  <View style={[styles.statusChip, booking.status !== 'confirmed' && styles.statusOther]}>
                    <Text style={[styles.statusText, booking.status !== 'confirmed' && { color: palette.white }]}>
                      {booking.status === 'pending' ? 'awaiting verification' : booking.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.court}>Court {booking.court?.number}</Text>
                <Text style={[type.body, { marginTop: 6 }]}>{formatDate(booking.date)}</Text>
                <Text style={[type.h2, { marginTop: 2, color: palette.lime }]}>
                  {formatTime(booking.time)} · {booking.durationMin} min
                </Text>

                <View style={styles.venueRow}>
                  <Ionicons name="location" size={15} color={palette.mint} />
                  <Text style={[type.caption, { flex: 1 }]}>{booking.court?.venue ?? VENUE}</Text>
                </View>

                {booking.note ? (
                  <View style={styles.noteBox}>
                    <Text style={type.caption}>Note</Text>
                    <Text style={[type.body, { marginTop: 2 }]}>{booking.note}</Text>
                  </View>
                ) : null}

                {/* What was handed over, and where it stands with the admin. */}
                {booking.payment.status !== 'none' ? (
                  <View style={styles.payBox}>
                    <View style={styles.payHead}>
                      <Ionicons name="wallet-outline" size={14} color={palette.mint} />
                      <Text style={styles.payTitle}>
                        {booking.payment.method === 'gcash' ? 'GCash' : 'Bank Transfer'} · ₱
                        {booking.payment.amount}
                      </Text>
                    </View>
                    <Text style={[type.caption, { marginTop: 5 }]}>
                      Reference {booking.payment.reference}
                    </Text>
                    <Text
                      style={[
                        type.caption,
                        {
                          marginTop: 6,
                          color:
                            booking.status === 'cancelled'
                              ? palette.danger
                              : booking.payment.status === 'verified'
                              ? palette.lime
                              : palette.warn,
                        },
                      ]}
                    >
                      {booking.status === 'cancelled'
                        ? 'This booking was cancelled.'
                        : booking.payment.status === 'verified'
                        ? 'Reference verified — your booking is confirmed.'
                        : booking.payment.status === 'rejected'
                        ? 'Reference rejected — please book again with a valid one.'
                        : 'The admin is checking your reference. Your slot is held.'}
                    </Text>
                  </View>
                ) : null}
              </GlassCard>

              <GlassCard>
                <Text style={type.h3}>Details</Text>
                <Row label="Booking ID" value={booking.id} />
                <Row
                  label="Booked by"
                  value={
                    booking.user
                      ? `${booking.user.firstName} ${booking.user.lastName}`.trim()
                      : 'You'
                  }
                />
                <Row label="Status" value={booking.status} />
                <Row label="Created" value={new Date(booking.createdAt).toLocaleString()} />
              </GlassCard>

              {booking.status === 'confirmed' || booking.status === 'pending' ? (
                <GlassButton title="Cancel booking" variant="danger" onPress={cancel} loading={busy} />
              ) : null}
            </>
          ) : null}

          <GlassButton title="Back to home" variant="secondary" onPress={() => router.replace('/home')} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={type.caption}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgTop },
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { alignItems: 'center', paddingVertical: 60 },
  statusRow: { flexDirection: 'row', marginBottom: 12 },
  statusChip: {
    backgroundColor: 'rgba(212,243,74,0.2)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusOther: { backgroundColor: 'rgba(255,255,255,0.2)' },
  statusText: { fontSize: 11.5, fontWeight: '800', color: palette.lime, textTransform: 'uppercase' },
  court: { fontSize: 26, fontWeight: '800', color: palette.white },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  noteBox: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
  },
  payBox: {
    marginTop: 16,
    backgroundColor: 'rgba(94,234,212,0.10)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.35)',
    padding: 12,
  },
  payHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  payTitle: { fontSize: 13.5, fontWeight: '800', color: palette.mint },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  rowValue: { fontSize: 13.5, color: palette.white, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
