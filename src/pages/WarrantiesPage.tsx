import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { vaultApi } from '../lib/supabase';
import { WarrantyItem, WarrantyStatus } from '../types/database';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/warrantyUtils';
import {
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  LayoutGrid,
  List as ListIcon,
  Archive,
  FileText,
  Calendar,
  Tag,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const WarrantiesPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<WarrantyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(searchParams.get('status') || 'All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('expiry-asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const s = searchParams.get('status');
    if (s) setSelectedStatus(s);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    async function loadData() {
      if (!user) return;
      try {
        setLoading(true);
        const data = await vaultApi.fetchWarranties(user.id);
        if (active) setItems(data);
      } catch (err) {
        console.error('Failed to load warranties:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [user]);

  // Extract unique categories & brands for filter dropdowns
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.product.category) set.add(i.product.category);
    });
    return Array.from(set).sort();
  }, [items]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.product.brand) set.add(i.product.brand);
    });
    return Array.from(set).sort();
  }, [items]);

  // Filter & Sort Logic
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Status filter
        if (selectedStatus !== 'All' && item.status !== selectedStatus) {
          return false;
        }
        // Category filter
        if (selectedCategory !== 'All' && item.product.category !== selectedCategory) {
          return false;
        }
        // Brand filter
        if (selectedBrand !== 'All' && item.product.brand !== selectedBrand) {
          return false;
        }
        // Search filter (name, brand, model, serial)
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchName = item.product.name.toLowerCase().includes(q);
          const matchBrand = (item.product.brand || '').toLowerCase().includes(q);
          const matchModel = (item.product.model || '').toLowerCase().includes(q);
          const matchSerial = (item.product.serial_no || '').toLowerCase().includes(q);
          const matchNotes = (item.coverage_notes || '').toLowerCase().includes(q);
          if (!matchName && !matchBrand && !matchModel && !matchSerial && !matchNotes) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'expiry-asc') {
          return a.days_remaining - b.days_remaining;
        } else if (sortBy === 'expiry-desc') {
          return b.days_remaining - a.days_remaining;
        } else if (sortBy === 'purchase-desc') {
          return new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime();
        } else if (sortBy === 'name-asc') {
          return a.product.name.localeCompare(b.product.name);
        }
        return 0;
      });
  }, [items, selectedStatus, selectedCategory, selectedBrand, searchTerm, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--line)]">
        <div>
          <div className="eyebrow mb-1">Vault Inventory</div>
          <h1 className="text-3xl sm:text-5xl font-serif text-[var(--ink)]">
            Products & Warranties
          </h1>
          <p className="text-xs sm:text-sm text-[var(--mut)] font-sans mt-1">
            Browse, search, and monitor all tracked devices and proof documents.
          </p>
        </div>

        <Link to="/add" className="btn text-xs !py-2.5 !px-4 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Add Warranty
        </Link>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="vault-card p-4 sm:p-6 space-y-4">
        {/* Search Input & Status Pills */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--mut)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name, brand, model, serial number..."
              className="vault-input pl-10 text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 font-mono text-xs">
            {['All', 'Active', 'Expiring Soon', 'Expired'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setSelectedStatus(status);
                  setSearchParams(status === 'All' ? {} : { status });
                }}
                className={`px-3 py-1.5 rounded transition uppercase tracking-wider cursor-pointer whitespace-nowrap border ${
                  selectedStatus === status
                    ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)] font-bold'
                    : 'bg-[var(--bg)] text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdowns & Layout Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[var(--line)] text-xs font-mono">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--mut)] uppercase tracking-wider">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] px-2.5 py-1 rounded"
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Brand Dropdown */}
            {brands.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--mut)] uppercase tracking-wider">Brand:</span>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] px-2.5 py-1 rounded"
                >
                  <option value="All">All Brands</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort Options */}
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--mut)] uppercase tracking-wider">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] px-2.5 py-1 rounded"
              >
                <option value="expiry-asc">Expires Soonest ↑</option>
                <option value="expiry-desc">Expires Latest ↓</option>
                <option value="purchase-desc">Purchased Most Recently</option>
                <option value="name-asc">Product Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Grid vs List View Toggle */}
          <div className="flex items-center gap-1 border border-[var(--line)] p-0.5 rounded bg-[var(--bg)]">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--mut)]'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition ${viewMode === 'list' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--mut)]'}`}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Count Banner */}
      <div className="flex items-center justify-between text-xs font-mono text-[var(--mut)]">
        <span>
          Showing {filteredItems.length} of {items.length} total warranties in vault
        </span>
        {(selectedStatus !== 'All' || selectedCategory !== 'All' || selectedBrand !== 'All' || searchTerm) && (
          <button
            onClick={() => {
              setSelectedStatus('All');
              setSelectedCategory('All');
              setSelectedBrand('All');
              setSearchTerm('');
              setSearchParams({});
            }}
            className="text-[var(--r)] underline cursor-pointer"
          >
            Reset all filters
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-mono text-xs uppercase tracking-wider text-[var(--mut)]">Filtering inventory...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        /* Empty State */
        <div className="vault-card p-12 text-center space-y-4">
          <Archive className="w-12 h-12 text-[var(--mut)] mx-auto opacity-50" />
          <h3 className="font-serif text-2xl text-[var(--ink)]">No matching warranties found</h3>
          <p className="text-xs sm:text-sm text-[var(--mut)] max-w-md mx-auto">
            Try adjusting your search query, status filters, or category selection to find what you're looking for.
          </p>
          <button
            onClick={() => {
              setSelectedStatus('All');
              setSelectedCategory('All');
              setSelectedBrand('All');
              setSearchTerm('');
              setSearchParams({});
            }}
            className="btn sm o !text-xs"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <Link
              key={item.id}
              to={`/warranties/${item.id}`}
              className="vault-card p-6 flex flex-col justify-between hover:-translate-y-1 transition duration-200 group block relative"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="font-mono text-[11px] text-[var(--mut)] uppercase tracking-wider px-2 py-0.5 bg-[var(--bg)] rounded border border-[var(--line)]">
                    {item.product.category || 'General'}
                  </span>
                  <StatusBadge status={item.status} daysRemaining={item.days_remaining} />
                </div>

                <h3 className="font-serif text-2xl text-[var(--ink)] group-hover:text-[var(--g)] transition leading-tight mb-1">
                  {item.product.name}
                </h3>

                {(item.product.brand || item.product.model) && (
                  <p className="text-xs font-mono text-[var(--mut)] mb-4">
                    {item.product.brand} {item.product.model && `• ${item.product.model}`}
                  </p>
                )}

                <div className="space-y-2 pt-3 border-t border-dashed border-[var(--line)] text-xs font-mono text-[var(--mut)]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Expiry:
                    </span>
                    <strong className="text-[var(--ink)]">{formatDate(item.expiry_date)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Duration:</span>
                    <span>{item.duration_months} Months</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Documents:</span>
                    <span>{item.documents?.length || 0} attached</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[var(--line)] flex items-center justify-between text-xs font-mono text-[var(--mut)] group-hover:text-[var(--ink)]">
                <span className="text-[11px]">
                  {item.days_remaining < 0
                    ? `Expired ${Math.abs(item.days_remaining)}d ago`
                    : item.days_remaining === 0
                    ? 'Expires today'
                    : `${item.days_remaining} days left`}
                </span>
                <span className="flex items-center gap-1 underline text-[var(--g)] font-semibold">
                  Inspect <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* List / Table View */
        <div className="vault-card divide-y divide-[var(--line)] overflow-hidden">
          {filteredItems.map((item) => (
            <Link
              key={item.id}
              to={`/warranties/${item.id}`}
              className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[var(--bg)] transition block group"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-serif text-xl text-[var(--ink)] group-hover:text-[var(--g)] transition truncate">
                    {item.product.name}
                  </span>
                  {item.product.brand && (
                    <span className="text-xs font-mono text-[var(--mut)] px-1.5 py-0.5 bg-[var(--bg)] rounded border border-[var(--line)]">
                      {item.product.brand}
                    </span>
                  )}
                  <span className="text-xs font-mono text-[var(--mut)] px-1.5 py-0.5 bg-[var(--bg)] rounded border border-[var(--line)]">
                    {item.product.category}
                  </span>
                </div>
                <div className="text-xs font-mono text-[var(--mut)] flex items-center gap-3 flex-wrap">
                  <span>Purchased: {formatDate(item.purchase_date)}</span>
                  <span>•</span>
                  <span>Expires: {formatDate(item.expiry_date)}</span>
                  <span>•</span>
                  <span>{item.documents?.length || 0} attached files</span>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
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
  );
};

