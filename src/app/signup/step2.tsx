import { useEffect, useState } from 'react';
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
import { GlassButton } from '../../components/glass/GlassButton';
import { ErrorBanner, SuccessBanner } from '../../components/glass/Banner';
import { OtpInput } from '../../components/OtpInput';
import { StepProgress } from '../../components/StepProgress';
import { fetchProfile } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useSignup } from '../../lib/signup';
import type { FieldErrors } from '../../lib/api';
import { palette, type } from '../../theme/glass';

const RESEND_SECONDS = 30;

export default function SignUpStep2() {
  const router = useRouter();
  const draft = useSignup();
  const { signIn } = useAuth();

  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Someone jumped straight here without finishing Step 1.
  if (!draft.accountCreated) return <Redirect href="/signup/step1" />;

  const handleVerify = async () => {
    setFormError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: draft.email,
        token: code,
        type: 'signup',
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('expired')) {
          setErrors({ code: 'That code expired — tap resend for a fresh one.' });
          setFormError('That code expired. Tap “Resend code” for a fresh one.');
        } else if (msg.includes('invalid') || msg.includes('not found')) {
          setErrors({ code: 'That code doesn’t match. Check the latest email.' });
          setFormError('That code doesn’t match. Check the newest email we sent you.');
        } else {
          setFormError(error.message);
        }
        return;
      }

      // Verification leaves us a session, so Step 3 can write the profile.
      if (data.session && data.user) {
        const profile = await fetchProfile(data.user.id).catch(() => null);
        if (profile) await signIn(data.session.access_token, profile);
      }

      setSuccess('Gmail verified! Taking you to your profile…');
      setTimeout(() => router.push('/signup/step3'), 550);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setFormError(null);
    const { error } = await supabase.auth.resend({ type: 'signup', email: draft.email });
    if (error) {
      setFormError(error.message);
      return;
    }
    setCode('');
    setSuccess('A fresh code is on its way to your Gmail.');
    setCooldown(RESEND_SECONDS);
  };

  const masked = draft.email.replace(/^(.{2}).*(@.*)$/, '$1•••$2');

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <StepProgress step={2} />

            <View style={styles.titleRow}>
              <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
                <Ionicons name="chevron-back" size={20} color={palette.white} />
              </Pressable>
              <Text style={type.h1}>Verify your Gmail</Text>
            </View>

            <GlassCard strong>
              <View style={styles.mailBadge}>
                <Ionicons name="mail" size={22} color={palette.ink} />
              </View>
              <Text style={[type.body, { marginTop: 12 }]}>
                We sent a 6-digit code to{' '}
                <Text style={{ fontWeight: '700' }}>{masked}</Text>. Pop it in below to confirm it is
                really you.
              </Text>

              <View style={{ marginTop: 18 }}>
                <OtpInput
                  value={code}
                  onChange={(c) => {
                    setCode(c);
                    if (errors.code) setErrors((p) => ({ ...p, code: '' }));
                  }}
                  error={errors.code || null}
                />
              </View>

              {/* Real delivery now — Supabase emails the code to this Gmail. */}
              <View style={styles.devNote}>
                <Ionicons name="shield-checkmark" size={15} color={palette.mint} />
                <Text style={styles.devText}>
                  Open your Gmail — the code is in the message from Supabase.
                </Text>
              </View>
            </GlassCard>

            <ErrorBanner message={formError} />
            <SuccessBanner message={success} />

            <GlassButton
              title="Verify & continue"
              onPress={handleVerify}
              loading={busy}
              disabled={code.length !== 6}
            />

            <Pressable onPress={handleResend} disabled={cooldown > 0} style={styles.resend}>
              <Text style={[type.caption, cooldown > 0 && { opacity: 0.6 }]}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgTop },
  container: { padding: 24, gap: 16, flexGrow: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.lime,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  devNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    backgroundColor: 'rgba(94,234,212,0.14)',
    borderColor: 'rgba(94,234,212,0.5)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  devText: { color: palette.mint, fontSize: 12.5, fontWeight: '600' },
  resend: { alignSelf: 'center', padding: 8 },
});
