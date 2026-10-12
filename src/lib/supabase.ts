import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client — the app talks straight to Supabase now.
 *
 * The URL and anon key come from EXPO_PUBLIC_* env vars so they never get
 * baked into a public bundle by accident. Create a `.env` next to
 * package.json with:
 *
 *   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
 *
 * The anon key is safe to ship: every table is behind Row Level Security,
 * so the database itself rejects anything a user isn't allowed to see.
 */
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

/** `PASTE_...` / `your-...` are the placeholders shipped in `.env.example`. */
const isPlaceholder = (v: string) =>
  !v || /^PASTE_|^your[-_]|^<.*>$|^https:\/\/xyzcompany/i.test(v);

export function isSupabaseConfigured(): boolean {
  return !isPlaceholder(url) && !isPlaceholder(anonKey);
}

if (!isSupabaseConfigured()) {
  throw new Error(
    'Missing Supabase config.\n\n' +
      '1. Copy MyExpoApp/.env.example to MyExpoApp/.env\n' +
      '2. Paste in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY\n' +
      '   (Supabase dashboard -> Project Settings -> API keys)\n' +
      '3. Restart Metro:  npx expo start -c\n'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
