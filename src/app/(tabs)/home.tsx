import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassBackground } from '../../components/glass/GlassBackground';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassButton } from '../../components/glass/GlassButton';
import { Avatar } from '../../components/glass/Avatar';
import { SuccessBanner } from '../../components/glass/Banner';
import { fetchAnnouncements, fetchMyBookings } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { formatShortDate, formatTime, greeting, timeAgo, VENUE } from '../../lib/format';
import type { Announcement, Booking } from '../../lib/types';
import { palette, type } from '../../theme/glass';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [next, setNext] = useState<Booking | null>(null);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [mine, ann] = await Promise.all([
        fetchMyBookings(user.id),
        fetchAnnouncements(),
      ]);
      setNext(mine.next);
      setUpcoming(mine.bookings.filter((b) => b.id !== mine.next?.id).slice(0, 4));
      setAnnouncements(ann);
    } catch {
      // Keep whatever we already have; the pull-to-refresh strip stays usable.
    } finally {
      setLoaded(true);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /** "Court 2 · Oct 11, 2026 · 6:00 PM" — the required Next Game line. */
  const nextGameLine = (b: Booking) =>
    `Court ${b.court?.number ?? '?'} · ${formatShortDate(b.date)}, ${b.date.slice(0, 4)} · ${formatTime(b.time)}`;

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.lime} />}
        >
          {/* ---------- Header ---------- */}
          <View style={styles.header}>
            <Avatar
              avatar={user?.avatar}
              firstName={user?.firstName ?? ''}
              lastName={user?.lastName ?? ''}
              size={46}
            />
            <View style={{ flex: 1 }}>
              <Text style={type.caption}>{greeting()},</Text>
              <Text style={type.h2}>{user?.firstName ?? 'Player'}</Text>
            </View>
            <GlassCard style={styles.bell}>
              <Ionicons name="notifications-outline" size={19} color={palette.white} />
            </GlassCard>
          </View>

          {/* ---------- Next Game ---------- */}
          <Text style={styles.eyebrow}>NEXT GAME</Text>
          <GlassCard strong>
            {next ? (
              <>
                <Text style={styles.nextLine}>{nextGameLine(next)}</Text>
                <View style={styles.venueRow}>
                  <Ionicons name="location" size={14} color={palette.mint} />
                  <Text style={[type.caption, { flex: 1 }]}>{next.court?.venue ?? VENUE}</Text>
                </View>
                {/* Payment went through the app, so the admin still has to
                    match the reference before this is a firm booking. */}
                {next.status === 'pending' ? (
                  <View style={styles.pendingRow}>
                    <Ionicons name="hourglass-outline" size={13} color={palette.warn} />
                    <Text style={styles.pendingText}>
                      Awaiting admin verification — your slot is held.
                    </Text>
                  </View>
                ) : null}
                {next.note ? <Text style={styles.note}>“{next.note}”</Text> : null}
                <View style={{ marginTop: 16, alignSelf: 'flex-start', width: 170 }}>
                  <GlassButton
                    title="View Booking"
                    onPress={() => router.push(`/booking/${next.id}`)}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.nextLine}>No game booked yet</Text>
                <Text style={[type.caption, { marginTop: 4 }]}>
                  Grab an open court and get on the schedule.
                </Text>
                <View style={{ marginTop: 16, alignSelf: 'flex-start', width: 170 }}>
                  <GlassButton title="Find a court" onPress={() => router.push('/courts')} />
                </View>
              </>
            )}
          </GlassCard>

          {/* ---------- Announcements ---------- */}
          {announcements.length > 0 ? (
            <>
              <Text style={styles.eyebrow}>ANNOUNCEMENTS</Text>
              {announcements.slice(0, 2).map((a) => (
                <GlassCard key={a.id} style={styles.annCard}>
                  <View style={styles.annHead}>
                    <Ionicons name="megaphone" size={15} color={palette.lime} />
                    <Text style={type.h3}>{a.title}</Text>
                  </View>
                  {a.body ? <Text style={[type.caption, { marginTop: 6 }]}>{a.body}</Text> : null}
                  <Text style={styles.time}>{timeAgo(a.createdAt)}</Text>
                </GlassCard>
              ))}
            </>
          ) : null}

          {/* ---------- Upcoming ---------- */}
          {upcoming.length > 0 ? (
            <>
              <View style={styles.sectionHead}>
                <Text style={type.h2}>Upcoming bookings</Text>
                <Text style={type.link}>See all</Text>
              </View>
              {upcoming.map((b) => (
                <GlassCard key={b.id} style={styles.booking}>
                  <View style={styles.dateTile}>
                    <Text style={styles.dateDay}>{formatShortDate(b.date).split(' ')[0]}</Text>
                    <Text style={styles.dateNum}>{b.date.slice(8, 10)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h3}>Court {b.court?.number}</Text>
                    <Text style={type.caption}>
                      {formatShortDate(b.date)} · {formatTime(b.time)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={palette.faint} />
                </GlassCard>
              ))}
            </>
          ) : loaded && !next ? (
            <SuccessBanner message="Tip: bookings appear here the moment the court owner confirms them." />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgTop },
  container: { padding: 20, gap: 14, paddingBottom: 130 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', padding: 0 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: palette.lime,
    marginTop: 6,
  },
  nextLine: { fontSize: 20, fontWeight: '700', color: palette.white, lineHeight: 27 },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,213,138,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,213,138,0.4)',
  },
  pendingText: { flex: 1, fontSize: 12, fontWeight: '700', color: palette.warn },
  note: { fontSize: 13.5, fontStyle: 'italic', color: palette.muted, marginTop: 8 },
  annHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  annCard: { padding: 16 },
  time: { fontSize: 11.5, color: palette.faint, marginTop: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  booking: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 0, paddingRight: 14 },
  dateTile: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(212,243,74,0.2)',
    alignItems: 'center',
    marginLeft: 12,
  },
  dateDay: { fontSize: 11, fontWeight: '700', color: palette.lime, textTransform: 'uppercase' },
  dateNum: { fontSize: 20, fontWeight: '700', color: palette.white },
});
