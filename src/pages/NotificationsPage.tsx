import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { vaultApi } from '../lib/supabase';
import { WarrantyNotification, NotificationType } from '../types/database';
import { formatDate } from '../lib/warrantyUtils';
import { useToast } from '../context/ToastContext';
import { logger } from '../lib/logger';
import {
  Bell,
  CheckCircle2,
  CheckCheck,
  Clock,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Eye,
  X,
  Send,
  ExternalLink,
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [notifications, setNotifications] = useState<WarrantyNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingReminders, setCheckingReminders] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | NotificationType>('all');

  // Email Preview Modal State
  const [selectedNotifForEmail, setSelectedNotifForEmail] = useState<WarrantyNotification | null>(null);
  const [emailTab, setEmailTab] = useState<'html' | 'text'>('html');

  const loadNotifications = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await vaultApi.fetchNotifications(user.id);
      setNotifications(data);
    } catch (err) {
      logger.error('Failed to load notifications:', err);
      toast.error('Failed to refresh reminders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user]);

  // Run Reminder Check & Dispatch Emails on demand
  const handleCheckReminders = async () => {
    if (!user) return;
    try {
      setCheckingReminders(true);
      const result = await vaultApi.checkAndDispatchReminders(user.id, user.email);
      setNotifications(result.notifications);

      if (result.dispatchedCount > 0) {
        toast.success(
          `Evaluated ${result.checked} warranties: Dispatched ${result.dispatchedCount} email reminder notice(s) to ${user.email}.`
        );
      } else {
        toast.info(
          `All ${result.checked} warranties evaluated. No new reminder thresholds triggered for today.`
        );
      }
    } catch (err: any) {
      logger.error('Reminder check failed:', err);
      toast.error(err.message || 'Failed to execute reminder check.');
    } finally {
      setCheckingReminders(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      setMarkingId(id);
      await vaultApi.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, status: 'read' } : n))
      );
      toast.success('Reminder marked as read.');
    } catch (err: any) {
      logger.error('Failed to mark notification read:', err);
      toast.error(err.message || 'Failed to update reminder.');
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      setMarkingAllRead(true);
      await vaultApi.markAllNotificationsAsRead(user.id);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, status: 'read' }))
      );
      toast.success('All reminders marked as read.');
    } catch (err: any) {
      logger.error('Failed to mark all read:', err);
      toast.error(err.message || 'Failed to mark reminders as read.');
    } finally {
      setMarkingAllRead(false);
    }
  };

  const filteredNotifs = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.is_read;
    return n.type === filter;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--line)]">
        <div>
          <div className="eyebrow mb-1">Alerts & Email Reminders</div>
          <h1 className="text-3xl sm:text-5xl font-serif text-[var(--ink)]">
            Reminders Center
          </h1>
          <p className="text-xs sm:text-sm text-[var(--mut)] mt-1 font-sans">
            Automated email nudges dispatched when warranties start, approach expiry (30, 15, 7 days), or expire.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleCheckReminders}
            disabled={checkingReminders}
            className="btn sm !text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Scan warranties and dispatch any due reminder emails"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingReminders ? 'animate-spin' : ''}`} />
            <span>{checkingReminders ? 'Evaluating...' : 'Check & Dispatch Reminders'}</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAllRead}
              className="btn o sm !text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {markingAllRead ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5" />
              )}
              <span>{markingAllRead ? 'Marking...' : 'Mark All Read'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Email Engine Info Banner */}
      <div className="p-4 bg-[var(--bg)] border border-[var(--line)] rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 text-[var(--ink)]">
          <Mail className="w-4 h-4 text-[var(--g)] shrink-0" />
          <span>
            Active Delivery: <strong>{user?.email || 'member@warrantyvault.app'}</strong> • Thresholds:{' '}
            {(user?.reminder_days || [30, 15, 7]).join(', ')} days
          </span>
        </div>
        <Link
          to="/profile"
          className="text-[var(--g)] hover:underline shrink-0 flex items-center gap-1"
        >
          <span>Email Preferences & Thresholds</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Filter Tabs & Count */}
      <div className="flex items-center justify-between font-mono text-xs overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded transition uppercase tracking-wider cursor-pointer border ${
              filter === 'all'
                ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)] font-bold'
                : 'bg-[var(--bg)] text-[var(--mut)] border-[var(--line)]'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded transition uppercase tracking-wider cursor-pointer border ${
              filter === 'unread'
                ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)] font-bold'
                : 'bg-[var(--bg)] text-[var(--mut)] border-[var(--line)]'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setFilter('warranty_started')}
            className={`px-2.5 py-1.5 rounded transition uppercase tracking-wider cursor-pointer border ${
              filter === 'warranty_started'
                ? 'bg-[var(--g)] text-white border-[var(--g)] font-bold'
                : 'bg-[var(--bg)] text-[var(--mut)] border-[var(--line)]'
            }`}
          >
            Activated
          </button>
          <button
            onClick={() => setFilter('expiring_soon')}
            className={`px-2.5 py-1.5 rounded transition uppercase tracking-wider cursor-pointer border ${
              filter === 'expiring_soon'
                ? 'bg-[var(--a)] text-white border-[var(--a)] font-bold'
                : 'bg-[var(--bg)] text-[var(--mut)] border-[var(--line)]'
            }`}
          >
            Expiring Soon
          </button>
          <button
            onClick={() => setFilter('expired')}
            className={`px-2.5 py-1.5 rounded transition uppercase tracking-wider cursor-pointer border ${
              filter === 'expired'
                ? 'bg-[#736B5E] text-white border-[#736B5E] font-bold'
                : 'bg-[var(--bg)] text-[var(--mut)] border-[var(--line)]'
            }`}
          >
            Expired
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-mono text-xs uppercase tracking-wider text-[var(--mut)]">Loading reminders & notices...</p>
        </div>
      ) : filteredNotifs.length === 0 ? (
        <div className="vault-card p-12 text-center space-y-3">
          <Inbox className="w-10 h-10 text-[var(--mut)] mx-auto opacity-50" />
          <h3 className="font-serif text-2xl text-[var(--ink)]">
            {filter === 'unread' ? 'No unread reminders' : 'No notifications in this filter'}
          </h3>
          <p className="text-xs sm:text-sm text-[var(--mut)] font-mono max-w-sm mx-auto">
            WarrantyVault monitors the calendar daily and automatically dispatches email reminders when coverage starts or approaches expiry.
          </p>
        </div>
      ) : (
        <div className="vault-card divide-y divide-[var(--line)] overflow-hidden">
          {filteredNotifs.map((n) => {
            const isStarted = n.type === 'warranty_started';
            const isExpiring = n.type === 'expiring_soon' || !n.type;
            const isExpired = n.type === 'expired';

            return (
              <div
                key={n.id}
                className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                  !n.is_read ? 'bg-[var(--a)]/10 font-medium' : 'hover:bg-[var(--bg)]'
                }`}
              >
                <div className="flex items-start gap-3.5 truncate">
                  <div
                    className={`p-2.5 rounded shrink-0 border ${
                      isStarted
                        ? 'bg-[var(--g)]/15 border-[var(--g)]/40 text-[var(--g)]'
                        : isExpired
                        ? 'bg-[#736B5E]/15 border-[#736B5E]/40 text-[#736B5E]'
                        : 'bg-[var(--a)]/15 border-[var(--a)]/40 text-[var(--a)]'
                    }`}
                  >
                    {isStarted ? (
                      <ShieldCheck className="w-4 h-4" />
                    ) : isExpired ? (
                      <ShieldAlert className="w-4 h-4" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                  </div>

                  <div className="space-y-1.5 truncate">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif text-lg text-[var(--ink)]">
                        {n.title || n.product_name || 'Warranty Alert'}
                      </span>

                      {/* Type Badge */}
                      {isStarted && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-[#E9F5EE] text-[#1F7A4D] border border-[#1F7A4D]/30 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Activated
                        </span>
                      )}
                      {isExpiring && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-[#FFF0EB] text-[#FF5C35] border border-[#FF5C35]/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Expiring Soon
                        </span>
                      )}
                      {isExpired && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-[#F3F0EB] text-[#736B5E] border border-[#736B5E]/30 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> Expired
                        </span>
                      )}

                      {!n.is_read && (
                        <span className="bg-[var(--a)] text-[#16130F] text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-bold">
                          Unread
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[var(--mut)] font-mono leading-relaxed line-clamp-2">
                      {n.message || `Warranty threshold triggered on ${formatDate(n.reminder_date)}.`}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-[var(--mut)] pt-0.5">
                      <span className="inline-flex items-center gap-1 text-[var(--g)]">
                        <Mail className="w-3 h-3" />
                        <span>Email sent to {n.email_to || user?.email || 'registered email'}</span>
                      </span>
                      <span>•</span>
                      <span>Dispatched {formatDate(n.sent_at.split('T')[0])}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNotifForEmail(n);
                      setEmailTab('html');
                    }}
                    className="btn sm o !py-1 !px-2.5 !text-xs flex items-center gap-1 cursor-pointer"
                    title="Inspect the exact email template dispatched for this notification"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Email</span>
                  </button>

                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(n.id)}
                      disabled={markingId === n.id}
                      className="text-[var(--mut)] hover:text-[var(--ink)] underline cursor-pointer disabled:opacity-50 px-1"
                    >
                      {markingId === n.id ? 'Marking...' : 'Mark read'}
                    </button>
                  )}

                  <Link
                    to={`/warranties/${n.warranty_id}`}
                    className="btn sm !py-1 !px-3 !text-xs flex items-center gap-1"
                  >
                    <span>View Vault</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Email Template Preview Modal */}
      {selectedNotifForEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="vault-card max-w-2xl w-full max-h-[90vh] flex flex-col bg-[var(--bg)] border-2 border-[var(--ink)] shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg2)]/50">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[var(--g)]" />
                <div>
                  <h3 className="font-serif text-xl text-[var(--ink)]">Delivered Email Notice</h3>
                  <p className="text-[11px] font-mono text-[var(--mut)]">
                    Dispatched via WarrantyVault Automated Notification Engine
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedNotifForEmail(null)}
                className="p-1 rounded text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email Meta Bar */}
            <div className="p-4 bg-[var(--bg)] border-b border-[var(--line)] font-mono text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[var(--mut)]">To:</span>
                <span className="font-semibold text-[var(--ink)]">
                  {selectedNotifForEmail.email_to || user?.email || 'member@warrantyvault.app'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--mut)]">From:</span>
                <span className="text-[var(--ink)]">WarrantyVault &lt;reminders@warrantyvault.app&gt;</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--mut)]">Subject:</span>
                <span className="font-semibold text-[var(--ink)]">
                  {selectedNotifForEmail.email_subject || selectedNotifForEmail.title}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[var(--line)]/50">
                <span className="text-[var(--mut)]">Dispatched At:</span>
                <span className="text-[var(--mut)]">{selectedNotifForEmail.sent_at}</span>
                <span className="text-[var(--g)] font-bold uppercase text-[10px]">
                  Status: {selectedNotifForEmail.email_status || 'Delivered'}
                </span>
              </div>
            </div>

            {/* View Mode Tabs */}
            <div className="px-5 pt-3 pb-2 border-b border-[var(--line)] flex items-center gap-2 font-mono text-xs bg-[var(--bg2)]/30">
              <button
                onClick={() => setEmailTab('html')}
                className={`px-3 py-1 rounded text-xs transition cursor-pointer border ${
                  emailTab === 'html'
                    ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)] font-bold'
                    : 'bg-[var(--bg)] text-[var(--mut)] border-[var(--line)]'
                }`}
              >
                Rendered HTML View
              </button>
              <button
                onClick={() => setEmailTab('text')}
                className={`px-3 py-1 rounded text-xs transition cursor-pointer border ${
                  emailTab === 'text'
                    ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)] font-bold'
                    : 'bg-[var(--bg)] text-[var(--mut)] border-[var(--line)]'
                }`}
              >
                Plain Text View
              </button>
            </div>

            {/* Email Body Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#FAF8F5]">
              {emailTab === 'html' ? (
                selectedNotifForEmail.email_html ? (
                  <div
                    className="border border-[#E5E0D8] rounded shadow-sm bg-white p-4"
                    dangerouslySetInnerHTML={{ __html: selectedNotifForEmail.email_html }}
                  />
                ) : (
                  <div className="border-2 border-[#16130F] p-6 bg-white shadow-[4px_4px_0px_#16130F] max-w-lg mx-auto space-y-4">
                    <div className="flex justify-between items-center border-b-2 border-[#16130F] pb-3 font-mono text-xs">
                      <strong>⚿ WARRANTYVAULT</strong>
                      <span className="px-2 py-0.5 font-bold uppercase bg-[#E9F5EE] text-[#1F7A4D] rounded">
                        {selectedNotifForEmail.type || 'NOTIFICATION'}
                      </span>
                    </div>
                    <h2 className="font-serif text-2xl text-[#16130F]">
                      {selectedNotifForEmail.title}
                    </h2>
                    <p className="text-sm text-[#4A443A] leading-relaxed">
                      {selectedNotifForEmail.message}
                    </p>
                    <div className="p-3 bg-[#FAF8F5] border border-[#E5E0D8] font-mono text-xs space-y-1">
                      <div>Product: <strong>{selectedNotifForEmail.product_name}</strong></div>
                      <div>Trigger Date: <strong>{formatDate(selectedNotifForEmail.reminder_date)}</strong></div>
                    </div>
                    <div className="text-center pt-2">
                      <Link
                        to={`/warranties/${selectedNotifForEmail.warranty_id}`}
                        className="inline-block px-5 py-2.5 bg-[#16130F] text-[#FAF8F5] font-mono text-xs uppercase font-bold"
                      >
                        Open In Vault &rarr;
                      </Link>
                    </div>
                  </div>
                )
              ) : (
                <pre className="font-mono text-xs text-[var(--ink)] whitespace-pre-wrap p-4 bg-[var(--bg)] border border-[var(--line)] rounded">
                  {`WARRANTYVAULT | ${selectedNotifForEmail.type?.toUpperCase() || 'NOTIFICATION'}\n\n${selectedNotifForEmail.title}\n\n${selectedNotifForEmail.message}\n\nProduct: ${selectedNotifForEmail.product_name}\nDate: ${formatDate(selectedNotifForEmail.reminder_date)}\nDirect Link: https://warrantyvault.app/warranties/${selectedNotifForEmail.warranty_id}\n\n--\nWarrantyVault Automated Engine • Delivered to ${selectedNotifForEmail.email_to || user?.email}`}
                </pre>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--line)] flex justify-between items-center bg-[var(--bg2)]/50">
              <span className="text-[11px] font-mono text-[var(--mut)]">
                Recipients receive automated nudges at 30, 15, and 7 days.
              </span>
              <button
                onClick={() => setSelectedNotifForEmail(null)}
                className="btn sm !px-6 text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
