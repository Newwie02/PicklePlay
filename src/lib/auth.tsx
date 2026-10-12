import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './supabase';
import { fetchProfile } from './db';
import type { User } from './types';

/**
 * Session + profile state, sourced straight from Supabase Auth.
 *
 * The signed-in user's row in `public.profiles` is created by a database
 * trigger the moment Supabase Auth creates the account, so we only ever
 * read it here.
 */
type AuthState = {
  /** Supabase access token — kept for screens that still want it. */
  token: string | null;
  user: User | null;
  /** True until the stored session has been restored (show a splash). */
  booting: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/** Legacy storage key from the Express build — cleared on boot. */
const OLD_TOKEN_KEY = 'pickleplay.token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      // Drop the old Express session token if it's still around.
      try {
        await AsyncStorage.removeItem(OLD_TOKEN_KEY);
      } catch {
        // Non-fatal: storage may be unavailable in rare cases.
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          if (alive) {
            setToken(null);
            setUserState(null);
          }
          return;
        }
        if (!alive) return;
        setToken(data.session.access_token);
        const profile = await fetchProfile(data.session.user.id).catch(() => null);
        if (alive) setUserState(profile);
      } catch {
        if (alive) {
          setToken(null);
          setUserState(null);
        }
      } finally {
        if (alive) setBooting(false);
      }
    })();

    // Keep the profile in sync when the token refreshes or the user
    // signs in/out from anywhere else.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
      if (!session) {
        setUserState(null);
        return;
      }
      fetchProfile(session.user.id)
        .then((p) => setUserState(p))
        .catch(() => undefined);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /** Used right after sign-up, once the profile row already exists. */
  const signIn = useCallback(async (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUserState(nextUser);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setToken(null);
    setUserState(null);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    try {
      const fresh = await fetchProfile(data.user.id);
      setUserState(fresh);
    } catch {
      // Token went stale; keep the current local copy.
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ token, user, booting, signIn, signOut, setUser: setUserState, refresh }),
    [token, user, booting, signIn, signOut, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The signed-in Supabase user id, or null. */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
