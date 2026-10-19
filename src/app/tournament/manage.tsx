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
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import {
  DbError,
  adminAddMatch,
  adminRemoveMatch,
  adminReportResult,
  adminSetTournamentStatus,
  fetchProfilesByIds,
  fetchTournament,
  fetchTournamentMatches,
  fetchTournamentStandings,
} from '../../lib/db';
import { playerName } from '../../lib/format';
import type { StandingRow, Tournament, TournamentMatch, User } from '../../lib/types';
import { ErrorBanner } from '../../components/glass/Banner';
import { GlassBackground } from '../../components/glass/GlassBackground';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassInput } from '../../components/glass/GlassInput';
import { GlassSelect } from '../../components/glass/GlassSelect';
import { SectionHeader } from '../../components/glass/SectionHeader';
import { palette, type } from '../../theme/glass';

/** "Ana Cruz · a1b2" — unique enough to map a dropdown pick back to an id. */
function pickLabel(u: User): string {
  return `${playerName(u.firstName, u.lastName)} · ${u.id.slice(0, 4)}`;
}

const EMPTY = { home: '', away: '' };

/**
 * Where results come from. The owner sets up the draw, types the scores
 * as matches are played, then finishes the tournament — which pays the
 * podium bonus and posts the result as an announcement.
 */
