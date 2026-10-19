import { useCallback, useState } from 'react';
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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GlassBackground } from '../../components/glass/GlassBackground';
import { GlassCard } from '../../components/glass/GlassCard';
import { Avatar } from '../../components/glass/Avatar';
import { ErrorBanner, SuccessBanner } from '../../components/glass/Banner';
import { GlassInput } from '../../components/glass/GlassInput';
import { GlassButton } from '../../components/glass/GlassButton';
import { adminFetchLedger, adminFetchPointTotals, adminFetchUsers, awardPoints } from '../../lib/db';
import type { PointEntry, User } from '../../lib/types';
import { glass, palette, type } from '../../theme/glass';

/**
 * Two RN Modals presented at the same moment are not reliably rendered —
 * iOS can silently refuse the second one — so the profile sheet and the
 * award sheet take turns, waiting out each other's fade.
 */
const SHEET_SWAP_MS = 260;

export default function OwnerUsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<User | null>(null);

  /* Ranking points, straight off the view the ladder reads — so awarding
     here and what players see in Ranking can never drift apart. */
  const [points, setPoints] = useState<Record<string, number>>({});
  const [ledger, setLedger] = useState<PointEntry[]>([]);
  const [awarding, setAwarding] = useState<User | null>(null);
  const [ptsValue, setPtsValue] = useState('');
  const [ptsReason, setPtsReason] = useState('');
  const [awardError, setAwardError] = useState<string | null>(null);
  const [awardSuccess, setAwardSuccess] = useState<string | null>(null);
  const [savingAward, setSavingAward] = useState(false);

  const load = useCallback(async (q = query) => {
    try {
      const [res, totals, entries] = await Promise.all([
        adminFetchUsers(q),
        adminFetchPointTotals(),
        adminFetchLedger(),
      ]);
      setUsers(res.users);
      setTotal(res.total);
      setPoints(totals);
      setLedger(entries);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load players.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      load('');
    }, [load])
  );

  const search = (q: string) => {
    setQuery(q);
    load(q);
  };

  /** Clears both sheets and brings the next one up after the fade. */
  const swapSheet = (next: () => void) => {
    setSelected(null);
    setAwarding(null);
    setTimeout(next, SHEET_SWAP_MS);
  };

  /**
   * Opens the award form. The profile sheet has to be fully gone before
   * this one appears, otherwise iOS can refuse to present it at all — which
   * is exactly how "Award" used to do nothing.
   */
  const openAward = (u: User) => {
    setPtsValue('');
    setPtsReason('');
    setAwardError(null);
    setAwardSuccess(null);
    swapSheet(() => setAwarding(u));
  };

  /** Closes the form and puts the profile sheet back — now holding the
      freshly re-read totals, so the new number is visible at once. */
  const closeAward = () => {
    const u = awarding;
    setAwardError(null);
    if (!u) return;
    swapSheet(() => setSelected(u));
  };

  /** Backdrop tap / Android back: leave the sheet entirely. */
  const dismissSheet = () => {
    swapSheet(() => {});
  };

  /** This player's recent hand-outs, newest first. */
  const selectedEntries = selected
    ? ledger.filter((e) => e.userId === selected.id).slice(0, 5)
    : [];

  /**
   * Writes one row to the ledger. The rankings view sums that ledger, so
   * the player's place on the ladder moves as soon as this resolves —
   * nothing has to be written back onto the profile itself.
   */
  const submitAward = async () => {
    if (!awarding) return;
    const raw = ptsValue.trim();
    const n = Number(raw);
    if (!raw || !Number.isInteger(n)) {
      setAwardError('Enter a whole number of points.');
      return;
    }
    if (n === 0) {
      setAwardError('Points cannot be zero.');
      return;
    }
    if (Math.abs(n) > 5000) {
      setAwardError('Keep it under 5,000 points at a time.');
      return;
    }

    setAwardError(null);
    setAwardSuccess(null);
    setSavingAward(true);
    const who = `${awarding.firstName} ${awarding.lastName}`.trim() || 'that player';
    try {
      const returned = await awardPoints(awarding.id, n, ptsReason.trim());

      // Read the totals back instead of trusting the number the RPC handed
      // over — this is the same rankings view the Ranking tab sums, so the
      // admin screen and the player's ladder can never show two answers.
      let now = Number(returned ?? 0);
      try {
        const fresh = await adminFetchPointTotals();
        setPoints(fresh);
        if (typeof fresh[awarding.id] === 'number') now = fresh[awarding.id];
        setLedger(await adminFetchLedger());
      } catch {
        setPoints((p) => ({ ...p, [awarding.id]: now }));
      }

      // The confirmation stays inside the sheet — the banner behind the
      // modal was never visible while this form was open.
      setAwardSuccess(
        `${n > 0 ? '+' : ''}${n} points for ${who} — now on ${now}. The Ranking tab moves too.`
      );
      setPtsValue('');
      setPtsReason('');
    } catch (e) {
      setAwardError(e instanceof Error ? e.message : 'Could not award points.');
    } finally {
      setSavingAward(false);
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
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <Text style={type.h1}>Users</Text>
              <Text style={[type.caption, { marginTop: 4 }]}>
                {total} player{total === 1 ? '' : 's'} signed up
              </Text>
            </View>
            <View style={styles.totalBadge}>
              <Text style={styles.totalNum}>{total}</Text>
              <Text style={styles.totalLabel}>TOTAL</Text>
            </View>
          </View>

          {/* ---------- Search ---------- */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={17} color={palette.faint} />
            <TextInput
              value={query}
              onChangeText={search}
              placeholder="Search name, Gmail or barangay…"
              placeholderTextColor="rgba(255,255,255,0.55)"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query ? (
              <Pressable onPress={() => search('')} hitSlop={8}>
                <Ionicons name="close-circle" size={17} color={palette.faint} />
              </Pressable>
            ) : null}
          </View>

          <ErrorBanner message={error} />
          <SuccessBanner message={awardSuccess} />

          {loading && users.length === 0 ? (
            <View style={styles.loading}>
              <ActivityIndicator color={palette.lime} size="large" />
              <Text style={type.caption}>Loading players…</Text>
            </View>
          ) : users.length === 0 ? (
            <GlassCard style={{ alignItems: 'center', gap: 8, paddingVertical: 28 }}>
              <Ionicons name="people-outline" size={30} color={palette.faint} />
              <Text style={type.h3}>No players found</Text>
              <Text style={[type.caption, { textAlign: 'center' }]}>
                {query ? 'Try a different name, Gmail or barangay.' : 'Your first player will show up here.'}
              </Text>
            </GlassCard>
          ) : (
            <GlassCard style={{ padding: 0 }}>
              {users.map((u) => (
                <Pressable key={u.id} style={styles.userRow} onPress={() => setSelected(u)}>
                  <Avatar avatar={u.avatar} firstName={u.firstName} lastName={u.lastName} size={42} />
                  <View style={{ flex: 1 }}>
                    <Text style={type.h3} numberOfLines={1}>
                      {u.firstName} {u.lastName}
                    </Text>
                    <Text style={type.caption} numberOfLines={1}>
                      {u.email}
                    </Text>
                    <View style={styles.tagRow}>
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{u.location || 'Tagum'}</Text>
                      </View>
                      {u.emailVerified ? (
                        <View style={[styles.tag, styles.verifiedTag]}>
                          <Ionicons name="checkmark-circle" size={10} color={palette.ink} />
                          <Text style={[styles.tagText, { color: palette.ink }]}>verified</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.pointsBadge}>
                    <Text style={styles.pointsNum}>{points[u.id] ?? 0}</Text>
                    <Text style={styles.pointsLabel}>PTS</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={palette.faint} />
                </Pressable>
              ))}
            </GlassCard>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ---------- Detail sheet ---------- */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.sheetTint} />
            <View style={styles.sheetInner}>
              <View style={styles.grabber} />
              {selected ? (
                <>
                  <View style={styles.sheetHead}>
                    <Avatar
                      avatar={selected.avatar}
                      firstName={selected.firstName}
                      lastName={selected.lastName}
                      size={62}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[type.h2, { fontSize: 19 }]}>
                        {selected.firstName} {selected.lastName}
                      </Text>
                      <Text style={type.caption}>{selected.email}</Text>
                    </View>
                  </View>

                  {selected.bio ? <Text style={styles.bio}>“{selected.bio}”</Text> : null}

                  <Detail icon="location" label="Barangay" value={selected.location || '—'} />
                  <Detail icon="call" label="Phone" value={selected.phone || '—'} />
                  <Detail icon="calendar" label="Birthday" value={selected.birthday || '—'} />
                  <Detail icon="person" label="Gender" value={selected.gender || '—'} />
                  <Detail
                    icon="checkmark-circle"
                    label="Gmail verified"
                    value={selected.emailVerified ? 'Yes' : 'Not yet'}
                  />
                  <Detail
                    icon="time"
                    label="Joined"
                    value={new Date(selected.createdAt).toLocaleDateString()}
                  />

                  {/* The number the Ranking screen shows this player. */}
                  <View style={styles.pointsCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pointsCardNum}>{points[selected.id] ?? 0}</Text>
                      <Text style={styles.pointsCardLabel}>RANKING POINTS</Text>
                    </View>
                    <Pressable style={styles.awardBtn} onPress={() => openAward(selected)}>
                      <Ionicons name="add" size={15} color={palette.ink} />
                      <Text style={styles.awardText}>Award</Text>
                    </Pressable>
                  </View>

                  {selectedEntries.length ? (
                    <View style={styles.ledgerBox}>
                      <Text style={styles.ledgerTitle}>RECENT POINTS</Text>
                      {selectedEntries.map((e) => (
                        <View key={e.id} style={styles.ledgerRow}>
                          <Text
                            style={[
                              styles.ledgerDelta,
                              { color: e.delta >= 0 ? palette.lime : palette.danger },
                            ]}
                          >
                            {e.delta >= 0 ? '+' : ''}
                            {e.delta}
                          </Text>
                          <Text style={styles.ledgerReason} numberOfLines={1}>
                            {e.reason || 'No reason given'}
                          </Text>
                          <Text style={styles.ledgerDate}>
                            {new Date(e.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
                    <Text style={styles.closeText}>Close</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ---------- Award points to a player ---------- */}
      <Modal
        visible={!!awarding}
        transparent
        animationType="fade"
        onRequestClose={dismissSheet}
      >
        {/* `padding` lifts the sheet clear of the keyboard so the Award
            button is never buried underneath it, and the ScrollView keeps
            the form reachable on short screens. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <Pressable style={styles.backdrop} onPress={dismissSheet}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.sheetTint} />
              <ScrollView
                contentContainerStyle={styles.sheetInner}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.grabber} />
                {awarding ? (
                  <>
                    <View style={styles.sheetHead}>
                      <Avatar
                        avatar={awarding.avatar}
                        firstName={awarding.firstName}
                        lastName={awarding.lastName}
                        size={54}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[type.h2, { fontSize: 18 }]}>
                          {awarding.firstName} {awarding.lastName}
                        </Text>
                        <Text style={type.caption}>Currently {points[awarding.id] ?? 0} points</Text>
                      </View>
                    </View>

                    <View style={{ gap: 14, marginTop: 6 }}>
                      <GlassInput
                        label="Points"
                        placeholder="e.g. 50, or 20 to deduct"
                        value={ptsValue}
                        onChangeText={(v) => {
                          const negative = v.trimStart().startsWith('-');
                          const digits = v.replace(/[^0-9]/g, '').slice(0, 5);
                          setPtsValue(negative ? `-${digits}` : digits);
                          setAwardError(null);
                        }}
                        keyboardType="number-pad"
                        maxLength={6}
                        hint="Whole numbers only · up to 5,000 at a time"
                      />
                      <GlassInput
                        label="Reason (optional)"
                        placeholder="e.g. October ladder MVP"
                        value={ptsReason}
                        onChangeText={setPtsReason}
                        maxLength={80}
                      />
                    </View>

                    <ErrorBanner message={awardError} />
                    <SuccessBanner message={awardSuccess} />

                    <View style={styles.awardActions}>
                      <GlassButton
                        title={awardSuccess ? 'Close' : 'Cancel'}
                        variant="secondary"
                        onPress={closeAward}
                        style={{ flex: 1 }}
                        disabled={savingAward}
                      />
                      <GlassButton
                        title="Award points"
                        onPress={submitAward}
                        loading={savingAward}
                        style={{ flex: 1.4 }}
                      />
                    </View>
                  </>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Detail({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={14} color={palette.mint} />
      </View>
      <Text style={type.caption}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgTop },
  container: { padding: 20, gap: 14, paddingBottom: 130 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  totalBadge: {
    backgroundColor: palette.lime,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  totalNum: { fontSize: 20, fontWeight: '800', color: palette.ink },
  totalLabel: { fontSize: 9, fontWeight: '800', color: palette.ink, letterSpacing: 0.6 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: glass.border,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: { flex: 1, color: palette.white, fontSize: 14.5 },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 5 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifiedTag: { backgroundColor: palette.mint },
  tagText: { fontSize: 10, fontWeight: '700', color: palette.white },
  pointsBadge: {
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(212,243,74,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212,243,74,0.45)',
    minWidth: 46,
  },
  pointsNum: { fontSize: 13.5, fontWeight: '800', color: palette.lime },
  pointsLabel: { fontSize: 8, fontWeight: '800', color: palette.lime, letterSpacing: 0.6 },
  pointsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(212,243,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,243,74,0.4)',
  },
  pointsCardNum: { fontSize: 26, fontWeight: '800', color: palette.lime },
  pointsCardLabel: { fontSize: 9.5, fontWeight: '800', color: palette.lime, letterSpacing: 0.8 },
  awardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.lime,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
  },
  awardText: { fontSize: 13.5, fontWeight: '800', color: palette.ink },
  awardActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  ledgerBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: glass.border,
  },
  ledgerTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: palette.faint,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  ledgerDelta: { fontSize: 13, fontWeight: '800', width: 44 },
  ledgerReason: { flex: 1, fontSize: 12.5, color: palette.muted },
  ledgerDate: { fontSize: 11, color: palette.faint },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(4,26,18,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.border,
  },
  sheetTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,61,42,0.92)' },
  sheetInner: { padding: 20, paddingBottom: 30, gap: 6 },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginBottom: 14,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  bio: { fontSize: 13.5, fontStyle: 'italic', color: palette.muted, marginBottom: 8, lineHeight: 19 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 13.5, color: palette.white, fontWeight: '600' },
  closeBtn: {
    marginTop: 16,
    height: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: glass.border,
  },
  closeText: { color: palette.white, fontSize: 15, fontWeight: '700' },
});
