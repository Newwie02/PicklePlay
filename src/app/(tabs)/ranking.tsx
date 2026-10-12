import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { Avatar } from '../../components/glass/Avatar';
import { fetchRankings } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import type { RankingRow } from '../../lib/types';
import { palette, type } from '../../theme/glass';

export default function RankingScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetchRankings();
      setRows(res.rankings);
      setMyRank(res.myRank);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the ladder.');
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

  const first = rows[0] ?? null;
  const second = rows[1] ?? null;
  const third = rows[2] ?? null;

  // Podium order: 2nd on left, 1st in the CENTER, 3rd on right
  const podiumSpots = [
    second ? { row: second, rank: 2, medal: '🥈', barHeight: 54, avatarSize: 52, isCenter: false } : null,
    first ? { row: first, rank: 1, medal: '🥇', barHeight: 84, avatarSize: 66, isCenter: true } : null,
    third ? { row: third, rank: 3, medal: '🥉', barHeight: 40, avatarSize: 48, isCenter: false } : null,
  ].filter(Boolean) as {
    row: RankingRow;
    rank: number;
    medal: string;
    barHeight: number;
    avatarSize: number;
    isCenter: boolean;
  }[];

  const rest = rows.slice(3);
  const me = rows.find((r) => r.user.id === user?.id) ?? null;

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
          <View>
            <Text style={type.h1}>Ranking</Text>
            <Text style={[type.caption, { marginTop: 4 }]}>Season ladder · Spin & Smash</Text>
          </View>

          {error ? <Text style={type.error}>{error}</Text> : null}

          {/* ---------- My rank strip ---------- */}
          {me && myRank ? (
            <GlassCard strong style={styles.myCard}>
              <View style={styles.myRankBadge}>
                <Text style={styles.myRankNum}>#{myRank}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>Your standing</Text>
                <Text style={type.caption}>
                  {me.points} pts · {me.wins}W · {me.matches} matches
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.faint} />
            </GlassCard>
          ) : null}

          {loading && rows.length === 0 ? (
            <View style={styles.loading}>
              <ActivityIndicator color={palette.lime} size="large" />
              <Text style={type.caption}>Crunching the standings…</Text>
            </View>
          ) : (
            <>
              {/* ---------- Podium ---------- */}
              <View style={styles.podium}>
                {podiumSpots.map((spot) => (
                  <View
                    key={spot.row.user.id}
                    style={[styles.podiumCol, spot.isCenter && styles.podiumCenter]}
                  >
                    <View style={styles.medalWrapper}>
                      <Text style={[styles.medal, spot.isCenter && { fontSize: 26 }]}>
                        {spot.medal}
                      </Text>
                      {spot.isCenter ? (
                        <View style={styles.crownTag}>
                          <Text style={styles.crownTagText}>#1</Text>
                        </View>
                      ) : null}
                    </View>

                    <Avatar
                      avatar={spot.row.user.avatar}
                      firstName={spot.row.user.firstName}
                      lastName={spot.row.user.lastName}
                      size={spot.avatarSize}
                    />
                    <Text
                      style={[
                        styles.podiumName,
                        spot.isCenter && { fontSize: 14.5, fontWeight: '800' },
                      ]}
                      numberOfLines={1}
                    >
                      {spot.row.user.firstName}
                    </Text>
                    <Text style={[styles.podiumPoints, spot.isCenter && { fontSize: 13.5 }]}>
                      {spot.row.points}
                    </Text>
                    <View
                      style={[
                        styles.podiumBar,
                        { height: spot.barHeight },
                        spot.isCenter && styles.podiumBarFirst,
                      ]}
                    >
                      <Text
                        style={[
                          styles.podiumBarRank,
                          spot.isCenter && styles.podiumBarRankFirst,
                        ]}
                      >
                        {spot.rank}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* ---------- Full list ---------- */}
              <GlassCard style={{ padding: 0 }}>
                {rest.length === 0 ? (
                  <Text style={[type.caption, { padding: 20 }]}>
                    That is everyone on the ladder so far — play to move up!
                  </Text>
                ) : (
                  rest.map((row, i) => {
                    const rank = i + 4;
                    const mine = row.user.id === user?.id;
                    return (
                      <View key={row.user.id} style={[styles.row, mine && styles.rowMine]}>
                        <Text style={styles.rank}>{rank}</Text>
                        <Avatar
                          avatar={row.user.avatar}
                          firstName={row.user.firstName}
                          lastName={row.user.lastName}
                          size={38}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={type.h3} numberOfLines={1}>
                            {row.user.firstName} {row.user.lastName}
                            {mine ? '  ·  you' : ''}
                          </Text>
                          <Text style={type.caption}>
                            {row.wins}W · {row.matches} matches · {row.user.location || 'Tagum City'}
                          </Text>
                        </View>
                        <View style={styles.pointsCol}>
                          <Text style={styles.points}>{row.points}</Text>
                          <Text style={styles.ptsLabel}>pts</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </GlassCard>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgTop },
  container: { padding: 20, gap: 16, paddingBottom: 130 },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  myCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  myRankBadge: {
    minWidth: 58,
    height: 46,
    borderRadius: 16,
    backgroundColor: palette.lime,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  myRankNum: { fontSize: 18, fontWeight: '800', color: palette.ink },
  podium: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-end' },
  podiumCol: { flex: 1, alignItems: 'center', gap: 5 },
  podiumCenter: { transform: [{ translateY: -6 }] },
  medalWrapper: { alignItems: 'center', gap: 2 },
  medal: { fontSize: 22 },
  crownTag: {
    backgroundColor: palette.lime,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 8,
    marginTop: -2,
  },
  crownTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.ink,
  },
  podiumName: { fontSize: 13, fontWeight: '700', color: palette.white, maxWidth: '100%' },
  podiumPoints: { fontSize: 12.5, fontWeight: '700', color: palette.lime },
  podiumBar: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumBarFirst: {
    backgroundColor: 'rgba(212,243,74,0.22)',
    borderColor: palette.lime,
  },
  podiumBarRank: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.muted,
  },
  podiumBarRankFirst: {
    fontSize: 21,
    fontWeight: '900',
    color: palette.lime,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  rowMine: { backgroundColor: 'rgba(212,243,74,0.14)' },
  rank: { width: 24, textAlign: 'center', fontSize: 14, fontWeight: '700', color: palette.muted },
  pointsCol: { alignItems: 'flex-end' },
  points: { fontSize: 15, fontWeight: '800', color: palette.lime },
  ptsLabel: { fontSize: 10, color: palette.faint, textTransform: 'uppercase' },
});