export default function ManageTournament() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [players, setPlayers] = useState<User[]>([]);

  const [round, setRound] = useState('Round 1');
  const [homePick, setHomePick] = useState('');
  const [awayPick, setAwayPick] = useState('');
  const [scores, setScores] = useState<Record<string, typeof EMPTY>>({});

  const load = useCallback(async () => {
    try {
      setError(null);
      const t = await fetchTournament(id);
      setTournament(t);
      if (!t) {
        setError('That tournament could not be found.');
        return;
      }
      setPlayers(await fetchProfilesByIds(t.participants ?? []));

      // Same reasoning as the detail screen: results are optional here.
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

  const run = useCallback(
    async (key: string, action: () => Promise<string | null>) => {
      setBusy(key);
      setError(null);
      setSuccess(null);
      try {
        setSuccess(await action());
        await load();
      } catch (e) {
        setError(e instanceof DbError ? e.message : 'Something went wrong. Please try again.');
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  // Every hook above this line — the owner guard goes after them, same as create.tsx.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (user?.role !== 'owner') return <Redirect href="/login" />;

  const byId = (pick: string) => players.find((p) => pickLabel(p) === pick)?.id ?? '';
  const options = players.map(pickLabel);
  const finished = tournament?.status === 'finished';
  const scheduled = matches.filter((m) => m.status === 'scheduled');

  const addMatch = () =>
    run('add', async () => {
      const homeUserId = byId(homePick);
      const awayUserId = byId(awayPick);
      if (!homeUserId || !awayUserId) throw new DbError('Pick both players for this match.');
      if (homeUserId === awayUserId) throw new DbError('A player cannot play against themselves.');
      await adminAddMatch({ tournamentId: id, round, homeUserId, awayUserId });
      setHomePick('');
      setAwayPick('');
      return 'Match added to the draw.';
    });

  const saveResult = (m: TournamentMatch) =>
    run(`save-${m.id}`, async () => {
      const entry = scores[m.id] ?? EMPTY;
      const home = Number(entry.home);
      const away = Number(entry.away);
      if (entry.home.trim() === '' || entry.away.trim() === '' || Number.isNaN(home) || Number.isNaN(away)) {
        throw new DbError('Enter both scores.');
      }
      if (home < 0 || away < 0) throw new DbError('Scores cannot be negative.');
      if (home === away) throw new DbError('A match cannot end level — play on until someone wins.');
      await adminReportResult(m.id, Math.trunc(home), Math.trunc(away));
      return 'Result saved — 10 points go to the winner.';
    });

  const removeMatch = (m: TournamentMatch) => {
    const done = m.status === 'finished';
    Alert.alert(
      'Remove this match?',
      done
        ? 'The score will be deleted and the 10 points it gave the winner are taken back.'
        : 'This fixture will be removed from the draw.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => run(`remove-${m.id}`, async () => {
            await adminRemoveMatch(m.id);
            return 'Match removed.';
          }),
        },
      ]
    );
  };

  const changeStatus = (next: Tournament['status']) => {
    if (next === 'finished') {
      Alert.alert(
        'Finish this tournament?',
        'This pays the podium bonus (100 / 50 / 25 points) and posts the result as an announcement everyone can see. You cannot add matches afterwards.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Finish it',
            onPress: () => run('status', async () => {
              await adminSetTournamentStatus(id, 'finished');
              return 'Tournament finished — results are live.';
            }),
          },
        ]
      );
      return;
    }
    run('status', async () => {
      await adminSetTournamentStatus(id, next);
      return next === 'ongoing' ? 'Tournament is now live.' : 'Tournament reopened.';
    });
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
            <Text style={type.h1}>Record results</Text>
          </View>

          <ErrorBanner message={error} />
          {success ? (
            <View style={styles.okBox}>
              <Ionicons name="checkmark-circle" size={16} color={palette.lime} />
              <Text style={[type.caption, { color: palette.lime, flex: 1 }]}>{success}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={palette.lime} size="large" />
            </View>
          ) : !tournament ? null : (
            <>
              <GlassCard strong>
                <Text style={type.eyebrow}>{tournament.division}</Text>
                <Text style={[type.h2, { marginTop: 4 }]}>{tournament.name}</Text>
                <Text style={[type.caption, { marginTop: 4 }]}>
                  Status: <Text style={{ color: palette.lime }}>{tournament.status}</Text> ·{' '}
                  {standings.length > 0 ? `${standings.length} players have results` : 'no results yet'}
                </Text>
              </GlassCard>

              {/* ---- Life cycle ---------------------------------------- */}
              <SectionHeader title="Tournament status" />
              <GlassCard>
                {finished ? (
                  <Text style={type.caption}>
                    This tournament is finished. The standings, the champion and the announcement
                    are live for everyone. Reopen it below only if a result needs fixing.
                  </Text>
                ) : (
                  <>
                    <Text style={type.caption}>
                      Move it to <Text style={{ color: palette.white }}>ongoing</Text> when play
                      starts, and <Text style={{ color: palette.white }}>finished</Text> when the
                      last match is in.
                    </Text>
                    <View style={styles.btnRow}>
                      <View style={{ flex: 1 }}>
                        <GlassButton
                          title="Start tournament"
                          variant="secondary"
                          disabled={tournament.status === 'ongoing'}
                          loading={busy === 'status'}
                          onPress={() => changeStatus('ongoing')}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <GlassButton
                          title="Finish tournament"
                          variant="primary"
                          loading={busy === 'status'}
                          onPress={() => changeStatus('finished')}
                        />
                      </View>
                    </View>
                  </>
                )}
                {finished ? (
                  <View style={{ marginTop: 12 }}>
                    <GlassButton
                      title="Reopen tournament"
                      variant="secondary"
                      loading={busy === 'status'}
                      onPress={() => changeStatus('ongoing')}
                    />
                  </View>
                ) : null}
              </GlassCard>

              {/* ---- Add a fixture -------------------------------------- */}
              {!finished ? (
                <>
                  <SectionHeader title="Add a match" />
                  <GlassCard>
                    {players.length < 2 ? (
                      <Text style={type.caption}>
                        At least two players need to join before you can set up a match.
                      </Text>
                    ) : (
                      <>
                        <GlassInput
                          label="Round"
                          placeholder="e.g. Quarterfinal"
                          value={round}
                          onChangeText={setRound}
                          autoCapitalize="words"
                        />
                        <GlassSelect
                          label="Home"
                          placeholder="Pick a player"
                          value={homePick}
                          options={options}
                          onSelect={setHomePick}
                          searchable
                        />
                        <GlassSelect
                          label="Away"
                          placeholder="Pick an opponent"
                          value={awayPick}
                          options={options}
                          onSelect={setAwayPick}
                          searchable
                        />
                        <GlassButton
                          title="Add match"
                          variant="secondary"
                          loading={busy === 'add'}
                          onPress={addMatch}
                        />
                      </>
                    )}
                  </GlassCard>
                </>
              ) : null}

              {/* ---- Enter scores ---------------------------------------- */}
              <SectionHeader title={`Matches (${matches.length})`} />
              {matches.length === 0 ? (
                <GlassCard style={{ alignItems: 'center', paddingVertical: 26 }}>
                  <Ionicons name="git-branch-outline" size={26} color={palette.faint} />
                  <Text style={[type.caption, { marginTop: 8, textAlign: 'center' }]}>
                    Nothing in the draw yet.
                  </Text>
                </GlassCard>
              ) : (
                matches.map((m) => {
                  const entry = scores[m.id] ?? EMPTY;
                  const setScore = (side: 'home' | 'away', value: string) =>
                    setScores((prev) => ({ ...prev, [m.id]: { ...(prev[m.id] ?? EMPTY), [side]: value } }));

                  return (
                    <GlassCard key={m.id}>
                      <View style={styles.matchHead}>
                        <Text style={type.eyebrow}>
                          {m.round} #{m.matchNo}
                        </Text>
                        <Text style={type.caption}>
                          {m.status === 'finished' ? 'final' : 'awaiting result'}
                        </Text>
                      </View>

                      {m.status === 'finished' ? (
                        <Text style={styles.finalLine}>
                          {playerName(m.home?.firstName, m.home?.lastName)}{' '}
                          <Text style={styles.finalScore}>
                            {m.homeScore}–{m.awayScore}
                          </Text>{' '}
                          {playerName(m.away?.firstName, m.away?.lastName)}
                        </Text>
                      ) : (
                        <View style={styles.scoreRow}>
                          <View style={{ flex: 1 }}>
                            <GlassInput
                              label={playerName(m.home?.firstName, m.home?.lastName)}
                              placeholder="0"
                              value={entry.home}
                              onChangeText={(v) => setScore('home', v)}
                              keyboardType="number-pad"
                              maxLength={3}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <GlassInput
                              label={playerName(m.away?.firstName, m.away?.lastName)}
                              placeholder="0"
                              value={entry.away}
                              onChangeText={(v) => setScore('away', v)}
                              keyboardType="number-pad"
                              maxLength={3}
                            />
                          </View>
                        </View>
                      )}

                      <View style={styles.btnRow}>
                        {m.status === 'scheduled' ? (
                          <View style={{ flex: 1 }}>
                            <GlassButton
                              title="Save result"
                              variant="primary"
                              loading={busy === `save-${m.id}`}
                              onPress={() => saveResult(m)}
                            />
                          </View>
                        ) : null}
                        <View style={{ flex: 1 }}>
                          <GlassButton
                            title="Remove"
                            variant="danger"
                            loading={busy === `remove-${m.id}`}
                            onPress={() => removeMatch(m)}
                          />
                        </View>
                      </View>
                    </GlassCard>
                  );
                })
              )}

              {finished && scheduled.length > 0 ? (
                <Text style={[type.caption, { textAlign: 'center' }]}>
                  {scheduled.length} match{scheduled.length === 1 ? '' : 'es'} still without a result.
                </Text>
              ) : null}

              <GlassButton
                title="Back to tournament"
                variant="secondary"
                onPress={() => router.replace(`/tournament/${id}`)}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
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
  okBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(212,243,74,0.12)',
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  matchHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  finalLine: { color: palette.white, fontSize: 15, fontWeight: '600', marginTop: 8 },
  finalScore: { color: palette.lime, fontWeight: '700' },
  scoreRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
