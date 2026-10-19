import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassBackground } from '../../components/glass/GlassBackground';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassInput } from '../../components/glass/GlassInput';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassSelect } from '../../components/glass/GlassSelect';
import { ErrorBanner, SuccessBanner } from '../../components/glass/Banner';
import { GlassDatePicker } from '../../components/GlassDatePicker';
import { StepProgress } from '../../components/StepProgress';
import { DbError, createTournament } from '../../lib/db';
import type { FieldErrors } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { DOUBLES_PICK, formatDate, formatTime, toDbFormat, todayISO } from '../../lib/format';
import { SLOT_TIMES, VENUE_NAME } from '../../lib/options';
import type { Tournament } from '../../lib/types';
import { glass, palette, type } from '../../theme/glass';

const DIVISIONS = [
  "Men's Singles",
  "Women's Singles",
  "Men's Doubles",
  "Women's Doubles",
  'Mixed Doubles',
  'Open',
];

const FORMATS = [
  'Single Elimination',
  'Double Elimination',
  'Round Robin',
  'Double Round Robin',
  // Doubles: two-player teams with a generated bracket. Stored under a
  // distinct value so every existing singles tournament keeps its format.
  DOUBLES_PICK,
];

const NAME_MAX = 80;
const DESC_MAX = 500;

/**
 * Guided 3-step flow the court owner walks through to publish an event:
 * basics → logistics → the announcement players will actually read.
 */
