import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassBackground } from '../../components/glass/GlassBackground';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassInput } from '../../components/glass/GlassInput';
import { GlassButton } from '../../components/glass/GlassButton';
import { ErrorBanner } from '../../components/glass/Banner';
import { StepProgress } from '../../components/StepProgress';
import { DbError, fetchProfile } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { signInWithGoogle } from '../../lib/googleAuth';
import { useAuth } from '../../lib/auth';
import { useSignup } from '../../lib/signup';
import { validators } from '../../lib/validation';
import type { FieldErrors } from '../../lib/api';
import { palette, type } from '../../theme/glass';

export default function SignUpStep1() {
  const router = useRouter();
  const draft = useSignup();
  const { signIn } = useAuth();

  const [firstName, setFirstName] = useState(draft.firstName);
  const [lastName, setLastName] = useState(draft.lastName);
  const [gmail, setGmail] = useState(draft.email);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const clear = (key: string) => setErrors((p) => ({ ...p, [key]: '' }));

  const validate = () => {
    const next: Record<string, string | null> = {
      firstName: validators.firstName(firstName),
      lastName: validators.lastName(lastName),
      email: validators.gmail(gmail),
      password: validators.password(password),
      confirmPassword: validators.confirmPassword(password, confirm),
    };
    const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as FieldErrors;
    setErrors(cleaned);
    const first = Object.values(cleaned)[0];
    setFormError(first ? 'Just a couple of things to fix before we continue.' : null);
    return Object.keys(cleaned).length === 0;
  };

  const handleContinue = async () => {
    setFormError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const email = gmail.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName.trim(), last_name: lastName.trim() },
          // Where Supabase sends the user back after they tap the
          // confirmation link. The OTP still works from the email itself.
          emailRedirectTo: undefined,
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered')) {
          setErrors({ email: 'That Gmail already has an account — log in instead.' });
          setFormError('That Gmail is already registered. Try logging in.');
        } else if (msg.includes('password')) {
          setErrors({ password: 'Passwords need at least 8 characters.' });
          setFormError('Just a couple of things to fix before we continue.');
        } else {
          setFormError(error.message);
        }
        return;
      }

      // `data.session` is null while email confirmation is on, which is
      // exactly what we want: Step 2 verifies the Gmail first.
      draft.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email,
        password,
        accountCreated: true,
      });

      // If confirmation is off in the dashboard we're already signed in —
      // pull the profile so Step 3 has somewhere to write to.
      if (data.session) {
        const profile = await fetchProfile(data.user!.id).catch(() => null);
        if (profile) signIn(data.session.access_token, profile);
      }

      router.push('/signup/step2');
    } catch (e) {
      setFormError(e instanceof DbError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Real Google sign-in through Supabase Auth. Flip the Google provider
   * on in Dashboard → Authentication → Providers and allow-list the
   * redirect URL, and this just works.
   */
  const handleGoogle = async () => {
    setFormError(null);
    setGoogleBusy(true);
    try {
      const res = await signInWithGoogle();
      if (!res) {
        // User closed the browser — not an error.
        return;
      }
      const profile = await fetchProfile(res.userId).catch(() => null);
      if (profile) {
        // The OAuth flow already left a session on the client; read its
        // token so AuthProvider has something to hand the screens.
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token ?? '';
        await signIn(accessToken, profile);
      }
      // Google accounts skip Gmail OTP — they're already verified.
      draft.update({
        firstName: profile?.firstName ?? '',
        lastName: profile?.lastName ?? '',
        email: res.email,
        accountCreated: true,
      });
      if (profile?.profileComplete) {
        router.replace('/home');
      } else {
        router.push('/signup/step3');
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <StepProgress step={1} />

            <View style={styles.titleRow}>
              <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
                <Ionicons name="chevron-back" size={20} color={palette.white} />
              </Pressable>
              <Text style={type.h1}>Create account</Text>
            </View>

            <ErrorBanner message={formError} />

            <GlassCard>
              <View style={styles.form}>
                <View style={styles.row}>
                  <View style={styles.half}>
                    <GlassInput
                      label="First name"
                      placeholder="Juan"
                      autoCapitalize="words"
                      value={firstName}
                      onChangeText={(v) => {
                        setFirstName(v);
                        clear('firstName');
                      }}
                      onBlur={() => setErrors((p) => ({ ...p, firstName: validators.firstName(firstName) ?? '' }))}
                      error={errors.firstName || null}
                    />
                  </View>
                  <View style={styles.half}>
                    <GlassInput
                      label="Last name"
                      placeholder="Dela Cruz"
                      autoCapitalize="words"
                      value={lastName}
                      onChangeText={(v) => {
                        setLastName(v);
                        clear('lastName');
                      }}
                      onBlur={() => setErrors((p) => ({ ...p, lastName: validators.lastName(lastName) ?? '' }))}
                      error={errors.lastName || null}
                    />
                  </View>
                </View>

                <GlassInput
                  label="Gmail"
                  placeholder="you@gmail.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={gmail}
                  onChangeText={(v) => {
                    setGmail(v);
                    clear('email');
                  }}
                  onBlur={() => setErrors((p) => ({ ...p, email: validators.gmail(gmail) ?? '' }))}
                  error={errors.email || null}
                  hint="We'll send a 6-digit code here in Step 2."
                />

                <GlassInput
                  label="Password"
                  placeholder="At least 8 characters"
                  secureTextEntry
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    clear('password');
                    clear('confirmPassword');
                  }}
                  onBlur={() => setErrors((p) => ({ ...p, password: validators.password(password) ?? '' }))}
                  error={errors.password || null}
                  hint="Mix letters and numbers to keep it strong."
                />

                <GlassInput
                  label="Confirm Password"
                  placeholder="Re-enter password"
                  secureTextEntry
                  value={confirm}
                  onChangeText={(v) => {
                    setConfirm(v);
                    clear('confirmPassword');
                  }}
                  onBlur={() =>
                    setErrors((p) => ({ ...p, confirmPassword: validators.confirmPassword(password, confirm) ?? '' }))
                  }
                  error={errors.confirmPassword || null}
                  hint={
                    confirm && password === confirm ? 'Nice — passwords match ✓' : 'Must match your password.'
                  }
                />

                <GlassButton title="Continue" onPress={handleContinue} loading={busy} />
              </View>
            </GlassCard>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={type.caption}>or</Text>
              <View style={styles.line} />
            </View>

            <GlassButton variant="secondary" title="Continue with Google" onPress={handleGoogle} loading={googleBusy} />

            <Pressable style={styles.backRow} onPress={() => router.replace('/login')}>
              <Text style={type.caption}>
                Already have an account? <Text style={type.link}>Log in</Text>
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
  form: { gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.22)' },
  backRow: { alignSelf: 'center', marginTop: 4, paddingBottom: 24 },
});
