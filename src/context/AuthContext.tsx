import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isLiveSupabase, vaultApi } from '../lib/supabase';
import { Profile, UserRole, EmailNotificationPreferences } from '../types/database';
import { logger } from '../lib/logger';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  reminder_days: number[];
  email_notifications?: EmailNotificationPreferences;
  is_explicit_session?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string; sessionCreated?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updateUserProfile: (
    name: string,
    reminderDays: number[],
    emailNotifications?: EmailNotificationPreferences
  ) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_AUTH_KEY = 'warrantyvault_session_user';
const LOCAL_THEME_KEY = 'warrantyvault_theme';
const LOCAL_REG_USERS_KEY = 'warrantyvault_registered_users';

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

      if (isLiveSupabase) {
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
            sessionStorage.removeItem(SESSION_AUTH_KEY);
            setUser(null);
            setProfile(null);
          }
        } catch (e) {
          logger.error('Supabase session load error:', e);
          if (mounted) {
            sessionStorage.removeItem(SESSION_AUTH_KEY);
            setUser(null);
            setProfile(null);
          }
        }
      } else {
        // Mock / Test environment session persistence
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
        } else if (mounted) {
          setUser(null);
          setProfile(null);
        }
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

  /**
   * Primary Login: Only existing registered users with valid password.
   * Unregistered users MUST register first.
   */
  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    if (isLiveSupabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid login credentials')) {
          return { error: 'Invalid email or password. Please make sure you have registered first.' };
        }
        if (msg.includes('email not confirmed')) {
          return {
            error:
              'Email not confirmed yet. In your Supabase Dashboard -> Authentication -> Providers -> Email, turn off "Confirm email" to enable immediate login without email verification.',
          };
        }
        return { error: error.message };
      }

      if (!data.user) {
        return { error: 'Invalid email or password.' };
      }

      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email || cleanEmail,
        name: data.user.user_metadata?.name || cleanEmail.split('@')[0],
        role: (data.user.user_metadata?.role as UserRole) || 'user',
        reminder_days: [30, 15, 7],
        is_explicit_session: true,
      };

      sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(authUser));
      await refreshProfile(data.user.id, authUser);
      return {};
    }

    // Local Mock / Test Mode Flow
    if (!cleanEmail || !password) {
      return { error: 'Please enter both email and password.' };
    }

    const regUsers: any[] = JSON.parse(localStorage.getItem(LOCAL_REG_USERS_KEY) || '[]');
    const existing = regUsers.find((u) => u.email?.toLowerCase() === cleanEmail);

    if (!existing) {
      // User must register first! Never synthesize fake user.
      return { error: 'No account found with this email. Please register first.' };
    }

    if (existing.password !== password) {
      return { error: 'Invalid email or password.' };
    }

    const authUser: AuthUser = {
      id: existing.id,
      email: existing.email,
      name: existing.name || cleanEmail.split('@')[0],
      role: (existing.role as UserRole) || 'user',
      reminder_days: existing.reminder_days || [30, 15, 7],
      is_explicit_session: true,
    };

    setUser(authUser);
    sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(authUser));
    await refreshProfile(authUser.id, authUser);
    return {};
  };

  /**
   * Signup: Registers new account.
   */
  const signUp = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ error?: string; sessionCreated?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();

    if (isLiveSupabase) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { name: name.trim(), role: 'user' },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session?.user) {
        const authUser: AuthUser = {
          id: data.session.user.id,
          email: data.session.user.email || cleanEmail,
          name: name.trim() || data.session.user.user_metadata?.name || 'Vault User',
          role: 'user',
          reminder_days: [30, 15, 7],
          is_explicit_session: true,
        };
        sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(authUser));
        await refreshProfile(data.session.user.id, authUser);
        return { sessionCreated: true };
      }

      // If email confirmation is enabled on Supabase project, user is registered but requires sign in or verification
      return { sessionCreated: false };
    }

    // Local Mock / Test Mode Flow
    const regUsers: any[] = JSON.parse(localStorage.getItem(LOCAL_REG_USERS_KEY) || '[]');
    if (regUsers.some((u) => u.email?.toLowerCase() === cleanEmail)) {
      return { error: 'An account with this email already exists. Please sign in.' };
    }

    const newId = 'user-' + Date.now();
    const newUser = {
      id: newId,
      email: cleanEmail,
      name: name.trim() || 'Vault Member',
      password: password,
      role: 'user',
      reminder_days: [30, 15, 7],
      created_at: new Date().toISOString(),
    };

    regUsers.push(newUser);
    localStorage.setItem(LOCAL_REG_USERS_KEY, JSON.stringify(regUsers));

    // Sign in immediately after registering
    const authUser: AuthUser = {
      id: newId,
      email: cleanEmail,
      name: newUser.name,
      role: 'user',
      reminder_days: [30, 15, 7],
      is_explicit_session: true,
    };

    setUser(authUser);
    sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(authUser));
    await refreshProfile(newId, authUser);
    return { sessionCreated: true };
  };

  const signOut = async () => {
    sessionStorage.removeItem(SESSION_AUTH_KEY);
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
    const cleanEmail = email.trim().toLowerCase();

    if (isLiveSupabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin + '/login',
      });
      if (error) {
        return { error: error.message };
      }
      return {};
    }

    // Local Mock
    const regUsers: any[] = JSON.parse(localStorage.getItem(LOCAL_REG_USERS_KEY) || '[]');
    const existing = regUsers.find((u) => u.email?.toLowerCase() === cleanEmail);
    if (!existing) {
      return { error: 'No account registered with this email address.' };
    }
    return {};
  };

  const updateUserProfile = async (
    name: string,
    reminderDays: number[],
    emailNotifications?: EmailNotificationPreferences
  ): Promise<{ error?: string }> => {
    if (!user) return { error: 'Not authenticated' };

    try {
      const updated = await vaultApi.updateProfile(user.id, {
        name: name.trim(),
        reminder_days: reminderDays,
        email_notifications: emailNotifications,
      });

      const updatedUser: AuthUser = {
        ...user,
        name: updated.name,
        reminder_days: updated.reminder_days,
        email_notifications: updated.email_notifications,
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
