import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import {
  DbError,
  fetchTournament,
  fetchTournamentMatches,
  fetchTournamentStandings,
} from '../../lib/db';
import { formatDate, formatTime, isDoubles, playerName } from '../../lib/format';
import type { StandingRow, Tournament, TournamentMatch } from '../../lib/types';
import { Avatar } from '../../components/glass/Avatar';
import { ErrorBanner } from '../../components/glass/Banner';
import { GlassBackground } from '../../components/glass/GlassBackground';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';
import { SectionHeader } from '../../components/glass/SectionHeader';
import { palette, type } from '../../theme/glass';

const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}']; // 🥇 🥈 🥉

/**
 * One tournament, and — once the owner starts entering scores — its
 * results: the champion, the final standings, and every match with the
 * score it ended on. Read-only for players; the owner gets a shortcut
 * into the screen where results are entered.
 */
export default function TournamentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const t = await fetchTournament(id);
      setTournament(t);
      if (!t) {
        setError('That tournament could not be found.');
        return;
      }

      // Results come from the newer tables, so keep the event on screen
      // even when they are missing — that error is a setup problem, not a
      // reason to blank the page.
      let m: TournamentMatch[] = [];
      let s: StandingRow[] = [];
      try {
        [m, s] = await Promise.all([fetchTournamentMatches(id), fetchTournamentStandings(id)]);
      } catch {
        setError('Results are not available yet — supabase/tournament_results.sql has not been run.');
      }
      setMatches(m);
      setStandings(s);
    } catch (e) {
      setError(e instanceof DbError ? e.message : 'Could not load this tournament.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /** Matches kept in the order the bracket was built, grouped by round. */
  const rounds = useMemo(() => {
    const groups: { round: string; items: TournamentMatch[] }[] = [];
    for (const m of matches) {
      const last = groups[groups.length - 1];
      if (last && last.round === m.round) last.items.push(m);
      else groups.push({ round: m.round, items: [m] });
    }
    return groups;
  }, [matches]);

  const finished = tournament?.status === 'finished';
  const champion = standings.find((s) => s.position === 1);
  const finishedCount = matches.filter((m) => m.status === 'finished').length;

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.head}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
              <Ionicons name="chevron-back" size={20} color={palette.white} />
            </Pressable>
            <Text style={type.h1}>Tournament</Text>
          </View>

          <ErrorBanner message={error} />

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={palette.lime} size="large" />
            </View>
          ) : tournament ? (
            <>
              {/* ---- The event itself ---------------------------------- */}
              <GlassCard strong>
                <View style={styles.statusRow}>
                  <View style={[styles.statusChip, finished && styles.statusFinished]}>
                    <Text style={[styles.statusText, finished && { color: palette.ink }]}>
                      {finished ? 'finished' : tournament.status}
                    </Text>
                  </View>
                  <Text style={type.eyebrow}>{tournament.division}</Text>
                </View>

                <Text style={[type.h1, { marginTop: 10 }]}>{tournament.name}</Text>

                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={15} color={palette.mint} />
                  <Text style={[type.body, { flex: 1 }]}>
                    {formatDate(tournament.date)} · {formatTime(tournament.time)}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="trophy-outline" size={15} color={palette.mint} />
                  <Text style={[type.body, { flex: 1 }]}>{tournament.format}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={15} color={palette.mint} />
                  <Text style={[type.caption, { flex: 1 }]}>{tournament.venue}</Text>
                </View>

                {tournament.prize ? (
                  <View style={styles.prizeBox}>
                    <Ionicons name="ribbon-outline" size={14} color={palette.lime} />
                    <Text style={[type.caption, { flex: 1, color: palette.lime }]}>
                      Prize: {tournament.prize}
                    </Text>
                  </View>
                ) : null}

                {tournament.description ? (
                  <Text style={[type.caption, { marginTop: 10 }]}>{tournament.description}</Text>
                ) : null}

                <Text style={[type.caption, { marginTop: 10 }]}>
                  {tournament.joinedCount ?? tournament.participants.length} of {tournament.slots}{' '}
                  slots filled
                  {finished ? '' : tournament.status === 'open' ? ' · registration open' : ''}
                </Text>
              </GlassCard>

              {/* ---- Champion ------------------------------------------ */}
              {champion ? (
                <GlassCard accent={palette.lime}>
                  <View style={styles.championRow}>
                    <Avatar
                      avatar={champion.player.avatar}
                      firstName={champion.player.firstName}
                      lastName={champion.player.lastName}
                      size={56}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={type.eyebrow}>
                        {finished ? 'Champion' : 'Leading'}
                      </Text>
                      <Text style={[type.h2, { marginTop: 2 }]}>
                        {playerName(champion.player.firstName, champion.player.lastName)}
                      </Text>
                      <Text style={[type.caption, { marginTop: 2 }]}>
                        {champion.wins}W · {champion.played} played ·{' '}
                        {champion.pointDiff >= 0 ? '+' : ''}
                        {champion.pointDiff} diff
                      </Text>
                    </View>
                    <Text style={styles.medal}>{MEDALS[0]}</Text>
                  </View>
                </GlassCard>
              ) : null}

              {/* ---- Standings ----------------------------------------- */}
              {standings.length > 0 ? (
                <>
                  <SectionHeader
                    title={finished ? 'Final standings' : 'Standings so far'}
                  />
                  <GlassCard style={{ padding: 0 }}>
                    {standings.map((row, i) => (
                      <View
                        key={row.player.id}
                        style={[styles.standRow, i === standings.length - 1 && styles.standLast]}
                      >
                        <Text style={styles.standPos}>
                          {row.position <= 3 ? MEDALS[row.position - 1] : row.position}
                        </Text>
                        <Avatar
                          avatar={row.player.avatar}
                          firstName={row.player.firstName}
                          lastName={row.player.lastName}
                          size={34}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.standName,
                              row.position === 1 && { color: palette.lime },
                            ]}
                          >
                            {playerName(row.player.firstName, row.player.lastName)}
                          </Text>
                          <Text style={type.caption}>
                            {row.wins}W · {row.played} played
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.standDiff,
                            { color: row.pointDiff >= 0 ? palette.lime : palette.warn },
                          ]}
                        >
                          {row.pointDiff >= 0 ? '+' : ''}
                          {row.pointDiff}
                        </Text>
                      </View>
                    ))}
                  </GlassCard>
                </>
              ) : null}

              {/* ---- Matches, round by round ---------------------------- */}
              <SectionHeader title={`Matches (${finishedCount}/${matches.length} played)`} />
              {rounds.length === 0 ? (
                <GlassCard style={{ alignItems: 'center', paddingVertical: 26 }}>
                  <Ionicons name="git-branch-outline" size={26} color={palette.faint} />
                  <Text style={[type.caption, { marginTop: 8, textAlign: 'center' }]}>
                    No matches yet.{' '}
                    {user?.role === 'owner'
                      ? 'Tap "Record results" below to add the draw.'
                      : 'The court owner adds the draw when it is ready.'}
                  </Text>
                </GlassCard>
              ) : (
                rounds.map((group) => (
                  <View key={group.round} style={{ gap: 10 }}>
                    <Text style={type.eyebrow}>{group.round}</Text>
                    {group.items.map((m) => (
                      <GlassCard key={m.id} style={styles.matchCard}>
                        <MatchRow m={m} />
                      </GlassCard>
                    ))}
                  </View>
                ))
              )}

              {/* ---- Doubles bracket ------------------------------------- */}
              {isDoubles(tournament.format) ? (
                <GlassButton
                  title="View bracket"
                  variant="secondary"
                  onPress={() => router.push(`/tournament/bracket?id=${tournament.id}`)}
                />
              ) : null}

              {/* ---- Owner shortcut ------------------------------------- */}
              {user?.role === 'owner' ? (
                <GlassButton
                  title={isDoubles(tournament.format) ? 'Teams & results' : 'Record results'}
                  variant="secondary"
                  onPress={() =>
                    router.push(
                      isDoubles(tournament.format)
                        ? `/tournament/teams?id=${tournament.id}`
                        : `/tournament/manage?id=${tournament.id}`
                    )
                  }
                />
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** One fixture: player, score, player — the winner picked out in lime. */
function MatchRow({ m }: { m: TournamentMatch }) {
  const done = m.status === 'finished';
  const homeWon = done && (m.homeScore ?? 0) > (m.awayScore ?? 0);
  const awayWon = done && (m.awayScore ?? 0) > (m.homeScore ?? 0);

  return (
    <View style={styles.matchRow}>
      <View style={[styles.side, homeWon && styles.sideWin]}>
        <Avatar
          avatar={m.home?.avatar}
          firstName={m.home?.firstName ?? ''}
          lastName={m.home?.lastName ?? ''}
          size={28}
        />
        <Text numberOfLines={1} style={[styles.sideName, homeWon && styles.nameWin]}>
          {playerName(m.home?.firstName, m.home?.lastName)}
        </Text>
      </View>

      <View style={styles.scoreBox}>
        <Text style={[styles.score, homeWon && styles.nameWin]}>{m.homeScore ?? '–'}</Text>
        <Text style={styles.scoreSep}>{done ? ':' : 'vs'}</Text>
        <Text style={[styles.score, awayWon && styles.nameWin]}>{m.awayScore ?? '–'}</Text>
      </View>

      <View style={[styles.side, styles.sideAway, awayWon && styles.sideWin]}>
        <Text numberOfLines={1} style={[styles.sideName, styles.sideAwayName, awayWon && styles.nameWin]}>
          {playerName(m.away?.firstName, m.away?.lastName)}
        </Text>
        <Avatar
          avatar={m.away?.avatar}
          firstName={m.away?.firstName ?? ''}
          lastName={m.away?.lastName ?? ''}
          size={28}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgTop },
  container: { padding: 20, gap: 14, paddingBottom: 60 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  loading: { paddingVertical: 60, alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(212,243,74,0.18)',
  },
  statusFinished: { backgroundColor: palette.lime },
  statusText: { color: palette.lime, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  prizeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(212,243,74,0.10)',
  },
  championRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  medal: { fontSize: 30 },
  standRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  standLast: { borderBottomWidth: 0 },
  standPos: { width: 34, textAlign: 'center', color: palette.white, fontWeight: '700' },
  standName: { color: palette.white, fontSize: 15, fontWeight: '600' },
  standDiff: { fontSize: 14, fontWeight: '700' },
  matchCard: { paddingVertical: 14 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sideAway: { justifyContent: 'flex-end' },
  sideAwayName: { textAlign: 'right' },
  sideName: { flex: 1, color: palette.muted, fontSize: 14, fontWeight: '500' },
  sideWin: { opacity: 1 },
  nameWin: { color: palette.lime, fontWeight: '700' },
  scoreBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  score: { color: palette.white, fontSize: 17, fontWeight: '700', minWidth: 22, textAlign: 'center' },
  scoreSep: { color: palette.faint, fontSize: 12, fontWeight: '600' },
});
