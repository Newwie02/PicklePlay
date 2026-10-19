import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import {
  DbError,
  fetchTournament,
  fetchTeamMatches,
  toBracket,
} from '../../lib/db';
import { playerName } from '../../lib/format';
import type { TeamMatch, Tournament, TournamentPlayer } from '../../lib/types';
import { ErrorBanner } from '../../components/glass/Banner';
import { GlassBackground } from '../../components/glass/GlassBackground';
import { GlassCard } from '../../components/glass/GlassCard';
import { SectionHeader } from '../../components/glass/SectionHeader';
import { palette, type } from '../../theme/glass';

/**
 * The bracket, as a player sees it: rounds left to right, each match
 * showing both teams and the score once one exists. Nothing here can
 * write — the owner enters and confirms results, this screen only reads.
 */
export default function BracketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TeamMatch[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const t = await fetchTournament(id);
      setTournament(t);
      if (!t) {
        setError('That tournament could not be found.');
        return;
      }
      setMatches(await fetchTeamMatches(id));
    } catch (e) {
      setError(e instanceof DbError ? e.message : 'Could not load the bracket.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const rounds = useMemo(() => toBracket(matches), [matches]);

  /** Only the fixtures involving me — that is the "match schedule". */
  const mine = useMemo(() => {
    if (!user) return [];
    return matches.filter(
      (m) =>
        m.team1?.player1?.id === user.id ||
        m.team1?.player2?.id === user.id ||
        m.team2?.player1?.id === user.id ||
        m.team2?.player2?.id === user.id
    );
  }, [matches, user]);

  const champion = useMemo(() => {
    const final = rounds[rounds.length - 1];
    return final?.matches[0]?.resultStatus === 'confirmed' ? final.matches[0].winner : null;
  }, [rounds]);

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.head}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
              <Ionicons name="chevron-back" size={20} color={palette.white} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={type.h1}>Bracket</Text>
              {tournament ? (
                <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={1}>
                  {tournament.name}
                </Text>
              ) : null}
            </View>
          </View>

          <ErrorBanner message={error} />

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={palette.lime} size="large" />
            </View>
          ) : rounds.length === 0 ? (
            <GlassCard style={{ alignItems: 'center', gap: 8, paddingVertical: 30 }}>
              <Ionicons name="git-branch-outline" size={30} color={palette.faint} />
              <Text style={type.h3}>No bracket yet</Text>
              <Text style={[type.caption, { textAlign: 'center' }]}>
                {user?.role === 'owner'
                  ? 'Register the teams, then generate the bracket from Teams & Bracket.'
                  : 'The court owner builds the bracket once every team is registered.'}
              </Text>
            </GlassCard>
          ) : (
            <>
              {champion ? (
                <GlassCard accent={palette.lime}>
                  <View style={styles.champRow}>
                    <Text style={styles.medal}>🏆</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={type.eyebrow}>Champions</Text>
                      <Text style={[type.h2, { marginTop: 2 }]}>
                        {[champion.player1, champion.player2]
                          .map((p) => playerName(p?.firstName, p?.lastName))
                          .join(' & ')}
                      </Text>
                      {champion.seed ? (
                        <Text style={[type.caption, { marginTop: 2 }]}>Seed {champion.seed}</Text>
                      ) : null}
                    </View>
                  </View>
                </GlassCard>
              ) : null}

              {/* ---- The bracket itself ---------------------------- */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bracketScroll}
              >
                {rounds.map((round) => (
                  <View key={round.label} style={styles.round}>
                    <Text style={styles.roundLabel}>{round.label.toUpperCase()}</Text>
                    {round.matches.map((m) => (
                      <BracketMatch key={m.id} m={m} />
                    ))}
                  </View>
                ))}
              </ScrollView>

              {/* ---- My own fixtures -------------------------------- */}
              {mine.length > 0 ? (
                <>
                  <SectionHeader title="My matches" />
                  <GlassCard style={{ gap: 10 }}>
                    {mine.map((m) => (
                      <View key={m.id} style={styles.mineRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mineRound}>
                            {m.roundLabel} #{m.matchNo}
                          </Text>
                          <Text style={type.caption}>
                            {m.team1?.seed ?? 'TBD'} vs {m.team2?.seed ?? 'TBD'}
                          </Text>
                        </View>
                        <Text style={styles.mineScore}>
                          {m.resultStatus === 'confirmed' || m.team1Score != null
                            ? `${m.team1Score ?? 0}–${m.team2Score ?? 0}`
                            : '—'}
                        </Text>
                      </View>
                    ))}
                  </GlassCard>
                </>
              ) : null}

              {user?.role === 'owner' ? (
                <Pressable style={styles.manageLink} onPress={() => router.push(`/tournament/teams?id=${id}`)}>
                  <Ionicons name="settings-outline" size={15} color={palette.lime} />
                  <Text style={styles.manageText}>Manage teams & results</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** One fixture in the bracket. A side with no team is a slot still open. */
function BracketMatch({ m }: { m: TeamMatch }) {
  const confirmed = m.resultStatus === 'confirmed';
  const disputed = m.resultStatus === 'disputed';

  return (
    <GlassCard style={styles.match}>
      <Side team={m.team1} score={m.team1Score} won={confirmed && m.winner?.id === m.team1?.id} />
      <View style={styles.divider} />
      <Side team={m.team2} score={m.team2Score} won={confirmed && m.winner?.id === m.team2?.id} />
      {disputed ? (
        <View style={styles.disputed}>
          <Ionicons name="alert-circle" size={12} color={palette.warn} />
          <Text style={styles.disputedText}>Disputed</Text>
        </View>
      ) : null}
    </GlassCard>
  );
}

function Side({
  team,
  score,
  won,
}: {
  team: { seed: number | null; player1: TournamentPlayer | null; player2: TournamentPlayer | null } | null;
  score: number | null;
  won: boolean;
}) {
  if (!team) {
    return (
      <View style={styles.side}>
        <Text style={styles.tbd}>TBD</Text>
      </View>
    );
  }
  const names = [team.player1, team.player2]
    .map((p) => playerName(p?.firstName, p?.lastName))
    .join(' & ');

  return (
    <View style={styles.side}>
      <Text numberOfLines={1} style={[styles.teamName, won && styles.teamNameWin]}>
        {names}
      </Text>
      {score != null ? (
        <Text style={[styles.score, won && styles.teamNameWin]}>{score}</Text>
      ) : null}
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
  champRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  medal: { fontSize: 30 },
  bracketScroll: { gap: 12, paddingRight: 8, alignItems: 'flex-start' },
  round: { width: 210, gap: 10 },
  roundLabel: {
    color: palette.faint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  match: { paddingVertical: 10, paddingHorizontal: 12, gap: 6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.16)' },
  side: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 26 },
  teamName: { flex: 1, color: palette.muted, fontSize: 13, fontWeight: '500' },
  teamNameWin: { color: palette.lime, fontWeight: '700' },
  tbd: { flex: 1, color: palette.faint, fontSize: 13, fontStyle: 'italic' },
  score: { color: palette.white, fontSize: 15, fontWeight: '800' },
  disputed: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  disputedText: { color: palette.warn, fontSize: 10.5, fontWeight: '700' },
  mineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mineRound: { color: palette.white, fontSize: 14, fontWeight: '600' },
  mineScore: { color: palette.lime, fontSize: 16, fontWeight: '800' },
  manageLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 4 },
  manageText: { color: palette.lime, fontSize: 13.5, fontWeight: '600' },
});
