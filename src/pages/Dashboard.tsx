import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { vaultApi } from '../lib/supabase';
import { WarrantyItem } from '../types/database';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/warrantyUtils';
import {
  Shield,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Archive,
  FileText,
  Search,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<WarrantyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadData() {
      if (!user) return;
      try {
        setLoading(true);
        const data = await vaultApi.fetchWarranties(user.id);
        if (active) {
          setItems(data);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [user]);

  // Status Metrics
  const total = items.length;
  const activeCount = items.filter((i) => i.status === 'Active').length;
  const expiringCount = items.filter((i) => i.status === 'Expiring Soon').length;
  const expiredCount = items.filter((i) => i.status === 'Expired').length;

  // Nearest expiries (first 4 items that are not expired or soon to expire)
  const nearestExpiries = items
    .filter((i) => i.status !== 'Expired')
    .sort((a, b) => a.days_remaining - b.days_remaining)
    .slice(0, 5);

  const urgentItems = items.filter((i) => i.status === 'Expiring Soon');

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-8 h-8 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-mono text-xs uppercase tracking-wider text-[var(--mut)]">Opening your vault...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[var(--line)]">
        <div>
          <div className="eyebrow mb-1">Vault Overview</div>
          <h1 className="text-3xl sm:text-5xl font-serif text-[var(--ink)] leading-tight">
            Welcome, {user?.name || 'Vault Member'}.
          </h1>
          <p className="text-sm text-[var(--mut)] mt-1.5 font-sans">
            Here is the current state of your registered warranties, receipts, and claims.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/add" className="btn text-xs !py-2.5 !px-4">
            <Plus className="w-4 h-4" /> Add Warranty
          </Link>
          <Link to="/warranties" className="btn o text-xs !py-2.5 !px-4">
            <Archive className="w-4 h-4" /> Browse Vault
          </Link>
        </div>
      </div>

      {/* Urgency Alert if items are expiring soon */}
      {urgentItems.length > 0 && (
        <div className="p-4 sm:p-5 bg-[var(--a)]/15 border-2 border-[var(--a)] rounded shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-[var(--a)] text-[#16130F]">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-mono text-xs uppercase tracking-wider font-bold text-[var(--ink)]">
                Action Required: {urgentItems.length} {urgentItems.length === 1 ? 'warranty is' : 'warranties are'} expiring soon!
              </h4>
              <p className="text-xs text-[var(--mut)] font-sans mt-0.5">
                Check device conditions and claim servicing or replacements before coverage lapses.
              </p>
            </div>
          </div>
          <Link
            to="/warranties?status=Expiring%20Soon"
            className="btn sm !py-1.5 !px-3 !text-xs whitespace-nowrap bg-[var(--ink)] text-[var(--bg)]"
          >
            Review Items <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Link
          to="/warranties"
          className="vault-card p-5 sm:p-6 hover:-translate-y-1 transition duration-200 block"
        >
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--mut)] block mb-1">
            Total In Vault
          </span>
          <div className="text-3xl sm:text-5xl font-serif text-[var(--ink)] mb-2">{total}</div>
          <span className="text-[11px] font-mono text-[var(--mut)]">Across all categories</span>
        </Link>

        <Link
          to="/warranties?status=Active"
          className="vault-card p-5 sm:p-6 hover:-translate-y-1 transition duration-200 block border-l-4 border-l-[var(--g)]"
        >
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--g)] block mb-1">
            Active Cover
          </span>
          <div className="text-3xl sm:text-5xl font-serif text-[var(--g)] mb-2">{activeCount}</div>
          <span className="text-[11px] font-mono text-[var(--mut)]">Safely within warranty</span>
        </Link>

        <Link
          to="/warranties?status=Expiring%20Soon"
          className="vault-card p-5 sm:p-6 hover:-translate-y-1 transition duration-200 block border-l-4 border-l-[var(--a)]"
        >
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--a)] block mb-1">
            Expiring Soon
          </span>
          <div className="text-3xl sm:text-5xl font-serif text-[var(--a)] mb-2">{expiringCount}</div>
          <span className="text-[11px] font-mono text-[var(--mut)]">≤ 30 days remaining</span>
        </Link>

        <Link
          to="/warranties?status=Expired"
          className="vault-card p-5 sm:p-6 hover:-translate-y-1 transition duration-200 block border-l-4 border-l-[var(--r)]"
        >
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--r)] block mb-1">
            Expired
          </span>
          <div className="text-3xl sm:text-5xl font-serif text-[var(--r)] mb-2">{expiredCount}</div>
          <span className="text-[11px] font-mono text-[var(--mut)]">No longer covered</span>
        </Link>
      </div>

      {/* Main Content: Nearest Expiries + Quick Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Nearest Expiries Table (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-2xl text-[var(--ink)]">Next in Line to Expire</h3>
            <Link
              to="/warranties"
              className="text-xs font-mono uppercase tracking-wider text-[var(--mut)] hover:text-[var(--ink)] underline"
            >
              View Full Vault →
            </Link>
          </div>

          {nearestExpiries.length === 0 ? (
            <div className="vault-card p-10 text-center">
              <Archive className="w-8 h-8 text-[var(--mut)] mx-auto mb-3 opacity-60" />
              <p className="font-serif text-xl text-[var(--ink)]">No active warranties in vault.</p>
              <p className="text-xs text-[var(--mut)] font-mono mt-1 mb-4">
                Add your electronics, appliances, and tools to begin tracking.
              </p>
              <Link to="/add" className="btn sm !text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Your First Warranty
              </Link>
            </div>
          ) : (
            <div className="vault-card divide-y divide-[var(--line)] overflow-hidden">
              {nearestExpiries.map((item) => (
                <Link
                  key={item.id}
                  to={`/warranties/${item.id}`}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-[var(--bg)] transition block group"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif text-lg text-[var(--ink)] group-hover:text-[var(--g)] transition truncate">
                        {item.product.name}
                      </span>
                      {item.product.brand && (
                        <span className="text-xs font-mono text-[var(--mut)] px-1.5 py-0.5 bg-[var(--bg)] rounded border border-[var(--line)]">
                          {item.product.brand}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-[var(--mut)] flex items-center gap-3 flex-wrap">
                      <span>Expires: {formatDate(item.expiry_date)}</span>
                      <span>•</span>
                      <span>{item.documents?.length || 0} docs</span>
                      {item.product.category && (
                        <>
                          <span>•</span>
                          <span>{item.product.category}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge
                      status={item.status}
                      daysRemaining={item.days_remaining}
                      showDays={true}
                    />
                    <ArrowRight className="w-4 h-4 text-[var(--mut)] group-hover:translate-x-1 transition" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Tools & Tips Aside */}
        <div className="space-y-6">
          <div className="vault-card p-6 space-y-4">
            <h4 className="font-serif text-xl text-[var(--ink)]">Vault Protocol</h4>
            <div className="font-mono text-xs text-[var(--mut)] space-y-3 leading-relaxed">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--g)] shrink-0 mt-0.5" />
                <span>Private storage ensures invoices cannot be indexed or crawled.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--g)] shrink-0 mt-0.5" />
                <span>Expiry dates calculated automatically from purchase date + duration.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--g)] shrink-0 mt-0.5" />
                <span>Automated notices dispatched at 30, 15, and 7 days.</span>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--line)]">
              <Link
                to="/profile"
                className="text-xs font-mono text-[var(--ink)] underline hover:text-[var(--g)]"
              >
                Customize reminder thresholds →
              </Link>
            </div>
          </div>

          {/* Quick Add Promo Card */}
          <div className="p-6 bg-[var(--ink)] text-[var(--bg)] rounded border-2 border-[var(--ink)] shadow-brutal space-y-3">
            <h4 className="font-serif text-2xl">Bought something new?</h4>
            <p className="text-xs text-[var(--mut)] font-sans leading-relaxed">
              Snap the invoice or save the receipt immediately before it fades or gets lost in a drawer.
            </p>
            <Link to="/add" className="btn o sm !text-[var(--bg)] !border-[var(--bg)] w-full text-center">
              + New Warranty Entry
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

