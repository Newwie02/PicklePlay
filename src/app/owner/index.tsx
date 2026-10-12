import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import { Avatar } from '../../components/glass/Avatar';
import { ErrorBanner } from '../../components/glass/Banner';
import { SectionHeader } from '../../components/glass/SectionHeader';
import { adminFetchBookings, adminFetchStats, adminFetchUsers } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { formatTime, greeting, VENUE } from '../../lib/format';
import type { AdminStats, Booking, User } from '../../lib/types';
import { palette, type } from '../../theme/glass';

export default function OwnerDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [s, u, b] = await Promise.all([
        adminFetchStats(),
        adminFetchUsers(),
        adminFetchBookings(),
      ]);
      setStats(s);
      setRecentUsers(u.users.slice(0, 5));
      setTodayBookings(b.filter((x) => x.date === today && x.status !== 'cancelled'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your numbers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.lime} />
          }
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
              <Text style={type.h2}>{user?.firstName ?? 'Owner'}</Text>
            </View>
            <View style={styles.ownerChip}>
              <Ionicons name="shield-checkmark" size={13} color={palette.ink} />
              <Text style={styles.ownerChipText}>Owner</Text>
            </View>
          </View>

          <ErrorBanner message={error} />

          {/* ---------- Stats ---------- */}
          <Text style={styles.eyebrow}>OVERVIEW</Text>
          {loading && !stats ? (
            <View style={styles.loading}>
              <ActivityIndicator color={palette.lime} size="large" />
              <Text style={type.caption}>Loading your numbers…</Text>
            </View>
          ) : (
            <>
              <View style={styles.statGrid}>
                <StatCard icon="person-add" label="Total sign-ups" value={stats?.totalSignups ?? 0} highlight />
                <StatCard icon="people" label="Players" value={stats?.totalClients ?? 0} />
                <StatCard icon="calendar" label="Bookings today" value={stats?.bookingsToday ?? 0} />
                <StatCard icon="trophy" label="Tournaments" value={stats?.tournaments ?? 0} />
              </View>

              <View style={styles.miniRow}>
                <MiniStat label="New this week" value={`${stats?.newThisWeek ?? 0}`} />
                <MiniStat label="Verified" value={`${stats?.verifiedClients ?? 0}/${stats?.totalClients ?? 0}`} />
                <MiniStat label="All bookings" value={`${stats?.bookingsTotal ?? 0}`} />
              </View>

              {/* ---------- Quick actions ---------- */}
              <View style={styles.actions}>
                <Action
                  icon="add-circle"
                  label="New booking"
                  onPress={() => router.push('/owner/bookings?new=1')}
                />
                <Action
                  icon="trophy"
                  label="Create tournament"
                  onPress={() => router.push('/tournament/create')}
                />
              </View>

              {/* ---------- Today's bookings ---------- */}
              <SectionHeader
                title="Today's bookings"
                action={
                  <Pressable onPress={() => router.push('/owner/bookings')}>
                    <Text style={type.link}>See all</Text>
                  </Pressable>
                }
              />
              {todayBookings.length === 0 ? (
                <GlassCard style={{ alignItems: 'center', gap: 6, paddingVertical: 22 }}>
                  <Ionicons name="calendar-outline" size={26} color={palette.faint} />
                  <Text style={type.caption}>Nothing booked for today yet.</Text>
                </GlassCard>
              ) : (
                todayBookings.map((b) => (
                  <GlassCard key={b.id} style={styles.bookingRow}>
                    <View style={styles.timeTile}>
                      <Text style={styles.timeText}>{formatTime(b.time).split(' ')[0]}</Text>
                      <Text style={styles.timeSuffix}>{formatTime(b.time).split(' ')[1]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={type.h3}>
                        {b.user?.firstName} {b.user?.lastName}
                      </Text>
                      <Text style={type.caption}>
                        Court {b.court?.number} · {b.status}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={palette.faint} />
                  </GlassCard>
                ))
              )}

              {/* ---------- Recent sign-ups ---------- */}
              <SectionHeader
                title="Recent sign-ups"
                action={
                  <Pressable onPress={() => router.push('/owner/users')}>
                    <Text style={type.link}>All users</Text>
                  </Pressable>
                }
              />
              <GlassCard style={{ padding: 0 }}>
                {recentUsers.length === 0 ? (
                  <Text style={[type.caption, { padding: 20 }]}>No players yet — share the app!</Text>
                ) : (
                  recentUsers.map((u) => (
                    <View key={u.id} style={styles.userRow}>
                      <Avatar avatar={u.avatar} firstName={u.firstName} lastName={u.lastName} size={38} />
                      <View style={{ flex: 1 }}>
                        <Text style={type.h3} numberOfLines={1}>
                          {u.firstName} {u.lastName}
                        </Text>
                        <Text style={type.caption} numberOfLines={1}>
                          {u.email}
                        </Text>
                      </View>
                      <Text style={styles.dateTag}>
                        {new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  ))
                )}
              </GlassCard>

              <Text style={[type.caption, styles.venue]}>{VENUE}</Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <GlassCard style={[styles.statCard, highlight && { borderColor: palette.lime }]}>
      <View style={[styles.statIcon, highlight && { backgroundColor: palette.lime }]}>
        <Ionicons name={icon} size={17} color={highlight ? palette.ink : palette.lime} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </GlassCard>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Ionicons name={icon} size={19} color={palette.ink} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgTop },
  container: { padding: 20, gap: 14, paddingBottom: 130 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.lime,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ownerChipText: { fontSize: 12, fontWeight: '800', color: palette.ink },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: palette.lime, marginTop: 4 },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '47.5%', alignItems: 'flex-start', gap: 4, padding: 16 },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(212,243,74,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: { fontSize: 30, fontWeight: '800', color: palette.white },
  statLabel: { fontSize: 12.5, color: palette.muted, fontWeight: '600' },
  miniRow: { flexDirection: 'row', gap: 10 },
  miniStat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 2,
  },
  miniValue: { fontSize: 16, fontWeight: '800', color: palette.mint },
  miniLabel: { fontSize: 10.5, color: palette.muted, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12 },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: palette.lime,
    paddingVertical: 14,
    borderRadius: 999,
  },
  actionText: { fontSize: 14, fontWeight: '700', color: palette.ink },
  bookingRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 0, paddingRight: 14 },
  timeTile: {
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(94,234,212,0.18)',
    alignItems: 'center',
    marginLeft: 12,
  },
  timeText: { fontSize: 15, fontWeight: '800', color: palette.white },
  timeSuffix: { fontSize: 10, fontWeight: '700', color: palette.mint },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  dateTag: { fontSize: 11.5, color: palette.faint, fontWeight: '600' },
  venue: { textAlign: 'center', fontSize: 11.5, marginTop: 4 },
});
