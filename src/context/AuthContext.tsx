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
  email_confirmed_at: string | null;
  is_explicit_session?: boolean;
}

export type OtpFlowType = 'signup' | 'email' | 'recovery';

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  signIn: (email: string, password: string) => Promise<{ error?: string; unverified?: boolean }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string; confirmationRequired?: boolean }>;
  verifyOtp: (email: string, token: string, type: OtpFlowType) => Promise<{ error?: string }>;
  signInWithOtp: (email: string) => Promise<{ error?: string }>;
  resendOtp: (email: string, type: OtpFlowType) => Promise<{ error?: string; message?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
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
          email_confirmed_at: fallbackUser?.email_confirmed_at || new Date().toISOString(),
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
          if (session?.user && session.user.email_confirmed_at && mounted) {
            const u = session.user;
            const fallback: AuthUser = {
              id: u.id,
              email: u.email || '',
              name: u.user_metadata?.name || (u.email ? u.email.split('@')[0] : 'Vault User'),
              role: (u.user_metadata?.role as UserRole) || 'user',
              reminder_days: [30, 15, 7],
              email_confirmed_at: u.email_confirmed_at ?? null,
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
            if (parsed && parsed.email_confirmed_at && parsed.is_explicit_session) {
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
        if (session?.user && session.user.email_confirmed_at) {
          const fallback: AuthUser = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || (session.user.email ? session.user.email.split('@')[0] : 'Vault User'),
            role: (session.user.user_metadata?.role as UserRole) || 'user',
            reminder_days: [30, 15, 7],
            email_confirmed_at: session.user.email_confirmed_at ?? null,
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
   * Primary Login: Only existing, verified users with valid password.
   * Generic error prevents account enumeration. Unverified accounts get prompted for OTP.
   */
  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error?: string; unverified?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();

    if (isLiveSupabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
          return {
            error: 'Your email address is unverified. Enter the 6-digit code sent to your inbox to continue.',
            unverified: true,
          };
        }
        // Generic error - never reveal if email or password was wrong
        return { error: 'Invalid email or password.' };
      }

      if (!data.user) {
        return { error: 'Invalid email or password.' };
      }

      if (!data.user.email_confirmed_at && !data.session) {
        return {
          error: 'Your email address is unverified. Enter the 6-digit code sent to your inbox to continue.',
          unverified: true,
        };
      }

      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email || cleanEmail,
        name: data.user.user_metadata?.name || cleanEmail.split('@')[0],
        role: (data.user.user_metadata?.role as UserRole) || 'user',
        reminder_days: [30, 15, 7],
        email_confirmed_at: data.user.email_confirmed_at || new Date().toISOString(),
        is_explicit_session: true,
      };

      sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(authUser));
      await refreshProfile(data.user.id, authUser);
      return {};
    }

    // Local Mock / Test Mode Flow
    if (!cleanEmail || !password) {
      return { error: 'Invalid email or password.' };
    }

    const regUsers: any[] = JSON.parse(localStorage.getItem(LOCAL_REG_USERS_KEY) || '[]');
    const existing = regUsers.find((u) => u.email?.toLowerCase() === cleanEmail);

    if (!existing) {
      // NEVER create user on login! Must fail for unregistered email.
      return { error: 'Invalid email or password.' };
    }

    if (existing.password !== password) {
      return { error: 'Invalid email or password.' };
    }

    if (!existing.isVerified) {
      return {
        error: 'Your email address is unverified. Enter the 6-digit code sent to your inbox to continue.',
        unverified: true,
      };
    }

    const authUser: AuthUser = {
      id: existing.id,
      email: existing.email,
      name: existing.name || cleanEmail.split('@')[0],
      role: (existing.role as UserRole) || 'user',
      reminder_days: existing.reminder_days || [30, 15, 7],
      email_confirmed_at: existing.email_confirmed_at || new Date().toISOString(),
      is_explicit_session: true,
    };

    setUser(authUser);
    sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(authUser));
    await refreshProfile(authUser.id, authUser);
    return {};
  };

  /**
   * Signup: New users only.
   * Do NOT treat user as logged in after signup. Always require 6-digit OTP verification.
   */
  const signUp = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ error?: string; confirmationRequired?: boolean }> => {
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
        if (error.message.toLowerCase().includes('rate limit') || (error as any).status === 429) {
          return {
            error: 'Supabase email rate limit reached. Please wait 60 seconds before requesting another code.',
          };
        }
        return { error: error.message };
      }

      // CRITICAL: Do NOT treat the user as logged in after signup!
      // If Supabase auto-created a session (e.g., email confirm disabled), forcefully sign out.
      if (data.session) {
        await supabase.auth.signOut();
      }

      return { confirmationRequired: true };
    }

    // Local Mock / Test Mode Flow
    const regUsers: any[] = JSON.parse(localStorage.getItem(LOCAL_REG_USERS_KEY) || '[]');
    const newId = 'user-' + Date.now();
    const newUser = {
      id: newId,
      email: cleanEmail,
      name: name.trim() || 'Vault Member',
      password: password,
      role: 'user',
      reminder_days: [30, 15, 7],
      isVerified: false,
      otp: '123456',
      email_confirmed_at: null,
      created_at: new Date().toISOString(),
    };

    // Replace or add unverified entry
    const filtered = regUsers.filter((u) => u.email?.toLowerCase() !== cleanEmail);
    filtered.push(newUser);
    localStorage.setItem(LOCAL_REG_USERS_KEY, JSON.stringify(filtered));

    // Do NOT set user or session!
    return { confirmationRequired: true };
  };

  /**
   * Verify 6-digit OTP code.
   * Supports: 'signup' (new registration), 'email' (OTP login), 'recovery' (password reset)
   */
  const verifyOtp = async (
    email: string,
    token: string,
    type: OtpFlowType
  ): Promise<{ error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    if (!cleanToken || cleanToken.length !== 6) {
      return { error: 'Please enter a valid 6-digit verification code.' };
    }

    if (isLiveSupabase) {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: type as any,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('expired') || msg.includes('invalid')) {
          return { error: 'Invalid or expired 6-digit code. Please request a new one.' };
        }
        return { error: error.message };
      }

      if (data.session?.user) {
        const u = data.session.user;
        const authUser: AuthUser = {
          id: u.id,
          email: u.email || cleanEmail,
          name: u.user_metadata?.name || cleanEmail.split('@')[0],
          role: (u.user_metadata?.role as UserRole) || 'user',
          reminder_days: [30, 15, 7],
          email_confirmed_at: u.email_confirmed_at || new Date().toISOString(),
          is_explicit_session: true,
        };
        sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(authUser));
        setUser(authUser);
        await refreshProfile(u.id, authUser);
      }
      return {};
    }

    // Local Mock / Test Mode Flow
    const regUsers: any[] = JSON.parse(localStorage.getItem(LOCAL_REG_USERS_KEY) || '[]');
    const existing = regUsers.find((u) => u.email?.toLowerCase() === cleanEmail);

    if (!existing) {
      return { error: 'Invalid or expired 6-digit code. Please request a new one.' };
    }

    // In test mode, accept standard '123456' or generated code
    if (cleanToken !== '123456' && cleanToken !== existing.otp) {
      return { error: 'Invalid or expired 6-digit code. Please request a new one.' };
    }

    existing.isVerified = true;
    existing.email_confirmed_at = new Date().toISOString();
    localStorage.setItem(LOCAL_REG_USERS_KEY, JSON.stringify(regUsers));

    // If signup or email login, create active session
    if (type !== 'recovery') {
      const authUser: AuthUser = {
        id: existing.id,
        email: existing.email,
        name: existing.name || cleanEmail.split('@')[0],
        role: existing.role || 'user',
        reminder_days: existing.reminder_days || [30, 15, 7],
        email_confirmed_at: existing.email_confirmed_at,
        is_explicit_session: true,
      };
      setUser(authUser);
      sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(authUser));
      await refreshProfile(authUser.id, authUser);
    }

    return {};
  };

  /**
   * Passwordless OTP Login.
   * MANDATORY: options: { shouldCreateUser: false } so login can NEVER create an account.
   */
  const signInWithOtp = async (email: string): Promise<{ error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    if (isLiveSupabase) {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false, // MANDATORY: Login can never create an account
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('rate limit') || (error as any).status === 429) {
          return { error: 'Too many attempts. Please wait 60 seconds.' };
        }
        return { error: 'Invalid email or account does not exist.' };
      }
      return {};
    }

    // Local Mock / Test Mode Flow
    const regUsers: any[] = JSON.parse(localStorage.getItem(LOCAL_REG_USERS_KEY) || '[]');
    const existing = regUsers.find((u) => u.email?.toLowerCase() === cleanEmail);

    if (!existing) {
      // Must reject unregistered emails
      return { error: 'Invalid email or account does not exist.' };
    }

    existing.otp = '123456';
    localStorage.setItem(LOCAL_REG_USERS_KEY, JSON.stringify(regUsers));
    return {};
  };

  /**
   * Resend OTP with cooldown support
   */
  const resendOtp = async (
    email: string,
    type: OtpFlowType
  ): Promise<{ error?: string; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    if (isLiveSupabase) {
      const { error } = await supabase.auth.resend({
        type: type === 'recovery' ? 'signup' : (type as any),
        email: cleanEmail,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('rate limit') || (error as any).status === 429) {
          return { error: 'Please wait before requesting another code.' };
        }
        return { error: error.message };
      }
      return { message: 'A fresh 6-digit verification code has been dispatched.' };
    }

    // Local Mock / Test Mode Flow
    const regUsers: any[] = JSON.parse(localStorage.getItem(LOCAL_REG_USERS_KEY) || '[]');
    const existing = regUsers.find((u) => u.email?.toLowerCase() === cleanEmail);
    if (existing) {
      existing.otp = '123456';
      localStorage.setItem(LOCAL_REG_USERS_KEY, JSON.stringify(regUsers));
    }
    return { message: 'A fresh 6-digit code has been sent (Use code: 123456).' };
  };

  /**
   * Forgot Password - Step 1: Dispatches recovery OTP to email
   */
  const resetPassword = async (email: string): Promise<{ error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    if (isLiveSupabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (error) {
        return { error: error.message };
      }
      return {};
    }

    // Local Mock / Test Mode Flow
    const regUsers: any[] = JSON.parse(localStorage.getItem(LOCAL_REG_USERS_KEY) || '[]');
    const existing = regUsers.find((u) => u.email?.toLowerCase() === cleanEmail);
    if (!existing) {
      return { error: 'No account registered with this email address.' };
    }

    existing.otp = '123456';
    localStorage.setItem(LOCAL_REG_USERS_KEY, JSON.stringify(regUsers));
    return {};
  };

  /**
   * Forgot Password - Step 3: Updates user password after recovery OTP verified
   */
  const updatePassword = async (password: string): Promise<{ error?: string }> => {
    if (isLiveSupabase) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        return { error: error.message };
      }
      return {};
    }

    // Local Mock / Test Mode Flow
    if (user) {
      const regUsers: any[] = JSON.parse(localStorage.getItem(LOCAL_REG_USERS_KEY) || '[]');
      const existing = regUsers.find((u) => u.id === user.id);
      if (existing) {
        existing.password = password;
        localStorage.setItem(LOCAL_REG_USERS_KEY, JSON.stringify(regUsers));
      }
    }
    return {};
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
        verifyOtp,
        signInWithOtp,
        resendOtp,
        resetPassword,
        updatePassword,
        signOut,
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
