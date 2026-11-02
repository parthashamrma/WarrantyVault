import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isLiveSupabase, vaultApi } from '../lib/supabase';
import { Profile, UserRole } from '../types/database';
import { logger } from '../lib/logger';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  reminder_days: number[];
  is_explicit_session?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string; confirmationRequired?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updateUserProfile: (name: string, reminderDays: number[]) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_AUTH_KEY = 'warrantyvault_session_user';
const LOCAL_AUTH_KEY = 'warrantyvault_auth_user';
const LOCAL_THEME_KEY = 'warrantyvault_theme';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(LOCAL_THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(LOCAL_THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Sync profile data when user changes
  const refreshProfile = async (uid: string, fallbackUser?: AuthUser) => {
    try {
      const p = await vaultApi.getProfile(uid);
      if (p) {
        setProfile(p);
        setUser({
          id: p.id,
          email: fallbackUser?.email || '',
          name: p.name,
          role: p.role,
          reminder_days: p.reminder_days || [30, 15, 7],
          is_explicit_session: true,
        });
        return;
      }
    } catch (e) {
      logger.warn('Profile fetch notice:', e);
    }

    // Always set authenticated user from fallback if profile table query is null/unmigrated
    if (fallbackUser) {
      const fallbackProfile: Profile = {
        id: fallbackUser.id,
        name: fallbackUser.name,
        role: fallbackUser.role,
        reminder_days: fallbackUser.reminder_days,
        created_at: new Date().toISOString(),
      };
      setProfile(fallbackProfile);
      setUser({
        ...fallbackUser,
        is_explicit_session: true,
      });
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      setLoading(true);

      // Clean up any stale localStorage tokens so old sessions don't linger on restart
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(LOCAL_AUTH_KEY);
          localStorage.removeItem(SESSION_AUTH_KEY);
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('sb-') && k.endsWith('-auth-token'))) {
              localStorage.removeItem(k);
            }
          }
        } catch {
          // Ignore storage clean errors
        }
      }

      // Check active tab session storage first
      const stored = typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_AUTH_KEY) : null;
      if (stored && mounted) {
        try {
          const parsed: AuthUser = JSON.parse(stored);
          if (parsed && parsed.is_explicit_session) {
            setUser(parsed);
            await refreshProfile(parsed.id, parsed);
          } else {
            sessionStorage.removeItem(SESSION_AUTH_KEY);
            setUser(null);
            setProfile(null);
          }
        } catch {
          sessionStorage.removeItem(SESSION_AUTH_KEY);
          setUser(null);
          setProfile(null);
        }
      } else if (isLiveSupabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && mounted) {
            const u = session.user;
            const fallback: AuthUser = {
              id: u.id,
              email: u.email || '',
              name: u.user_metadata?.name || (u.email ? u.email.split('@')[0] : 'Vault User'),
              role: (u.user_metadata?.role as UserRole) || 'user',
              reminder_days: [30, 15, 7],
              is_explicit_session: true,
            };
            sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(fallback));
            await refreshProfile(u.id, fallback);
          } else if (mounted) {
            setUser(null);
            setProfile(null);
          }
        } catch (e) {
          logger.error('Supabase session load error:', e);
          if (mounted) {
            setUser(null);
            setProfile(null);
          }
        }
      } else if (mounted) {
        // Default: visitors start completely logged out
        setUser(null);
        setProfile(null);
      }

      if (mounted) setLoading(false);
    }

    initAuth();

    // Listen to Supabase Auth State changes if live
    if (isLiveSupabase) {
      const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const fallback: AuthUser = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || (session.user.email ? session.user.email.split('@')[0] : 'Vault User'),
            role: (session.user.user_metadata?.role as UserRole) || 'user',
            reminder_days: [30, 15, 7],
            is_explicit_session: true,
          };
          sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(fallback));
          await refreshProfile(session.user.id, fallback);
        } else {
          sessionStorage.removeItem(SESSION_AUTH_KEY);
          setUser(null);
          setProfile(null);
        }
      });

      return () => {
        mounted = false;
        listener.subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    if (isLiveSupabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return {
            error:
              'Invalid email or password. If you haven’t created an account yet, click "Get started" to register.',
          };
        }
        if (error.message.includes('Email not confirmed')) {
          return {
            error:
              'Email not confirmed yet. In your Supabase Dashboard -> Authentication -> Providers -> Email, turn off "Confirm email" to enable immediate login without email verification.',
          };
        }
        return { error: error.message };
      }
      if (data.user) {
        const fallback: AuthUser = {
          id: data.user.id,
          email: data.user.email || email,
          name: data.user.user_metadata?.name || email.split('@')[0],
          role: (data.user.user_metadata?.role as UserRole) || 'user',
          reminder_days: [30, 15, 7],
          is_explicit_session: true,
        };
        sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(fallback));
        await refreshProfile(data.user.id, fallback);
      }
      return {};
    }

    // Local Mock Sign In (Checks registered users)
    if (!email || !password) {
      return { error: 'Please enter both email and password.' };
    }

    if (password.length < 6) {
      return { error: 'Invalid password. (Minimum 6 characters).' };
    }

    const profiles: Profile[] = JSON.parse(localStorage.getItem('warrantyvault_profiles') || '[]');
    const existing = profiles.find((p: any) => p.email?.toLowerCase() === email.trim().toLowerCase());

    const authUser: AuthUser = {
      id: existing ? existing.id : 'user-' + Date.now(),
      email: email.trim(),
      name: existing ? existing.name : email.split('@')[0],
      role: (existing?.role as UserRole) || 'user',
      reminder_days: existing?.reminder_days || [30, 15, 7],
      is_explicit_session: true,
    };

    setUser(authUser);
    sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(authUser));
    await refreshProfile(authUser.id, authUser);
    return {};
  };

  const signUp = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ error?: string; confirmationRequired?: boolean }> => {
    if (isLiveSupabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role: 'user' },
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes('rate limit') || (error as any).status === 429) {
          return {
            error:
              'Supabase email rate limit reached (429). Please wait a few moments before requesting another confirmation email, or check your inbox.',
          };
        }
        return { error: error.message };
      }
      if (data.user) {
        const fallback: AuthUser = {
          id: data.user.id,
          email: data.user.email || email,
          name: name || data.user.user_metadata?.name || 'Vault User',
          role: 'user',
          reminder_days: [30, 15, 7],
          is_explicit_session: true,
        };
        if (!data.session) {
          return { confirmationRequired: true };
        }
        sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(fallback));
        await refreshProfile(data.user.id, fallback);
      }
      return {};
    }

    // Local Mock Sign Up
    const newId = 'user-' + Date.now();
    const authUser: AuthUser = {
      id: newId,
      email: email.trim(),
      name: name.trim() || 'Vault Member',
      role: 'user',
      reminder_days: [30, 15, 7],
      is_explicit_session: true,
    };

    // Save profile to local repository
    const profiles = JSON.parse(localStorage.getItem('warrantyvault_profiles') || '[]');
    profiles.push({
      id: newId,
      name: authUser.name,
      role: 'user',
      reminder_days: [30, 15, 7],
      created_at: new Date().toISOString(),
    });
    localStorage.setItem('warrantyvault_profiles', JSON.stringify(profiles));

    setUser(authUser);
    sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(authUser));
    await refreshProfile(authUser.id, authUser);
    return {};
  };

  const signOut = async () => {
    sessionStorage.removeItem(SESSION_AUTH_KEY);
    localStorage.removeItem(LOCAL_AUTH_KEY);
    setUser(null);
    setProfile(null);
    if (isLiveSupabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        logger.warn('Sign out error:', err);
      }
    }
  };

  const resetPassword = async (email: string): Promise<{ error?: string }> => {
    if (isLiveSupabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (error) return { error: error.message };
      return {};
    }

    // Local Mock
    if (!email.includes('@')) {
      return { error: 'Please enter a valid email address.' };
    }
    return {};
  };

  const updateUserProfile = async (
    name: string,
    reminderDays: number[]
  ): Promise<{ error?: string }> => {
    if (!user) return { error: 'Not authenticated' };

    try {
      const updated = await vaultApi.updateProfile(user.id, {
        name: name.trim(),
        reminder_days: reminderDays,
      });

      const updatedUser: AuthUser = {
        ...user,
        name: updated.name,
        reminder_days: updated.reminder_days,
      };

      setUser(updatedUser);
      setProfile(updated);
      sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(updatedUser));
      return {};
    } catch (err: any) {
      return { error: err.message || 'Failed to update profile' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        theme,
        toggleTheme,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

