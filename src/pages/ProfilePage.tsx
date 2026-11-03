import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { vaultApi } from '../lib/supabase';
import { validateUserName } from '../lib/validation';
import { EmailNotificationPreferences, NotificationType } from '../types/database';
import {
  User,
  Shield,
  Bell,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Sun,
  Moon,
  Database,
  Mail,
  Send,
  Loader2,
  ShieldCheck,
  Clock,
  ShieldAlert,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, profile, updateUserProfile, theme, toggleTheme } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name || '');
  const [reminderDays, setReminderDays] = useState<number[]>(user?.reminder_days || [30, 15, 7]);
  const [newDayInput, setNewDayInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Email Notification Preferences State
  const [emailPrefs, setEmailPrefs] = useState<EmailNotificationPreferences>(() => {
    return (
      profile?.email_notifications ||
      user?.email_notifications || {
        warranty_started: true,
        expiring_soon: true,
        expired: true,
      }
    );
  });
  const [sendingTest, setSendingTest] = useState<NotificationType | null>(null);

  const handleAddDay = () => {
    const val = parseInt(newDayInput);
    if (isNaN(val) || val <= 0) {
      toast.error('Please enter a valid positive day count.');
      return;
    }
    if (val > 365) {
      toast.error('Reminder threshold cannot exceed 365 days.');
      return;
    }
    if (reminderDays.includes(val)) {
      toast.info(`Reminder at ${val} days is already set.`);
      return;
    }
    if (reminderDays.length >= 10) {
      toast.error('Maximum of 10 reminder thresholds allowed.');
      return;
    }

    const updated = [...reminderDays, val].sort((a, b) => b - a);
    setReminderDays(updated);
    setNewDayInput('');
  };

  const handleRemoveDay = (day: number) => {
    if (reminderDays.length <= 1) {
      toast.error('You must keep at least one reminder threshold.');
      return;
    }
    setReminderDays(reminderDays.filter((d) => d !== day));
  };

  const handleSendTestEmail = async (type: NotificationType) => {
    if (!user) return;
    try {
      setSendingTest(type);
      await vaultApi.sendTestEmail(user.id, user.email, type);
      const label =
        type === 'warranty_started'
          ? 'Coverage Activated'
          : type === 'expiring_soon'
          ? 'Expiring Soon'
          : 'Warranty Expired';
      toast.success(
        `Dispatched sample "${label}" email to ${user.email}. Check Reminders Center to view delivery preview!`
      );
    } catch (err: any) {
      toast.error('Failed to dispatch test email: ' + err.message);
    } finally {
      setSendingTest(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus(null);

    const nameCheck = validateUserName(name);
    if (!nameCheck.valid && nameCheck.error) {
      setSaveStatus({ success: false, message: nameCheck.error });
      toast.error(nameCheck.error, 'Invalid Name');
      setSaving(false);
      return;
    }

    const res = await updateUserProfile(name, reminderDays, emailPrefs);
    if (res.error) {
      setSaveStatus({ success: false, message: res.error });
      toast.error(res.error, 'Update Failed');
    } else {
      setSaveStatus({ success: true, message: 'Vault profile and email preferences updated successfully.' });
      toast.success('Vault profile and email preferences updated successfully.');
    }
    setSaving(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Header */}
      <div>
        <div className="eyebrow mb-1">Account & Preferences</div>
        <h1 className="text-3xl sm:text-5xl font-serif text-[var(--ink)]">
          Vault Custody Profile
        </h1>
        <p className="text-xs sm:text-sm text-[var(--mut)] font-sans mt-1">
          Manage your identity, automated email notification channels, and reminder thresholds.
        </p>
      </div>

      {saveStatus && (
        <div
          className={`p-4 rounded border text-xs font-mono flex items-center gap-2 ${
            saveStatus.success
              ? 'bg-[var(--g)]/10 border-[var(--g)] text-[var(--g)]'
              : 'bg-[var(--r)]/10 border-[var(--r)] text-[var(--r)]'
          }`}
        >
          {saveStatus.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{saveStatus.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* User Identity Card */}
        <div className="vault-card p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
            <h3 className="font-serif text-2xl text-[var(--ink)]">Identity & Access</h3>
            <span className="font-mono text-xs uppercase px-2 py-0.5 rounded border border-[var(--ink)] bg-[var(--bg)] font-semibold">
              Role: {user?.role || 'user'}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="vault-input"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1.5">
                Email Address (Authentication & Email Reminders)
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="vault-input opacity-70 cursor-not-allowed bg-[var(--line)]/30"
              />
              <p className="text-[11px] font-mono text-[var(--mut)] mt-1">
                Linked to Supabase Auth UUID: {user?.id}
              </p>
            </div>
          </div>
        </div>

        {/* Email Notification Channels & Automated Delivery */}
        <div className="vault-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-2xl text-[var(--ink)]">Email Notification Channels</h3>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-[var(--g)]/10 text-[var(--g)] border border-[var(--g)]/30 flex items-center gap-1 font-bold">
                  <Mail className="w-3 h-3" /> Live Delivery
                </span>
              </div>
              <p className="text-xs font-mono text-[var(--mut)] mt-0.5">
                Automated email notices dispatched to <strong>{user?.email || 'registered email'}</strong>
              </p>
            </div>
            <Mail className="w-5 h-5 text-[var(--g)] shrink-0" />
          </div>

          {/* Email Toggles */}
          <div className="space-y-3 font-mono text-xs">
            {/* Toggle 1: Warranty Started */}
            <label className="p-4 bg-[var(--bg)] border border-[var(--line)] rounded flex items-start justify-between gap-3 cursor-pointer hover:border-[var(--ink)] transition">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                  <ShieldCheck className="w-4 h-4 text-[var(--g)]" />
                  <span>Coverage Activated Confirmation</span>
                </div>
                <p className="text-[11px] text-[var(--mut)] font-normal">
                  Dispatches an email confirmation immediately when a new product warranty is activated, locking proof documents into the vault.
                </p>
              </div>
              <input
                type="checkbox"
                checked={emailPrefs.warranty_started}
                onChange={(e) =>
                  setEmailPrefs((prev) => ({ ...prev, warranty_started: e.target.checked }))
                }
                className="w-4 h-4 mt-1 accent-[var(--g)] cursor-pointer"
              />
            </label>

            {/* Toggle 2: Expiring Soon */}
            <label className="p-4 bg-[var(--bg)] border border-[var(--line)] rounded flex items-start justify-between gap-3 cursor-pointer hover:border-[var(--ink)] transition">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                  <Clock className="w-4 h-4 text-[var(--a)]" />
                  <span>Expiring Soon Reminder Nudges</span>
                </div>
                <p className="text-[11px] text-[var(--mut)] font-normal">
                  Dispatches actionable email alerts at your threshold days (30, 15, and 7 days prior), prompting you to inspect devices or file repair claims.
                </p>
              </div>
              <input
                type="checkbox"
                checked={emailPrefs.expiring_soon}
                onChange={(e) =>
                  setEmailPrefs((prev) => ({ ...prev, expiring_soon: e.target.checked }))
                }
                className="w-4 h-4 mt-1 accent-[var(--a)] cursor-pointer"
              />
            </label>

            {/* Toggle 3: Warranty Expired */}
            <label className="p-4 bg-[var(--bg)] border border-[var(--line)] rounded flex items-start justify-between gap-3 cursor-pointer hover:border-[var(--ink)] transition">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                  <ShieldAlert className="w-4 h-4 text-[#736B5E]" />
                  <span>Warranty Expiry Final Notice</span>
                </div>
                <p className="text-[11px] text-[var(--mut)] font-normal">
                  Dispatches an email notice on the exact day coverage lapses, retaining documents in your permanent archive for repair and tax history.
                </p>
              </div>
              <input
                type="checkbox"
                checked={emailPrefs.expired}
                onChange={(e) =>
                  setEmailPrefs((prev) => ({ ...prev, expired: e.target.checked }))
                }
                className="w-4 h-4 mt-1 accent-[#736B5E] cursor-pointer"
              />
            </label>
          </div>

          {/* Test Email Dispatch Sandbox */}
          <div className="p-4 bg-[var(--bg2)]/60 border border-dashed border-[var(--line)] rounded space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-[var(--ink)] font-bold">
                Test Email Templates Delivery
              </span>
              <span className="text-[11px] font-mono text-[var(--mut)]">
                Sends sample email to {user?.email}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSendTestEmail('warranty_started')}
                disabled={sendingTest !== null}
                className="btn sm o !text-xs !py-2 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {sendingTest === 'warranty_started' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--g)]" />
                )}
                <span>Test "Activated"</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendTestEmail('expiring_soon')}
                disabled={sendingTest !== null}
                className="btn sm o !text-xs !py-2 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {sendingTest === 'expiring_soon' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-[var(--a)]" />
                )}
                <span>Test "Expiring Soon"</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendTestEmail('expired')}
                disabled={sendingTest !== null}
                className="btn sm o !text-xs !py-2 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {sendingTest === 'expired' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-[#736B5E]" />
                )}
                <span>Test "Expired"</span>
              </button>
            </div>
          </div>
        </div>

        {/* Reminder Thresholds Configuration */}
        <div className="vault-card p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
            <div>
              <h3 className="font-serif text-2xl text-[var(--ink)]">Reminder Thresholds</h3>
              <p className="text-xs font-mono text-[var(--mut)] mt-0.5">
                Days before warranty expiry when the automated engine dispatches an email & in-app alert
              </p>
            </div>
            <Bell className="w-5 h-5 text-[var(--a)]" />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-2">
              Active Reminder Thresholds (Days Prior)
            </label>
            <div className="flex flex-wrap gap-2 mb-4">
              {reminderDays.map((day) => (
                <span
                  key={day}
                  className="font-mono text-xs px-3 py-1 bg-[var(--bg)] border border-[var(--ink)] rounded flex items-center gap-2"
                >
                  <strong className="text-[var(--ink)]">{day} days</strong>
                  <button
                    type="button"
                    onClick={() => handleRemoveDay(day)}
                    className="text-[var(--mut)] hover:text-[var(--r)] cursor-pointer"
                    title={`Remove ${day} days reminder`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add new threshold day */}
            <div className="flex items-center gap-2 max-w-xs">
              <input
                type="number"
                min="1"
                max="365"
                placeholder="e.g. 60 or 45"
                value={newDayInput}
                onChange={(e) => setNewDayInput(e.target.value)}
                className="vault-input text-xs !py-2"
              />
              <button
                type="button"
                onClick={handleAddDay}
                className="btn sm o !text-xs !py-2 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Day
              </button>
            </div>
          </div>
        </div>

        {/* System & Backend Info */}
        <div className="vault-card p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
            <h3 className="font-serif text-2xl text-[var(--ink)]">Environment & Interface</h3>
            <Database className="w-5 h-5 text-[var(--g)]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 bg-[var(--bg)] rounded border border-[var(--line)]">
              <span className="text-[var(--mut)] uppercase block mb-1">Backend Connection</span>
              <strong className={vaultApi.isConfigured() ? 'text-[var(--g)]' : 'text-[var(--a)]'}>
                {vaultApi.isConfigured()
                  ? 'Live Supabase Cloud Connected'
                  : 'Local Demo Vault (In-Memory / LocalStorage)'}
              </strong>
            </div>

            <div className="p-3 bg-[var(--bg)] rounded border border-[var(--line)] flex items-center justify-between">
              <div>
                <span className="text-[var(--mut)] uppercase block mb-1">Interface Theme</span>
                <strong className="capitalize text-[var(--ink)]">{theme} Mode</strong>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="btn sm o !p-1.5 cursor-pointer"
                title="Toggle Theme"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn !py-3 !px-8 text-xs cursor-pointer"
          >
            {saving ? 'Updating Vault...' : 'Save Profile & Email Preferences'}
          </button>
        </div>
      </form>
    </div>
  );
};
