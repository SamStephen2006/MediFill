import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function userToProfile(user: User, displayName?: string): UserProfile {
  const meta = user.user_metadata ?? {};
  return {
    uid: user.id,
    email: user.email ?? '',
    displayName:
      displayName ??
      meta.display_name ??
      meta.full_name ??
      user.email?.split('@')[0] ??
      'User',
    photoURL: meta.avatar_url ?? undefined,
    createdAt: user.created_at,
  };
}

async function fetchProfile(uid: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();
  if (error || !data) return null;
  return {
    uid: data.id,
    email: data.email ?? '',
    displayName: data.display_name ?? 'User',
    photoURL: data.avatar_url ?? undefined,
    createdAt: data.created_at,
  };
}

async function upsertProfile(profile: UserProfile): Promise<void> {
  await supabase.from('profiles').upsert(
    {
      id: profile.uid,
      email: profile.email,
      display_name: profile.displayName,
      avatar_url: profile.photoURL ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Listen to auth state ──────────────────────────────────────────────────
  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Subscribe to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        handleSession(session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSession(session: Session | null) {
    try {
      if (session?.user) {
        setUser(session.user);

        // Set a local profile immediately from session data (no flicker)
        const localProfile = userToProfile(session.user);
        setProfile(localProfile);

        // Fetch full profile from DB in background (non-blocking)
        try {
          const dbProfile = await fetchProfile(session.user.id);
          if (dbProfile) {
            setProfile(dbProfile);
          } else {
            // First sign-in — create profile row
            await upsertProfile(localProfile);
          }
        } catch (e) {
          console.warn('Profile fetch/create failed (non-blocking):', e);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
    } finally {
      setIsLoading(false);
    }
  }

  // ── Auth actions ──────────────────────────────────────────────────────────

  const signIn = async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw mapSupabaseError(error);
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string
  ): Promise<void> => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { display_name: displayName.trim() },
      },
    });
    if (error) throw mapSupabaseError(error);

    // Create profile row immediately (don't wait for email confirmation)
    if (data.user) {
      const newProfile = userToProfile(data.user, displayName.trim());
      setProfile(newProfile);
      try {
        await upsertProfile(newProfile);
      } catch (e) {
        console.warn('Profile creation failed (non-blocking):', e);
      }
    }
  };

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase()
    );
    if (error) throw mapSupabaseError(error);
  };

  const updateDisplayName = async (name: string): Promise<void> => {
    if (!user) return;
    const trimmed = name.trim();
    await supabase.auth.updateUser({ data: { display_name: trimmed } });
    try {
      await supabase
        .from('profiles')
        .update({ display_name: trimmed, updated_at: new Date().toISOString() })
        .eq('id', user.id);
    } catch (e) {
      console.warn('updateDisplayName DB sync failed:', e);
    }
    setProfile((prev) => (prev ? { ...prev, displayName: trimmed } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapSupabaseError(error: AuthError): Error {
  const msg = error.message?.toLowerCase() ?? '';

  if (msg.includes('invalid login credentials') || msg.includes('invalid password')) {
    return new Error('Invalid email or password.');
  }
  if (msg.includes('email not confirmed')) {
    return new Error('Please confirm your email before signing in.');
  }
  if (msg.includes('user already registered') || msg.includes('already exists')) {
    return new Error('An account with this email already exists.');
  }
  if (msg.includes('password should be')) {
    return new Error('Password must be at least 6 characters.');
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return new Error('Too many attempts. Please try again later.');
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return new Error('Network error. Check your internet connection.');
  }
  if (msg.includes('invalid email')) {
    return new Error('Invalid email address.');
  }

  return new Error(error.message ?? 'Something went wrong. Please try again.');
}
