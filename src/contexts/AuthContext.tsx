import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { ProfileRow } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  profile: ProfileRow | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (newPassword: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PROFILE_COLUMNS = 'id, email, full_name, role, is_active, created_at';

function describeAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Email or password is incorrect.';
  if (message.includes('already registered')) return 'An account with this email already exists.';
  if (message.includes('Password should be')) return 'Password must be at least 6 characters.';
  if (message.includes('rate limit')) return 'Too many attempts. Wait a few minutes and try again.';
  if (message.includes('Auth session missing')) return 'This reset link has expired. Request a new one.';
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      setProfile(null);
      return;
    }
    setProfile((data as ProfileRow | null) ?? null);
  }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      (async () => {
        const nextUserId = nextSession?.user.id ?? null;
        setSession(nextSession);
        if (nextUserId === userIdRef.current) {
          setLoading(false);
          return;
        }
        userIdRef.current = nextUserId;
        setLoading(true);
        if (nextUserId) {
          await loadProfile(nextUserId);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });
    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? describeAuthError(error.message) : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return error ? describeAuthError(error.message) : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error ? describeAuthError(error.message) : null;
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error ? describeAuthError(error.message) : null;
  }, []);

  const value = useMemo(
    () => ({ session, profile, loading, signIn, signUp, signOut, requestPasswordReset, updatePassword }),
    [session, profile, loading, signIn, signUp, signOut, requestPasswordReset, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
