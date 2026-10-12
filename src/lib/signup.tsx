import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type SignupDraft = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  /** True once Supabase Auth has created the account (Step 1 done). */
  accountCreated: boolean;
};

type SignupState = SignupDraft & {
  update: (patch: Partial<SignupDraft>) => void;
  reset: () => void;
};

const empty: SignupDraft = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  accountCreated: false,
};

const Ctx = createContext<SignupState | null>(null);

/** Carries the in-progress sign-up between Step 1 → 2 → 3. */
export function SignupProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SignupDraft>(empty);

  const value = useMemo<SignupState>(
    () => ({
      ...draft,
      update: (patch) => setDraft((prev) => ({ ...prev, ...patch })),
      reset: () => setDraft(empty),
    }),
    [draft]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSignup(): SignupState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSignup must be used inside <SignupProvider>');
  return ctx;
}
