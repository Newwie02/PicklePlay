import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';

/**
 * "Continue with Google" via Supabase Auth.
 *
 * Supabase hosts the consent screen, so all we need is the Google
 * provider switched on in Dashboard → Authentication → Providers →
 * Google (paste the OAuth client ID/secret Google gives you) and the
 * redirect URL below allow-listed under Authentication → URL
 * Configuration.
 *
 * Returns the signed-in Supabase user id, or null if they backed out.
 */
export async function signInWithGoogle(): Promise<{ userId: string; email: string } | null> {
  // Expo's auth proxy finishes the flow and hands control back to the app.
  const redirectTo = makeRedirectUri({ path: 'auth/callback' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) throw new Error(error?.message ?? 'Could not start Google sign-in.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success' || !result.url) return null;

  // The callback carries ?code=... (PKCE) or #access_token=... (implicit).
  const parsed = Linking.parse(result.url);
  const code =
    (parsed.queryParams?.code as string | undefined) ??
    (parsed.queryParams?.auth_code as string | undefined) ??
    null;

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw new Error(exchangeError.message);
  } else {
    // Implicit flow: tokens arrive in the URL fragment. Parse them out
    // and hand them to supabase-js directly.
    const hash = result.url.split('#')[1] ?? '';
    const frag = new URLSearchParams(hash);
    const access = frag.get('access_token');
    const refresh = frag.get('refresh_token');
    if (!access || !refresh) return null;
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    });
    if (sessionError) throw new Error(sessionError.message);
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;
  return { userId: user.id, email: user.email ?? '' };
}

/** Called back into by the auth/callback route after a web redirect. */
export async function finishGoogleRedirect(url: string): Promise<boolean> {
  const parsed = Linking.parse(url);
  const code = (parsed.queryParams?.code as string | undefined) ?? null;
  if (!code) return false;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return !error;
}

/** For deep-link hygiene: makes the browser close itself on success. */
export async function closeBrowser() {
  await WebBrowser.maybeCompleteAuthSession();
}
