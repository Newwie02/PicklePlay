import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassBackground } from '../components/glass/GlassBackground';
import { GlassCard } from '../components/glass/GlassCard';
import { GlassInput } from '../components/glass/GlassInput';
import { GlassButton } from '../components/glass/GlassButton';
import { ErrorBanner } from '../components/glass/Banner';
import { DbError, discardIncompleteGoogleSignup, fetchProfile } from '../lib/db';
import { supabase } from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import type { FieldErrors } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { User } from '../lib/types';
import { validators } from '../lib/validation';
import { glass, palette, type } from '../theme/glass';

/** Which side of the app the person is trying to reach. */
type LoginMode = 'client' | 'owner';

/** Shown when someone points Google at an account they never created. */
const NO_ACCOUNT_MSG =
  'That Google account has not signed up here yet. Tap Create Account first — afterwards, Continue with Google will work.';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, user } = useAuth();

  const [mode, setMode] = useState<LoginMode>('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const isOwnerMode = mode === 'owner';

  /** Flip modes without losing what they've typed. */
  const switchMode = (next: LoginMode) => {
    if (next === mode) return;
    setMode(next);
    setFormError(null);
    setErrors({});
  };

  /**
   * The toggle is a promise about which side of the app this account belongs
   * to, so we verify it instead of silently routing. Checks both directions:
   * a client can't reach the owner portal, and an owner picking Client gets a
   * clear message rather than being bounced into /owner by the tab layout.
   */
  const modeMismatch = (role: string): string | null => {
    if (isOwnerMode && role !== 'owner') {
      return 'This account does not have admin permissions. Please switch to Player mode.';
    }
    if (!isOwnerMode && role === 'owner') {
      return 'This is a court-owner account. Switch to Admin / Owner above to sign in.';
    }
    return null;
  };

  if (user) return <Redirect href={user.role === 'owner' ? '/owner' : '/home'} />;

  const validate = () => {
    const next: Record<string, string | null> = {
      email: validators.gmail(email),
      password: password ? null : 'Please enter your password.',
    };
    const cleaned = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v)
    ) as FieldErrors;
    setErrors(cleaned);
    return Object.keys(cleaned).length === 0;
  };

  const handleLogin = async () => {
    setFormError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid login') || msg.includes('invalid_credentials')) {
          setErrors({ password: 'That Gmail and password don’t match yet.' });
          setFormError('That Gmail and password don’t match. Try again or sign up.');
        } else if (msg.includes('email not confirmed')) {
          setFormError('Please confirm your Gmail first — check your inbox for the code.');
        } else if (msg.includes('rate limit')) {
          setFormError('Too many tries. Give it a minute, then try again.');
        } else {
          setFormError(error.message);
        }
        return;
      }

      const profile = await fetchProfile(data.user.id);

      const mismatch = modeMismatch(profile.role);
      if (mismatch) {
        setFormError(mismatch);
        await supabase.auth.signOut();
        return;
      }

      await signIn(data.session.access_token, profile);
      router.replace(profile.role === 'owner' ? '/owner' : '/home');
    } catch (e) {
      setFormError(e instanceof DbError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Google always hands back *some* user — it mints one the moment the
   * consent screen is finished. When that account was never set up here,
   * throw it away and end its session, quietly: there is nothing useful
   * to report beyond the "sign up first" message.
   */
  const discardGoogleGhost = async () => {
    try {
      await discardIncompleteGoogleSignup();
    } catch {
      // The session may already be gone; nothing to salvage.
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // Same — leave it be.
    }
  };

  /**
   * Real Google sign-in through Supabase Auth.
   *
   * Google is not an alternative way in: it only recognises a Gmail that
   * has already gone through Create Account. Someone who has not signed
   * up is turned away rather than let through with a half-filled profile.
   */
  const handleGoogle = async () => {
    setFormError(null);
    setGoogleBusy(true);
    try {
      const res = await signInWithGoogle();
      if (!res) return; // user closed the browser

      let profile: User;
      try {
        profile = await fetchProfile(res.userId);
      } catch {
        // No profile row at all — the same thing as never having signed up.
        await discardGoogleGhost();
        setFormError(NO_ACCOUNT_MSG);
        return;
      }

      if (!profile.profileComplete) {
        await discardGoogleGhost();
        setFormError(NO_ACCOUNT_MSG);
        return;
      }

      const mismatch = modeMismatch(profile.role);
      if (mismatch) {
        setFormError(mismatch);
        await supabase.auth.signOut();
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      await signIn(sessionData.session?.access_token ?? '', profile);
      router.replace(profile.role === 'owner' ? '/owner' : '/home');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleBusy(false);
    }
  };

  const fieldError = (key: string) => (errors[key] ? errors[key] : null);

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.brandDot}>
              <Ionicons name="tennisball" size={18} color={palette.ink} />
            </View>
            <Text style={type.brand}>PicklePlay</Text>
          </View>

          {/* Role selector tabs: Player vs Admin */}
          <View style={styles.roleTabs}>
            <Pressable
              onPress={() => switchMode('client')}
              style={[styles.roleTab, !isOwnerMode && styles.roleTabActive]}
            >
              <Ionicons
                name={!isOwnerMode ? 'person' : 'person-outline'}
                size={16}
                color={!isOwnerMode ? palette.ink : palette.white}
              />
              <Text style={[styles.roleTabText, !isOwnerMode && styles.roleTabTextActive]}>
                Player
              </Text>
            </Pressable>

            <Pressable
              onPress={() => switchMode('owner')}
              style={[styles.roleTab, isOwnerMode && styles.roleTabActive]}
            >
              <Ionicons
                name={isOwnerMode ? 'shield-checkmark' : 'shield-checkmark-outline'}
                size={16}
                color={isOwnerMode ? palette.ink : palette.white}
              />
              <Text style={[styles.roleTabText, isOwnerMode && styles.roleTabTextActive]}>
                Admin / Owner
              </Text>
            </Pressable>
          </View>

          <GlassCard strong>
            {isOwnerMode ? (
              <>
                <View style={styles.adminHeaderRow}>
                  <View style={styles.adminBadge}>
                    <Ionicons name="shield-checkmark" size={13} color={palette.lime} />
                    <Text style={styles.adminBadgeText}>ADMIN PORTAL</Text>
                  </View>
                </View>
                <Text style={type.h1}>Court Management</Text>
                <Text style={[type.body, styles.subtle]}>
                  Sign in with your admin account to manage courts, bookings, and tournaments.
                </Text>
              </>
            ) : (
              <>
                <Text style={type.h1}>Welcome back</Text>
                <Text style={[type.body, styles.subtle]}>
                  Sign in to book courts, join tournaments and track your ranking.
                </Text>
              </>
            )}
          </GlassCard>

          <ErrorBanner message={formError} />

          <GlassCard style={styles.formCard}>
            <View style={styles.form}>
              <GlassInput
                label="Gmail"
                placeholder="you@gmail.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errors.email) setErrors((p) => ({ ...p, email: '' }));
                }}
                onBlur={() => {
                  const err = validators.gmail(email);
                  setErrors((p) => ({ ...p, email: err ?? '' }));
                }}
                error={fieldError('email') || null}
              />
              <GlassInput
                label="Password"
                placeholder="********"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errors.password) setErrors((p) => ({ ...p, password: '' }));
                }}
                error={fieldError('password') || null}
                right={
                  <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                    <Text style={type.link}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                }
              />
              <Pressable style={styles.forgot}>
                <Text style={type.link}>Forgot password?</Text>
              </Pressable>
              <GlassButton
                title={isOwnerMode ? 'Log in as Admin' : 'Log in'}
                onPress={handleLogin}
                loading={busy}
              />
            </View>
          </GlassCard>

          <GlassButton
            variant="secondary"
            title={isOwnerMode ? 'Continue with Google (Admin)' : 'Continue with Google'}
            onPress={handleGoogle}
            loading={googleBusy}
          />

          {isOwnerMode ? (
            <Text style={styles.footer}>
              Not an admin?{' '}
              <Pressable onPress={() => switchMode('client')} style={{ alignSelf: 'flex-start' }}>
                <Text style={type.link}>Sign in as Player</Text>
              </Pressable>
            </Text>
          ) : (
            <Text style={styles.footer}>
              New to PicklePlay?{' '}
              <Pressable onPress={() => router.push('/signup')} style={{ alignSelf: 'flex-start' }}>
                <Text style={type.link}>Sign up</Text>
              </Pressable>
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgTop },
  container: { padding: 24, gap: 16, flexGrow: 1, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  brandDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.lime,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.lime,
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: glass.border,
    gap: 6,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  roleTabActive: {
    backgroundColor: palette.lime,
    shadowColor: palette.lime,
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  roleTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.white,
  },
  roleTabTextActive: {
    color: palette.ink,
    fontWeight: '700',
  },
  adminHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(212,243,74,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212,243,74,0.35)',
  },
  adminBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: palette.lime,
    letterSpacing: 0.8,
  },
  subtle: { color: palette.muted, marginTop: 6 },
  formCard: { marginTop: 4 },
  form: { gap: 16 },
  forgot: { alignSelf: 'flex-end' },
  footer: { ...type.caption, textAlign: 'center', marginTop: 8 },
});
