import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { vaultApi } from '../lib/supabase';
import { AdminStats } from '../types/database';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Users,
  Archive,
  FileText,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadStats() {
      if (user?.role !== 'admin') {
        setError('Access denied. Administrator role is required to query system metrics.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await vaultApi.getAdminStats();
        if (active) setStats(data);
      } catch (err: any) {
        if (active) setError(err.message || 'Failed to retrieve admin aggregate stats');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadStats();
    return () => {
      active = false;
    };
  }, [user]);

  // Non-admin block
  if (user?.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-[var(--r)]/20 text-[var(--r)] flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="font-serif text-3xl text-[var(--ink)]">Restricted Area</h2>
        <p className="text-xs sm:text-sm text-[var(--mut)] font-mono max-w-md mx-auto">
          This terminal is restricted to vault administrators. Your role is: <strong>{user?.role || 'anonymous'}</strong>.
        </p>
        <Link to="/dashboard" className="btn sm !text-xs inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Return to Safe Ground
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-8 h-8 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="font-mono text-xs uppercase tracking-wider text-[var(--mut)]">
          Querying SECURITY DEFINER aggregate statistics...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--line)]">
        <div>
          <div className="eyebrow mb-1 text-[var(--a)] flex items-center gap-1.5 font-bold">
            <ShieldCheck className="w-4 h-4" /> System Administrator Terminal
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif text-[var(--ink)]">
            Aggregate Metrics & System Health
          </h1>
          <p className="text-xs sm:text-sm text-[var(--mut)] font-sans mt-1">
            High-level counts served through Postgres function <code className="font-mono">get_admin_stats()</code>.
          </p>
        </div>

        <div className="font-mono text-xs px-3 py-1 bg-[var(--a)]/20 border border-[var(--a)] text-[var(--ink)] rounded self-start sm:self-auto">
          Audited by RLS Policies
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[var(--r)]/10 border border-[var(--r)] text-[var(--r)] text-xs font-mono rounded">
          {error}
        </div>
      )}

      {/* Security Privacy Notice */}
      <div className="p-5 bg-[#0E0C0A] text-[#ECE6D8] rounded border border-[rgba(236,230,216,0.2)] shadow-brutal flex items-start gap-4">
        <div className="p-2 rounded bg-[#1D1A16] text-[#4CC38A] shrink-0 mt-0.5">
          <Lock className="w-5 h-5" />
        </div>
        <div className="text-xs font-mono space-y-1">
          <h4 className="font-bold text-[#4CC38A] uppercase tracking-wider">
            Zero Document Leakage Guarantee
          </h4>
          <p className="text-[#A39B8E] leading-relaxed">
            By system architecture and Row Level Security, this view exposes aggregate counts only.
            Admins have <strong>no access</strong> to user invoice files, signed URLs, or raw user attachments.
          </p>
        </div>
      </div>

      {/* Aggregate Counts */}
      {stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="vault-card p-6">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--mut)] block mb-1">
                Total Users
              </span>
              <div className="text-4xl sm:text-5xl font-serif text-[var(--ink)] mb-1">
                {stats.total_users}
              </div>
              <span className="text-[11px] font-mono text-[var(--mut)]">Registered Vaults</span>
            </div>

            <div className="vault-card p-6">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--mut)] block mb-1">
                Total Products
              </span>
              <div className="text-4xl sm:text-5xl font-serif text-[var(--ink)] mb-1">
                {stats.total_products}
              </div>
              <span className="text-[11px] font-mono text-[var(--mut)]">Tracked Devices</span>
            </div>

            <div className="vault-card p-6">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--mut)] block mb-1">
                Total Warranties
              </span>
              <div className="text-4xl sm:text-5xl font-serif text-[var(--ink)] mb-1">
                {stats.total_warranties}
              </div>
              <span className="text-[11px] font-mono text-[var(--mut)]">Policies Recorded</span>
            </div>

            <div className="vault-card p-6">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--mut)] block mb-1">
                Private Documents
              </span>
              <div className="text-4xl sm:text-5xl font-serif text-[var(--ink)] mb-1">
                {stats.total_documents}
              </div>
              <span className="text-[11px] font-mono text-[var(--g)]">Sealed in Private Bucket</span>
            </div>
          </div>

          {/* Warranty Status Distribution */}
          <div className="vault-card p-6 sm:p-8 space-y-4">
            <h3 className="font-serif text-2xl text-[var(--ink)]">Warranty Status Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-4 bg-[var(--bg)] rounded border-l-4 border-l-[var(--g)] border-[var(--line)]">
                <span className="text-[var(--mut)] uppercase block mb-1">Active Coverage</span>
                <div className="text-3xl font-serif text-[var(--g)] mb-1">{stats.active_warranties}</div>
                <span className="text-[11px] text-[var(--mut)]">Safe (&gt; 30 days left)</span>
              </div>

              <div className="p-4 bg-[var(--bg)] rounded border-l-4 border-l-[var(--a)] border-[var(--line)]">
                <span className="text-[var(--mut)] uppercase block mb-1">Expiring Soon</span>
                <div className="text-3xl font-serif text-[var(--a)] mb-1">{stats.expiring_soon_warranties}</div>
                <span className="text-[11px] text-[var(--mut)]">Within reminder window (≤ 30 days)</span>
              </div>

              <div className="p-4 bg-[var(--bg)] rounded border-l-4 border-l-[var(--r)] border-[var(--line)]">
                <span className="text-[var(--mut)] uppercase block mb-1">Expired</span>
                <div className="text-3xl font-serif text-[var(--r)] mb-1">{stats.expired_warranties}</div>
                <span className="text-[11px] text-[var(--mut)]">Lapsed coverage (&lt; 0 days)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

