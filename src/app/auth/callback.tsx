import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { finishGoogleRedirect } from '../../lib/googleAuth';
import { discardIncompleteGoogleSignup, fetchProfile } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { palette, type } from '../../theme/glass';

/**
 * Landing spot for the Google OAuth redirect.
 *
 * Supabase bounces the browser back here with a one-time `code`; we trade
 * it for a session, load the profile, and continue into the right tab.
 */
export default function AuthCallback() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [failed, setFailed] = useState(false);
  /** Google handed back an account that was never set up here. */
  const [notSignedUp, setNotSignedUp] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // The `code` lives on the incoming URL; read it off the initial link.
        const url = await Linking.getInitialURL();
        const ok = url ? await finishGoogleRedirect(url) : false;
        if (!alive) return;
        if (!ok) {
          setFailed(true);
          return;
        }

        const { data } = await supabaseUser();
        if (!data.user) {
          setFailed(true);
          return;
        }

        // Same rule as the login screen: Google only recognises a Gmail
        // that has already gone through Create Account. Discard the
        // half-made account so that address isn't stuck unusable, and
        // point them at sign-up instead.
        const profile = await fetchProfile(data.user.id).catch(() => null);
        if (!profile || !profile.profileComplete) {
          await discardIncompleteGoogleSignup().catch(() => undefined);
          await supabase.auth.signOut().catch(() => undefined);
          if (alive) setNotSignedUp(true);
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        await signIn(sessionData.session?.access_token ?? '', profile);
        if (!alive) return;
        router.replace(profile.role === 'owner' ? '/owner' : '/home');
      } catch {
        if (alive) setFailed(true);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (notSignedUp) {
    return (
      <View style={styles.root}>
        <Text style={[type.h2, styles.center]}>You haven’t signed up yet</Text>
        <Text style={[type.body, styles.center, styles.sub]}>
          Create an account here first — after that, “Continue with Google” will recognise this
          Gmail.
        </Text>
        <Text style={styles.retry} onPress={() => router.replace('/signup')}>
          Create Account
        </Text>
        <Text style={styles.retry} onPress={() => router.replace('/login')}>
          Back to login
        </Text>
      </View>
    );
  }

  if (failed) {
    return (
      <View style={styles.root}>
        <Text style={[type.h2, styles.center]}>Sign-in was interrupted</Text>
        <Text style={[type.body, styles.center, styles.sub]}>
          No worries — go back and tap “Continue with Google” again.
        </Text>
        <Text style={styles.retry} onPress={() => router.replace('/login')}>
          Back to login
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ActivityIndicator color={palette.lime} size="large" />
      <Text style={[type.body, styles.center, styles.sub]}>Finishing your sign-in…</Text>
    </View>
  );
}

async function supabaseUser() {
  const { supabase } = await import('../../lib/supabase');
  return supabase.auth.getUser();
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bgTop,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 28,
  },
  center: { textAlign: 'center' },
  sub: { color: palette.muted },
  retry: { ...type.link, marginTop: 8 },
});