export default function CreateTournamentScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [slotTimes] = useState<string[]>(SLOT_TIMES);

  /* Step 1 — basics */
  const [name, setName] = useState('');
  const [division, setDivision] = useState(DIVISIONS[0]);
  const [format, setFormat] = useState(FORMATS[0]);

  /* Step 2 — logistics */
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState('16');
  const [fee, setFee] = useState('0');

  /* Step 3 — the pitch */
  const [prize, setPrize] = useState('');
  const [description, setDescription] = useState('');
  const [announce, setAnnounce] = useState(true);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Tournament | null>(null);

  const clear = (key: string) => setErrors((p) => ({ ...p, [key]: '' }));

  const validateStep = useCallback(
    (which: 1 | 2 | 3) => {
      const next: Record<string, string | null> = {};

      if (which === 1) {
        const trimmed = name.trim();
        next.name = !trimmed
          ? 'Give your tournament a name.'
          : trimmed.length > NAME_MAX
          ? `Keep the name under ${NAME_MAX} characters.`
          : null;
      }

      if (which === 2) {
        next.date = !date
          ? 'Please pick the event date.'
          : date < todayISO()
          ? 'That date already passed — pick an upcoming day.'
          : null;
        next.time = slotTimes.length && !slotTimes.includes(time)
          ? 'Please pick a start time.'
          : null;
        const n = Number(slots);
        next.slots = !slots.trim() || Number.isNaN(n) || n < 2 || n > 128
          ? 'Slots must be between 2 and 128.'
          : null;
        const f = Number(fee);
        next.fee = fee.trim() === '' || Number.isNaN(f) || f < 0
          ? 'Entry fee must be a number (0 if free).'
          : null;
      }

      if (which === 3) {
        next.description = description.trim().length > DESC_MAX
          ? `Keep the description under ${DESC_MAX} characters.`
          : null;
      }

      const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as FieldErrors;
      setErrors((p) => ({ ...p, ...cleaned }));
      const ok = Object.keys(cleaned).length === 0;
      setFormError(ok ? null : 'Almost there — check the highlighted fields.');
      return ok;
    },
    [name, date, time, slots, fee, description, slotTimes]
  );

  const back = () => {
    setFormError(null);
    if (step === 1) router.back();
    else setStep((s) => (s - 1) as 1 | 2 | 3);
  };

  const next = () => {
    if (!validateStep(step)) return;
    setFormError(null);
    setStep((s) => (s + 1) as 1 | 2 | 3);
  };

  const publish = async () => {
    if (!user || !validateStep(3)) return;
    setBusy(true);
    setFormError(null);
    try {
      const created = await createTournament({
        name: name.trim(),
        date,
        time,
        division,
        format: toDbFormat(format),
        slots: Number(slots),
        fee: Number(fee),
        prize: prize.trim(),
        description: description.trim(),
        announce,
      });
      setDone(created);
      setSuccess(
        announce
          ? `${created.name} is live — players already see it under Tournaments.`
          : `${created.name} is saved. Turn on announcements later to shout it out.`
      );
    } catch (e) {
      setFormError(e instanceof DbError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  /* Guards the whole flow (hooks above must run unconditionally). */
  if (user?.role !== 'owner') return <Redirect href="/login" />;

  /* ---------- Done card ---------- */
  if (done) {
    return (
      <View style={styles.root}>
        <GlassBackground />
        <SafeAreaView style={styles.root} edges={['top']}>
          <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.container}>
              <View style={styles.doneIcon}>
                <Ionicons name="trophy" size={38} color={palette.ink} />
              </View>
              <Text style={[type.h1, { textAlign: 'center' }]}>Tournament created</Text>
              <SuccessBanner message={success} />

              <GlassCard strong>
                <View style={styles.tHead}>
                  <View style={styles.divisionChip}>
                    <Text style={styles.divisionText}>{done.division}</Text>
                  </View>
                  <Text style={styles.meta}>{formatDate(done.date)}</Text>
                </View>
                <Text style={[type.h2, { marginTop: 10 }]}>{done.name}</Text>
                <Text style={[type.caption, { marginTop: 4 }]}>
                  {formatTime(done.time)} · {done.format}
                </Text>
                <Text style={[type.caption, { marginTop: 2 }]}>0/{done.slots} joined · {done.fee > 0 ? `₱${done.fee}` : 'Free'}</Text>
                {done.prize ? (
                  <View style={styles.prizeRow}>
                    <Ionicons name="ribbon" size={14} color={palette.lime} />
                    <Text style={styles.prizeText}>{done.prize}</Text>
                  </View>
                ) : null}
              </GlassCard>

              <GlassButton title="Back to events" onPress={() => router.replace('/owner/tournaments')} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root} edges={['top']}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.head}>
              <Pressable onPress={back} hitSlop={10} style={styles.back}>
                <Ionicons name="chevron-back" size={20} color={palette.white} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={type.h1}>New tournament</Text>
              </View>
            </View>

            <StepProgress step={step} />

            <ErrorBanner message={formError} />

            {/* ---------- Step 1 — basics ---------- */}
            {step === 1 ? (
              <GlassCard>
                <View style={styles.form}>
                  <Text style={styles.sectionTitle}>The basics</Text>
                  <GlassInput
                    label="Tournament name"
                    placeholder="e.g. Spin & Smash Open 2026"
                    value={name}
                    onChangeText={(v) => {
                      setName(v);
                      clear('name');
                    }}
                    error={errors.name}
                    maxLength={NAME_MAX}
                    counter={{ length: name.length, max: NAME_MAX }}
                  />
                  <GlassSelect
                    label="Division"
                    placeholder="Pick a division"
                    value={division}
                    options={DIVISIONS}
                    onSelect={(v) => setDivision(v)}
                  />
                  <GlassSelect
                    label="Format"
                    placeholder="Pick a format"
                    value={format}
                    options={FORMATS}
                    onSelect={(v) => setFormat(v)}
                  />
                </View>
              </GlassCard>
            ) : null}

            {/* ---------- Step 2 — logistics ---------- */}
            {step === 2 ? (
              <GlassCard>
                <View style={styles.form}>
                  <Text style={styles.sectionTitle}>When and how big</Text>
                  <GlassDatePicker
                    label="Event date"
                    value={date}
                    onChange={(v) => {
                      setDate(v);
                      clear('date');
                    }}
                    error={errors.date}
                  />
                  <GlassSelect
                    label="Start time"
                    placeholder="Pick a start time"
                    value={time ? formatTime(time) : ''}
                    options={slotTimes.map(formatTime)}
                    onSelect={(label) => {
                      const idx = slotTimes.map(formatTime).indexOf(label);
                      if (idx >= 0) setTime(slotTimes[idx]);
                      clear('time');
                    }}
                    error={errors.time}
                  />
                  <GlassInput
                    label="Player slots"
                    placeholder="16"
                    keyboardType="number-pad"
                    value={slots}
                    onChangeText={(v) => {
                      setSlots(v.replace(/[^\d]/g, ''));
                      clear('slots');
                    }}
                    error={errors.slots}
                    hint="Between 2 and 128 players."
                  />
                  <GlassInput
                    label="Entry fee (₱)"
                    placeholder="0"
                    keyboardType="number-pad"
                    value={fee}
                    onChangeText={(v) => {
                      setFee(v.replace(/[^\d]/g, ''));
                      clear('fee');
                    }}
                    error={errors.fee}
                    hint="Type 0 if joining is free."
                  />
                </View>
              </GlassCard>
            ) : null}

            {/* ---------- Step 3 — the announcement ---------- */}
            {step === 3 ? (
              <>
                <GlassCard>
                  <View style={styles.form}>
                    <Text style={styles.sectionTitle}>Tell players why they should join</Text>
                    <GlassInput
                      label="Prize (optional)"
                      placeholder="e.g. ₱5,000 + trophy"
                      value={prize}
                      onChangeText={setPrize}
                      maxLength={80}
                    />
                    <GlassInput
                      label="Description"
                      placeholder="Who is it for? What should players bring?"
                      value={description}
                      onChangeText={(v) => {
                        setDescription(v);
                        clear('description');
                      }}
                      error={errors.description}
                      multiline
                      maxLength={DESC_MAX}
                      counter={{ length: description.length, max: DESC_MAX }}
                    />

                    <Pressable style={styles.toggleRow} onPress={() => setAnnounce((a) => !a)}>
                      <View style={{ flex: 1 }}>
                        <Text style={type.h3}>Announce to players</Text>
                        <Text style={[type.caption, { marginTop: 3 }]}>
                          Posts “New tournament: {name.trim() || 'your event'}” to every player&apos;s
                          Tournaments tab.
                        </Text>
                      </View>
                      <View style={[styles.switch, announce && styles.switchOn]}>
                        <View style={[styles.knob, announce && styles.knobOn]} />
                      </View>
                    </Pressable>
                  </View>
                </GlassCard>

                {/* Live preview of the card players will see */}
                <Text style={styles.previewLabel}>PREVIEW</Text>
                <GlassCard strong>
                  <View style={styles.tHead}>
                    <View style={styles.divisionChip}>
                      <Text style={styles.divisionText}>{division}</Text>
                    </View>
                    <Text style={styles.meta}>{date ? formatDate(date) : 'Date TBD'}</Text>
                  </View>
                  <Text style={[type.h2, { marginTop: 10 }]} numberOfLines={2}>
                    {name.trim() || 'Your tournament name'}
                  </Text>
                  <Text style={[type.caption, { marginTop: 4 }]}>
                    {format} · {VENUE_NAME}
                  </Text>
                  <View style={styles.previewMeta}>
                    <Text style={styles.meta}>{time ? formatTime(time) : 'Time TBD'}</Text>
                    <Text style={styles.meta}> · {slots || 0} slots</Text>
                    <Text style={styles.meta}> · {Number(fee) > 0 ? `₱${fee}` : 'Free'}</Text>
                  </View>
                  {description.trim() ? (
                    <Text style={styles.desc}>{description.trim()}</Text>
                  ) : null}
                  {prize.trim() ? (
                    <View style={styles.prizeRow}>
                      <Ionicons name="ribbon" size={14} color={palette.lime} />
                      <Text style={styles.prizeText}>{prize.trim()}</Text>
                    </View>
                  ) : null}
                </GlassCard>
              </>
            ) : null}

            {/* ---------- Nav ---------- */}
            <View style={styles.nav}>
              <GlassButton title="Back" variant="secondary" onPress={back} style={{ flex: 1 }} />
              {step < 3 ? (
                <GlassButton title="Continue" onPress={next} style={{ flex: 1.4 }} />
              ) : (
                <GlassButton title="Create tournament" onPress={publish} loading={busy} style={{ flex: 1.4 }} />
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgTop },
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { ...type.h3, marginBottom: 2 },
  form: { gap: 16 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: glass.innerRadius,
    borderWidth: 1,
    borderColor: glass.border,
    padding: 14,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.22)',
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: palette.lime },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: palette.white },
  knobOn: { alignSelf: 'flex-end', backgroundColor: palette.ink },
  previewLabel: { ...type.eyebrow },
  previewMeta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  desc: { fontSize: 13.5, color: palette.muted, marginTop: 12, lineHeight: 19 },
  tHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divisionChip: {
    backgroundColor: 'rgba(212,243,74,0.2)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  divisionText: { fontSize: 11, fontWeight: '700', color: palette.lime, textTransform: 'uppercase' },
  meta: { fontSize: 11.5, color: palette.faint },
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
  nav: { flexDirection: 'row', gap: 10, marginTop: 4 },
  doneIcon: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: palette.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
});
