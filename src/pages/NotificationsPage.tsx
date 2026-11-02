import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { vaultApi } from '../lib/supabase';
import { WarrantyNotification } from '../types/database';
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
  Inbox,
  Loader2,
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [notifications, setNotifications] = useState<WarrantyNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

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

  const filteredNotifs = notifications.filter((n) => (filter === 'unread' ? !n.is_read : true));
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--line)]">
        <div>
          <div className="eyebrow mb-1">Alerts & Reminders</div>
          <h1 className="text-3xl sm:text-5xl font-serif text-[var(--ink)]">
            Reminders Center
          </h1>
          <p className="text-xs sm:text-sm text-[var(--mut)] mt-1 font-sans">
            Automatic nudges dispatched at your configured thresholds (30, 15, and 7 days).
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAllRead}
            className="btn o sm !text-xs self-start sm:self-auto flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {markingAllRead ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCheck className="w-3.5 h-3.5" />
            )}
            <span>{markingAllRead ? 'Marking All Read...' : 'Mark All as Read'}</span>
          </button>
        )}
      </div>

      {/* Filter Tabs & Count */}
      <div className="flex items-center justify-between font-mono text-xs">
        <div className="flex items-center gap-2">
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
        </div>

        <Link
          to="/profile"
          className="text-[var(--mut)] hover:text-[var(--ink)] underline hidden sm:inline"
        >
          Manage notification thresholds →
        </Link>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-mono text-xs uppercase tracking-wider text-[var(--mut)]">Loading reminders...</p>
        </div>
      ) : filteredNotifs.length === 0 ? (
        <div className="vault-card p-12 text-center space-y-3">
          <Inbox className="w-10 h-10 text-[var(--mut)] mx-auto opacity-50" />
          <h3 className="font-serif text-2xl text-[var(--ink)]">
            {filter === 'unread' ? 'No unread reminders' : 'Your inbox is clear'}
          </h3>
          <p className="text-xs sm:text-sm text-[var(--mut)] font-mono max-w-sm mx-auto">
            WarrantyVault monitors the calendar daily and alerts you whenever a warranty approaches expiry.
          </p>
        </div>
      ) : (
        <div className="vault-card divide-y divide-[var(--line)] overflow-hidden">
          {filteredNotifs.map((n) => (
            <div
              key={n.id}
              className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                !n.is_read ? 'bg-[var(--a)]/10 font-medium' : 'hover:bg-[var(--bg)]'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`p-2 rounded mt-0.5 shrink-0 ${
                    !n.is_read ? 'bg-[var(--a)] text-[#16130F]' : 'bg-[var(--line)] text-[var(--mut)]'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-lg text-[var(--ink)]">
                      {n.product_name || 'Warranty Alert'}
                    </span>
                    {!n.is_read && (
                      <span className="bg-[var(--a)] text-[#16130F] text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-bold">
                        Unread
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--mut)] font-mono">
                    Warranty threshold triggered on {formatDate(n.reminder_date)}. Check your warranty terms before coverage expires.
                  </p>
                  <div className="text-[10px] font-mono text-[var(--mut)] opacity-70">
                    Dispatched {new Date(n.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto shrink-0 font-mono text-xs">
                {!n.is_read && (
                  <button
                    onClick={() => handleMarkAsRead(n.id)}
                    disabled={markingId === n.id}
                    className="text-[var(--mut)] hover:text-[var(--ink)] underline cursor-pointer disabled:opacity-50"
                  >
                    {markingId === n.id ? 'Marking...' : 'Mark as read'}
                  </button>
                )}
                <Link
                  to={`/warranties/${n.warranty_id}`}
                  className="btn sm !py-1 !px-3 !text-xs flex items-center gap-1"
                >
                  <span>View Warranty</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

