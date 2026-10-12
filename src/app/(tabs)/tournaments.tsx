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
import { GlassButton } from '../../components/glass/GlassButton';
import { ErrorBanner, SuccessBanner } from '../../components/glass/Banner';
import { SectionHeader } from '../../components/glass/SectionHeader';
import {
  DbError,
  fetchAnnouncements,
  fetchTournaments,
  joinTournament,
  leaveTournament,
} from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { formatDate, formatTime, timeAgo, VENUE } from '../../lib/format';
import type { Announcement, Tournament } from '../../lib/types';
import { palette, type } from '../../theme/glass';

export default function TournamentsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, a] = await Promise.all([fetchTournaments(), fetchAnnouncements()]);
      setTournaments(t);
      setAnnouncements(a);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tournaments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isJoined = (t: Tournament) => !!user && t.participants.includes(user.id);

  const toggleJoin = async (t: Tournament) => {
    if (!user) return;
    setError(null);
    setSuccess(null);
    setJoining(t.id);
    const wasJoined = isJoined(t);
    try {
      if (wasJoined) {
        await leaveTournament(t.id);
      } else {
        await joinTournament(t.id);
      }
      setSuccess(wasJoined ? `You left ${t.name}.` : `You're in! See you at ${t.name}.`);
      await load();
    } catch (e) {
      setError(e instanceof DbError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setJoining(null);
    }
  };

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
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <Text style={type.h1}>Tournaments</Text>
              <Text style={[type.caption, { marginTop: 4 }]}>Compete, climb, collect points.</Text>
            </View>
            {user?.role === 'owner' ? (
              <Pressable style={styles.addButton} onPress={() => router.push('/tournament/create')}>
                <Ionicons name="add" size={20} color={palette.ink} />
                <Text style={styles.addText}>New</Text>
              </Pressable>
            ) : null}
          </View>

          <ErrorBanner message={error} />
          <SuccessBanner message={success} />

          {/* ---------- Announcements ---------- */}
          {announcements.length > 0 ? (
            <View style={{ gap: 12 }}>
              <SectionHeader title="Announcements" />
              {announcements.slice(0, 3).map((a) => (
                <GlassCard key={a.id} style={styles.annCard}>
                  <View style={styles.annHead}>
                    <Ionicons name="megaphone" size={15} color={palette.lime} />
                    <Text style={[type.h3, { flex: 1 }]}>{a.title}</Text>
                    <Text style={styles.time}>{timeAgo(a.createdAt)}</Text>
                  </View>
                  {a.body ? <Text style={[type.caption, { marginTop: 6 }]}>{a.body}</Text> : null}
                </GlassCard>
              ))}
            </View>
          ) : null}

          {/* ---------- Open tournaments ---------- */}
          <SectionHeader title={`Open events (${tournaments.length})`} />

          {loading && tournaments.length === 0 ? (
            <View style={styles.loading}>
              <ActivityIndicator color={palette.lime} size="large" />
              <Text style={type.caption}>Loading tournaments…</Text>
            </View>
          ) : tournaments.length === 0 ? (
            <GlassCard style={{ alignItems: 'center', gap: 8, paddingVertical: 30 }}>
              <Ionicons name="trophy-outline" size={34} color={palette.faint} />
              <Text style={type.h3}>No tournaments yet</Text>
              <Text style={[type.caption, { textAlign: 'center' }]}>
                Check back soon — the court owner posts events here.
              </Text>
            </GlassCard>
          ) : (
            tournaments.map((t) => {
              const joined = isJoined(t);
              const full = (t.joinedCount ?? t.participants.length) >= t.slots;
              return (
                <GlassCard key={t.id}>
                  <View style={styles.tHead}>
                    <View style={styles.divisionChip}>
                      <Text style={styles.divisionText}>{t.division}</Text>
                    </View>
                    <Text style={styles.time}>{formatDate(t.date)}</Text>
                  </View>

                  <Text style={[type.h2, { marginTop: 10 }]}>{t.name}</Text>
                  <Text style={[type.caption, { marginTop: 4 }]}>{t.format} · {t.venue || VENUE}</Text>

                  <View style={styles.metaRow}>
                    <Meta icon="time" label={formatTime(t.time)} />
                    <Meta icon="people" label={`${t.joinedCount ?? t.participants.length}/${t.slots} joined`} />
                    <Meta icon="pricetag" label={t.fee > 0 ? `₱${t.fee}` : 'Free'} />
                  </View>

                  {t.description ? <Text style={styles.desc}>{t.description}</Text> : null}
                  {t.prize ? (
                    <View style={styles.prizeRow}>
                      <Ionicons name="ribbon" size={14} color={palette.lime} />
                      <Text style={styles.prizeText}>{t.prize}</Text>
                    </View>
                  ) : null}

                  <GlassButton
                    title={joined ? 'Leave tournament' : full ? 'Tournament full' : 'Join tournament'}
                    variant={joined ? 'danger' : 'primary'}
                    disabled={!joined && full}
                    loading={joining === t.id}
                    onPress={() => toggleJoin(t)}
                    style={{ marginTop: 14 }}
                  />
                </GlassCard>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Meta({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={13} color={palette.mint} />
      <Text style={styles.metaText}>{label}</Text>
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
  annCard: { padding: 16 },
  annHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { fontSize: 11.5, color: palette.faint },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  tHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divisionChip: {
    backgroundColor: 'rgba(212,243,74,0.2)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  divisionText: { fontSize: 11, fontWeight: '700', color: palette.lime, textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
  desc: { fontSize: 13.5, color: palette.muted, marginTop: 12, lineHeight: 19 },
  prizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: 'rgba(212,243,74,0.12)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  prizeText: { fontSize: 12.5, fontWeight: '600', color: palette.lime, flex: 1 },
});
