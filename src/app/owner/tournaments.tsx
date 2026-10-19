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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GlassBackground } from '../../components/glass/GlassBackground';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassInput } from '../../components/glass/GlassInput';
import { ErrorBanner, SuccessBanner } from '../../components/glass/Banner';
import { SectionHeader } from '../../components/glass/SectionHeader';
import { DbError, createAnnouncement, fetchAnnouncements, fetchTournaments } from '../../lib/db';
import type { FieldErrors } from '../../lib/api';
import { formatDate, formatTime, timeAgo, VENUE } from '../../lib/format';
import type { Announcement, Tournament } from '../../lib/types';
import { glass, palette, type } from '../../theme/glass';

const ANN_MAX = 300;

/**
 * Owner POV — every event on the board, plus the quick announcement
 * composer. New events are made in the guided flow at /tournament/create.
 */
export default function OwnerTournamentsScreen() {
  const router = useRouter();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /* ---------- Announcement composer ---------- */
  const [composer, setComposer] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const postAnnouncement = async () => {
    setErrors({});
    setFormError(null);
    if (!title.trim()) {
      setErrors({ title: 'Give your announcement a title.' });
      setFormError('Almost there — check the highlighted fields.');
      return;
    }
    if (body.trim().length > ANN_MAX) {
      setErrors({ body: `Keep it under ${ANN_MAX} characters.` });
      setFormError('Almost there — check the highlighted fields.');
      return;
    }
    setSaving(true);
    try {
      await createAnnouncement(title, body);
      setComposer(false);
      setTitle('');
      setBody('');
      setSuccess('Announcement posted — every player sees it under Tournaments.');
      await load();
    } catch (e) {
      setFormError(e instanceof DbError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={palette.lime}
            />
          }
        >
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <Text style={type.h1}>Events</Text>
              <Text style={[type.caption, { marginTop: 4 }]}>
                {tournaments.length} tournament{tournaments.length === 1 ? '' : 's'} hosted
              </Text>
            </View>
            <Pressable style={styles.addButton} onPress={() => router.push('/tournament/create')}>
              <Ionicons name="add" size={20} color={palette.ink} />
              <Text style={styles.addText}>New</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.action} onPress={() => router.push('/tournament/create')}>
              <Ionicons name="trophy" size={19} color={palette.ink} />
              <Text style={styles.actionText}>Create tournament</Text>
            </Pressable>
            <Pressable style={[styles.action, styles.actionGhost]} onPress={() => setComposer(true)}>
              <Ionicons name="megaphone" size={19} color={palette.lime} />
              <Text style={[styles.actionText, { color: palette.lime }]}>Post announcement</Text>
            </Pressable>
          </View>

          <ErrorBanner message={error} />
          <SuccessBanner message={success} />

          {/* ---------- Announcements ---------- */}
          {announcements.length > 0 ? (
            <View style={{ gap: 12 }}>
              <SectionHeader title="Recent announcements" />
              {announcements.slice(0, 4).map((a) => (
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

          {/* ---------- Tournaments ---------- */}
          <SectionHeader title="Tournaments" />
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
                Create your first event — it lands on every player&apos;s Tournaments tab.
              </Text>
            </GlassCard>
          ) : (
            tournaments.map((t) => {
              const joined = t.joinedCount ?? t.participants.length;
              return (
                <GlassCard key={t.id}>
                  <View style={styles.tHead}>
                    <View style={styles.divisionChip}>
                      <Text style={styles.divisionText}>{t.division}</Text>
                    </View>
                    <View style={styles.announcedRow}>
                      <Ionicons
                        name={t.announced ? 'notifications' : 'notifications-off-outline'}
                        size={13}
                        color={t.announced ? palette.lime : palette.faint}
                      />
                      <Text style={[styles.time, t.announced && { color: palette.lime }]}>
                        {t.announced ? 'announced' : 'not announced'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[type.h2, { marginTop: 10 }]}>{t.name}</Text>
                  <Text style={[type.caption, { marginTop: 4 }]}>
                    {formatDate(t.date)} · {formatTime(t.time)}
                  </Text>
                  <Text style={[type.caption, { marginTop: 2 }]}>{t.format} · {t.venue || VENUE}</Text>

                  <View style={styles.metaRow}>
                    <Meta icon="people" label={`${joined}/${t.slots} joined`} />
                    <Meta icon="pricetag" label={t.fee > 0 ? `₱${t.fee}` : 'Free'} />
                    <Meta
                      icon="pulse"
                      label={
                        t.status === 'finished'
                          ? 'results live'
                          : t.status === 'ongoing'
                          ? 'live now'
                          : 'open for entry'
                      }
                    />
                  </View>

                  {t.prize ? (
                    <View style={styles.prizeRow}>
                      <Ionicons name="ribbon" size={14} color={palette.lime} />
                      <Text style={styles.prizeText}>{t.prize}</Text>
                    </View>
                  ) : null}

                  <View style={styles.cardActions}>
                    <View style={{ flex: 1 }}>
                      <GlassButton
                        title={t.status === 'finished' ? 'Results' : 'Record results'}
                        variant={t.status === 'finished' ? 'secondary' : 'primary'}
                        onPress={() => router.push(`/tournament/manage?id=${t.id}`)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <GlassButton
                        title="View"
                        variant="secondary"
                        onPress={() => router.push(`/tournament/${t.id}`)}
                      />
                    </View>
                  </View>
                </GlassCard>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ---------- Announcement composer ---------- */}
      <Modal visible={composer} transparent animationType="slide" onRequestClose={() => setComposer(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <Pressable style={styles.backdrop} onPress={() => setComposer(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.sheetTint} />
              <ScrollView contentContainerStyle={styles.sheetInner} keyboardShouldPersistTaps="handled">
                <View style={styles.grabber} />
                <Text style={type.h2}>Post announcement</Text>
                <Text style={[type.caption, { marginBottom: 14 }]}>
                  Shows up at the top of every player&apos;s Tournaments tab.
                </Text>

                <ErrorBanner message={formError} />

                <View style={{ gap: 14 }}>
                  <GlassInput
                    label="Title"
                    placeholder="e.g. Saturday ladder night"
                    value={title}
                    onChangeText={(v) => {
                      setTitle(v);
                      setErrors((p) => ({ ...p, title: '' }));
                    }}
                    error={errors.title}
                    maxLength={80}
                  />
                  <GlassInput
                    label="Message"
                    placeholder="What should players know?"
                    value={body}
                    onChangeText={(v) => {
                      setBody(v);
                      setErrors((p) => ({ ...p, body: '' }));
                    }}
                    error={errors.body}
                    multiline
                    maxLength={ANN_MAX}
                    counter={{ length: body.length, max: ANN_MAX }}
                  />
                </View>

                <View style={styles.sheetActions}>
                  <GlassButton
                    title="Cancel"
                    variant="secondary"
                    onPress={() => setComposer(false)}
                    style={{ flex: 1 }}
                  />
                  <GlassButton
                    title="Post"
                    onPress={postAnnouncement}
                    loading={saving}
                    style={{ flex: 1.4 }}
                  />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
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
  actionGhost: {
    backgroundColor: 'rgba(212,243,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,243,74,0.55)',
  },
  actionText: { fontSize: 13.5, fontWeight: '700', color: palette.ink },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  annCard: { padding: 16 },
  annHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { fontSize: 11.5, color: palette.faint },
  tHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divisionChip: {
    backgroundColor: 'rgba(212,243,74,0.2)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  divisionText: { fontSize: 11, fontWeight: '700', color: palette.lime, textTransform: 'uppercase' },
  announcedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
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
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(4,26,18,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.border,
  },
  sheetTint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(11,61,42,0.94)',
  },
  sheetInner: { padding: 20, paddingBottom: 30 },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginBottom: 14,
  },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
});
