import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home, Search } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full vault-card p-8 sm:p-10 text-center space-y-6">
        <div className="w-14 h-14 rounded-full bg-[var(--a)]/15 border border-[var(--a)] text-[var(--a)] flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--mut)]">
            404 · Unregistered Route
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[var(--ink)] leading-tight">
            This compartment doesn’t exist.
          </h1>
          <p className="font-sans text-xs sm:text-sm text-[var(--mut)] leading-relaxed">
            The link you followed leads to an unmapped vault sector. The item may have been moved, deleted, or entered incorrectly.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/dashboard"
            className="btn sm w-full sm:w-auto inline-flex items-center justify-center gap-1.5 !text-xs"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Open Dashboard</span>
          </Link>
          <Link
            to="/warranties"
            className="btn o sm w-full sm:w-auto inline-flex items-center justify-center gap-1.5 !text-xs"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Browse Vault</span>
          </Link>
        </div>

        <div className="pt-4 border-t border-[var(--line)]">
          <Link
            to="/"
            className="text-xs font-mono uppercase tracking-wider text-[var(--mut)] hover:text-[var(--ink)] inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
};

