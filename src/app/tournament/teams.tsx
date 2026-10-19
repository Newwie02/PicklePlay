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
  adminConfirmTeamResult,
  adminDisputeTeamResult,
  adminEnterTeamResult,
  adminGenerateBracket,
  adminRegisterTeam,
  adminRemoveTeam,
  fetchProfilesByIds,
  fetchTournament,
  fetchTournamentTeams,
  fetchTeamMatches,
} from '../../lib/db';
import { formatLabel, playerName } from '../../lib/format';
import type { TeamMatch, Tournament, TournamentTeam, User } from '../../lib/types';import { ErrorBanner } from '../../components/glass/Banner';
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

const EMPTY_SCORE = { t1: '', t2: '' };

/**
 * The owner's side of a doubles tournament: enter the teams, generate the
 * seeded bracket, then enter results — which stay pending until confirmed.
 * Confirming is what advances a winner, so a disputed score never moves
 * anyone forward.
 */
export default function ManageTeams() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [players, setPlayers] = useState<User[]>([]);

  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [scores, setScores] = useState<Record<string, typeof EMPTY_SCORE>>({});

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
      setTeams(await fetchTournamentTeams(id));
      setMatches(await fetchTeamMatches(id));
    } catch (e) {
      setError(e instanceof DbError ? e.message : 'Could not load this tournament.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const run = useCallback(
    async (key: string, action: () => Promise<void>) => {
      setBusy(key);
      setError(null);
      setSuccess(null);
      try {
        await action();
        await load();
      } catch (e) {
        setError(e instanceof DbError ? e.message : 'Something went wrong. Please try again.');
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Every hook above this line — the owner guard goes after them.
  if (user?.role !== 'owner') return <Redirect href="/login" />;

  const byId = (pick: string) => players.find((u) => pickLabel(u) === pick)?.id ?? '';
  const options = players.map(pickLabel);
  const bracketBuilt = matches.length > 0;
  const open = tournament?.status === 'open';

  const addTeam = () =>
    run('add-team', async () => {
      const a = byId(p1);
      const b = byId(p2);
      if (!a || !b) throw new DbError('Pick both players for this team.');
      if (a === b) throw new DbError('A team needs two different players.');
      await adminRegisterTeam(id, a, b);
      setP1('');
      setP2('');
      setSuccess('Team registered.');
    });

  const removeTeam = (t: TournamentTeam) => {
    const label = [t.player1, t.player2]
      .map((p) => playerName(p?.firstName, p?.lastName))
      .join(' & ');
    Alert.alert('Remove this team?', label, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          run(`remove-${t.id}`, async () => {
            await adminRemoveTeam(t.id);
            setSuccess('Team removed.');
          }),
      },
    ]);
  };

  const buildBracket = () => {
    Alert.alert(
      'Generate the bracket?',
      'Seeds are paired by position and any team without an opponent gets a walkover. You can regenerate while the tournament is still open.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: () =>
            run('bracket', async () => {
              await adminGenerateBracket(id);
              setSuccess('Bracket generated.');
            }),
        },
      ]
    );
  };

  const saveResult = (m: TeamMatch) =>
    run(`save-${m.id}`, async () => {
      const entry = scores[m.id] ?? EMPTY_SCORE;
      const a = Number(entry.t1);
      const b = Number(entry.t2);
      if (!entry.t1.trim() || !entry.t2.trim() || Number.isNaN(a) || Number.isNaN(b)) {
        throw new DbError('Enter both scores.');
      }
      if (a < 0 || b < 0) throw new DbError('Scores cannot be negative.');
      if (a === b) throw new DbError('A match cannot end level — play on until someone wins.');
      await adminEnterTeamResult(m.id, Math.trunc(a), Math.trunc(b));
      setSuccess('Result recorded — it is pending until you confirm it.');
    });

  const confirmResult = (m: TeamMatch) =>
    run(`confirm-${m.id}`, async () => {
      await adminConfirmTeamResult(m.id);
      setSuccess('Result confirmed — the winner has advanced.');
    });

  const disputeResult = (m: TeamMatch) => {
    Alert.alert(
      'Dispute this result?',
      'The score is flagged as disputed and anyone already placed in the next round is pulled back out.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dispute',
          style: 'destructive',
          onPress: () =>
            run(`dispute-${m.id}`, async () => {
              await adminDisputeTeamResult(m.id, 'Result disputed by the court owner.');
              setSuccess('Result disputed.');
            }),
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
              <Ionicons name="chevron-back" size={20} color={palette.white} />
            </Pressable>
            <Text style={type.h1}>Teams & Bracket</Text>
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
                <Text style={type.eyebrow}>{formatLabel(tournament.format)}</Text>
                <Text style={[type.h2, { marginTop: 4 }]}>{tournament.name}</Text>
                <Text style={[type.caption, { marginTop: 4 }]}>
                  {teams.length} team{teams.length === 1 ? '' : 's'} · status{' '}
                  <Text style={{ color: palette.lime }}>{tournament.status}</Text>
                </Text>
              </GlassCard>

              {/* ---- Register teams --------------------------------- */}
              <SectionHeader title="Register a team" />
              <GlassCard>
                {!open ? (
                  <Text style={type.caption}>
                    Registration is closed because this tournament has{' '}
                    {tournament.status === 'finished' ? 'finished' : 'started'}.
                  </Text>
                ) : players.length < 2 ? (
                  <Text style={type.caption}>
                    At least two players need to join this tournament first.
                  </Text>
                ) : bracketBuilt ? (
                  <Text style={type.caption}>
                    The bracket is already built. Regenerate it from the button below to pick up
                    new teams.
                  </Text>
                ) : (
                  <>
                    <GlassSelect
                      label="Player 1"
                      placeholder="Pick a player"
                      value={p1}
                      options={options}
                      onSelect={setP1}
                      searchable
                    />
                    <GlassSelect
                      label="Player 2"
                      placeholder="Pick a partner"
                      value={p2}
                      options={options}
                      onSelect={setP2}
                      searchable
                    />
                    <GlassButton
                      title="Register team"
                      variant="secondary"
                      loading={busy === 'add-team'}
                      onPress={addTeam}
                    />
                  </>
                )}
              </GlassCard>

              {teams.length > 0 ? (
                <>
                  <SectionHeader title={`Teams (${teams.length})`} />
                  <GlassCard style={{ padding: 0 }}>
                    {teams.map((t, i) => (
                      <View
                        key={t.id}
                        style={[styles.teamRow, i === teams.length - 1 && styles.rowLast]}
                      >
                        <View style={styles.seedBadge}>
                          <Text style={styles.seedText}>{t.seed ?? '—'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.teamName} numberOfLines={1}>
                            {[t.player1, t.player2]
                              .map((p) => playerName(p?.firstName, p?.lastName))
                              .join(' & ')}
                          </Text>
                        </View>
                        {open && !bracketBuilt ? (
                          <Pressable onPress={() => removeTeam(t)} hitSlop={8}>
                            <Ionicons name="trash-outline" size={17} color={palette.danger} />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </GlassCard>
                </>
              ) : null}

              {/* ---- Build the bracket ------------------------------ */}
              {open ? (
                <GlassButton
                  title={bracketBuilt ? 'Regenerate bracket' : 'Generate bracket'}
                  loading={busy === 'bracket'}
                  onPress={buildBracket}
                />
              ) : null}

              {/* ---- Enter and confirm results ---------------------- */}
              {bracketBuilt ? (
                <>
                  <SectionHeader title="Results" />
                  {matches.map((m) => {
                    const entry = scores[m.id] ?? EMPTY_SCORE;
                    const setScore = (side: 't1' | 't2', value: string) =>
                      setScores((prev) => ({
                        ...prev,
                        [m.id]: { ...(prev[m.id] ?? EMPTY_SCORE), [side]: value },
                      }));

                    const t1Name = m.team1
                      ? [m.team1.player1, m.team1.player2]
                          .map((p) => playerName(p?.firstName, p?.lastName))
                          .join(' & ')
                      : 'TBD';
                    const t2Name = m.team2
                      ? [m.team2.player1, m.team2.player2]
                          .map((p) => playerName(p?.firstName, p?.lastName))
                          .join(' & ')
                      : 'TBD';

                    return (
                      <GlassCard key={m.id}>
                        <View style={styles.matchHead}>
                          <Text style={type.eyebrow}>
                            {m.roundLabel} #{m.matchNo}
                          </Text>
                          <StatusChip status={m.resultStatus} />
                        </View>

                        <Text style={styles.matchTeam} numberOfLines={1}>
                          {t1Name}
                        </Text>
                        <Text style={styles.matchTeam} numberOfLines={1}>
                          {t2Name}
                        </Text>

                        {m.resultStatus === 'pending' && m.team1Score != null ? (
                          <Text style={styles.entered}>
                            Entered: {m.team1Score}–{m.team2Score} — waiting to be confirmed
                          </Text>
                        ) : null}

                        {m.team1 && m.team2 && m.resultStatus !== 'confirmed' ? (
                          <View style={styles.scoreRow}>
                            <View style={{ flex: 1 }}>
                              <GlassInput
                                label="Team 1"
                                placeholder="0"
                                value={entry.t1}
                                onChangeText={(v) => setScore('t1', v.replace(/[^0-9]/g, '').slice(0, 3))}
                                keyboardType="number-pad"
                                maxLength={3}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <GlassInput
                                label="Team 2"
                                placeholder="0"
                                value={entry.t2}
                                onChangeText={(v) => setScore('t2', v.replace(/[^0-9]/g, '').slice(0, 3))}
                                keyboardType="number-pad"
                                maxLength={3}
                              />
                            </View>
                          </View>
                        ) : null}

                        <View style={styles.actionRow}>
                          {m.team1 && m.team2 && m.resultStatus !== 'confirmed' ? (
                            <View style={{ flex: 1 }}>
                              <GlassButton
                                title="Save score"
                                variant="secondary"
                                loading={busy === `save-${m.id}`}
                                onPress={() => saveResult(m)}
                              />
                            </View>
                          ) : null}

                          {m.resultStatus === 'pending' && m.team1Score != null ? (
                            <View style={{ flex: 1 }}>
                              <GlassButton
                                title="Confirm"
                                loading={busy === `confirm-${m.id}`}
                                onPress={() => confirmResult(m)}
                              />
                            </View>
                          ) : null}

                          {m.resultStatus !== 'disputed' && m.team1Score != null ? (
                            <View style={{ flex: 1 }}>
                              <GlassButton
                                title="Dispute"
                                variant="danger"
                                loading={busy === `dispute-${m.id}`}
                                onPress={() => disputeResult(m)}
                              />
                            </View>
                          ) : null}
                        </View>
                      </GlassCard>
                    );
                  })}
                </>
              ) : null}

              <GlassButton
                title="View bracket"
                variant="secondary"
                onPress={() => router.push(`/tournament/bracket?id=${id}`)}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function StatusChip({ status }: { status: TeamMatch['resultStatus'] }) {
  const map = {
    pending: { label: 'pending', color: palette.warn },
    confirmed: { label: 'confirmed', color: palette.lime },
    disputed: { label: 'disputed', color: palette.danger },
  } as const;
  const s = map[status];
  return (
    <View style={[styles.chip, { borderColor: s.color }]}>
      <Text style={[styles.chipText, { color: s.color }]}>{s.label}</Text>
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
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  rowLast: { borderBottomWidth: 0 },
  seedBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,243,74,0.16)',
  },
  seedText: { color: palette.lime, fontSize: 12.5, fontWeight: '800' },
  teamName: { color: palette.white, fontSize: 14.5, fontWeight: '600' },
  matchHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  matchTeam: { color: palette.white, fontSize: 14, fontWeight: '600', marginTop: 6 },
  entered: { color: palette.warn, fontSize: 12, marginTop: 6 },
  scoreRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});
