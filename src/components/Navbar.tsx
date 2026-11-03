import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { vaultApi } from '../lib/supabase';
import { logger } from '../lib/logger';
import {
  Bell,
  Moon,
  Sun,
  Plus,
  LogOut,
  User,
  LayoutDashboard,
  Archive,
  ShieldAlert,
  Menu,
  X,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, signOut, theme, toggleTheme } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchUnread = async () => {
      if (!user) return;
      try {
        const notifs = await vaultApi.fetchNotifications(user.id);
        if (active) {
          setUnreadCount(notifs.filter((n) => !n.is_read).length);
        }
      } catch (e) {
        logger.warn('Could not fetch notifications:', e);
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user, location.pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isLanding = location.pathname === '/';
  const isAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);

  return (
    <>
      <nav className="ref-nav" aria-label="Main Navigation">
        {/* Vault Logo matching Reference SVG */}
        <Link className="logo shrink-0" to={user && !isLanding ? "/dashboard" : "/"}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
            <rect x="1" y="1" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="10" cy="8.5" r="2.4" fill="currentColor" />
            <path d="M10 10v5" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <span className="font-bold tracking-wider">WarrantyVault</span>
        </Link>

        {/* Navigation links & controls */}
        <div className="links shrink-0">
          {isLanding ? (
            <>
              {/* Desktop links */}
              <div className="hidden md:flex items-center gap-6">
                <a href="/#story">The clock</a>
                <a href="/#features">Features</a>
                <a href="/#how">How it works</a>
                <Link className="btn o sm !py-1.5 !px-3.5 !text-xs whitespace-nowrap" to="/login">
                  Sign in
                </Link>
                <Link className="btn sm !py-1.5 !px-3.5 !text-xs whitespace-nowrap" to="/register">
                  Get started
                </Link>
              </div>

              {/* Mobile controls: clean, compact Sign In link (Get Started is in mobile menu & hero) */}
              <div className="flex md:hidden items-center gap-1.5">
                <Link
                  to="/login"
                  className="text-xs font-mono uppercase tracking-wider text-[var(--ink)] px-2.5 py-1.5 border border-[var(--line)] rounded hover:bg-[var(--bg2)] whitespace-nowrap"
                >
                  Sign in
                </Link>
              </div>
            </>
          ) : isAuthPage ? (
            <div className="flex items-center gap-2">
              {location.pathname !== '/login' ? (
                <Link
                  to="/login"
                  className="text-xs font-mono uppercase tracking-wider text-[var(--ink)] px-2.5 py-1.5 border border-[var(--line)] rounded hover:bg-[var(--bg2)] whitespace-nowrap"
                >
                  Sign in
                </Link>
              ) : (
                <Link
                  to="/register"
                  className="text-xs font-mono uppercase tracking-wider text-[var(--ink)] px-2.5 py-1.5 border border-[var(--line)] rounded hover:bg-[var(--bg2)] whitespace-nowrap"
                >
                  Register
                </Link>
              )}
            </div>
          ) : user ? (
            <>
              <div className="hidden md:flex items-center gap-6">
                <Link
                  to="/dashboard"
                  className={`flex items-center gap-1.5 font-mono text-[0.78rem] uppercase tracking-wider transition ${
                    location.pathname === '/dashboard' ? 'text-[var(--g)] font-bold' : 'text-[var(--ink)] hover:text-[var(--g)]'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </Link>

                <Link
                  to="/warranties"
                  className={`flex items-center gap-1.5 font-mono text-[0.78rem] uppercase tracking-wider transition ${
                    location.pathname === '/warranties' ? 'text-[var(--g)] font-bold' : 'text-[var(--ink)] hover:text-[var(--g)]'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Vault</span>
                </Link>

                <Link
                  to="/add"
                  className="btn sm !py-1.5 !px-3 !text-[11px] flex items-center gap-1"
                  title="Add new warranty"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Warranty</span>
                </Link>

                {/* Notifications Link with Live Unread Badge */}
                <Link
                  to="/notifications"
                  className="relative p-1.5 text-[var(--mut)] hover:text-[var(--ink)] transition"
                  title="Reminders & Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[var(--a)] text-[#16130F] text-[10px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center border border-[var(--ink)]">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Admin Link if role is admin */}
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className={`flex items-center gap-1 font-mono text-xs uppercase tracking-wider px-2 py-1 border border-dashed border-[var(--a)] rounded ${
                      location.pathname === '/admin' ? 'bg-[var(--a)] text-[#16130F] font-bold' : 'text-[var(--a)] hover:bg-[var(--a)]/10'
                    }`}
                    title="Admin aggregate metrics"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Admin</span>
                  </Link>
                )}

                {/* Profile Link */}
                <Link
                  to="/profile"
                  className={`p-1.5 text-[var(--mut)] hover:text-[var(--ink)] transition ${
                    location.pathname === '/profile' ? 'text-[var(--ink)]' : ''
                  }`}
                  title={`Signed in as ${user.name}`}
                >
                  <User className="w-4 h-4" />
                </Link>

                {/* Sign Out */}
                <button
                  onClick={() => {
                    signOut();
                    navigate('/');
                  }}
                  className="p-1.5 text-[var(--mut)] hover:text-[var(--r)] transition cursor-pointer"
                  title="Sign out of vault"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Header icons on mobile for authenticated user */}
              <div className="flex md:hidden items-center gap-1">
                <Link
                  to="/notifications"
                  className="relative p-2 text-[var(--mut)] hover:text-[var(--ink)] transition"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 bg-[var(--a)] text-[#16130F] text-[9px] font-mono font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center border border-[var(--ink)]">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-xs font-mono uppercase tracking-wider text-[var(--ink)] px-2.5 py-1.5 border border-[var(--line)] rounded hover:bg-[var(--bg2)] whitespace-nowrap"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="hidden md:inline-block text-xs font-mono uppercase tracking-wider bg-[var(--ink)] text-[var(--bg)] px-3 py-1.5 border border-[var(--ink)] rounded whitespace-nowrap"
              >
                Get started
              </Link>
            </div>
          )}

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-1.5 text-[var(--mut)] hover:text-[var(--ink)] transition border border-[var(--line)] rounded cursor-pointer"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            aria-label="Toggle color theme"
          >
            {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          {/* Mobile Menu Hamburger (for Landing Page & authenticated secondary links) */}
          {(isLanding || user) && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 md:hidden text-[var(--ink)] border border-[var(--line)] rounded cursor-pointer transition"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Slide-down Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed top-[58px] left-0 right-0 z-40 bg-[var(--bg)] border-b border-[var(--line)] shadow-xl md:hidden">
          <div className="px-6 py-5 space-y-3">
            {isLanding ? (
              <>
                <a
                  href="/#story"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block font-mono text-xs uppercase tracking-widest text-[var(--ink)] py-2 border-b border-[var(--line)]"
                >
                  The clock
                </a>
                <a
                  href="/#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block font-mono text-xs uppercase tracking-widest text-[var(--ink)] py-2 border-b border-[var(--line)]"
                >
                  Features
                </a>
                <a
                  href="/#how"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block font-mono text-xs uppercase tracking-widest text-[var(--ink)] py-2 border-b border-[var(--line)]"
                >
                  How it works
                </a>
                <div className="pt-2 flex flex-col gap-2.5">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn o w-full text-center sm"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn w-full text-center sm"
                  >
                    Get started
                  </Link>
                </div>
              </>
            ) : user ? (
              <>
                <div className="pb-3 border-b border-[var(--line)] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--mut)]">Signed In As</div>
                    <div className="font-serif text-base text-[var(--ink)] font-semibold">{user.name}</div>
                  </div>
                  <span className="font-mono text-[10px] uppercase px-2 py-0.5 bg-[var(--bg2)] rounded border border-[var(--line)]">
                    {user.role}
                  </span>
                </div>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-wider text-[var(--ink)] py-1.5"
                >
                  <LayoutDashboard className="w-4 h-4 text-[var(--g)]" />
                  <span>Dashboard Overview</span>
                </Link>
                <Link
                  to="/warranties"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-wider text-[var(--ink)] py-1.5"
                >
                  <Archive className="w-4 h-4 text-[var(--g)]" />
                  <span>Browse Vault Inventory</span>
                </Link>
                <Link
                  to="/add"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-wider text-[var(--ink)] py-1.5"
                >
                  <Plus className="w-4 h-4 text-[var(--g)]" />
                  <span>Add New Warranty</span>
                </Link>
                <Link
                  to="/notifications"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between font-mono text-xs uppercase tracking-wider text-[var(--ink)] py-1.5"
                >
                  <div className="flex items-center gap-2.5">
                    <Bell className="w-4 h-4 text-[var(--a)]" />
                    <span>Notifications & Alerts</span>
                  </div>
                  {unreadCount > 0 && (
                    <span className="bg-[var(--a)] text-[#16130F] text-[9px] font-mono font-bold px-2 py-0.5 rounded-full">
                      {unreadCount} unread
                    </span>
                  )}
                </Link>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-wider text-[var(--a)] py-1.5"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Admin System Metrics</span>
                  </Link>
                )}
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-wider text-[var(--ink)] py-1.5"
                >
                  <User className="w-4 h-4 text-[var(--mut)]" />
                  <span>Profile & Reminder Settings</span>
                </Link>
                <div className="pt-2 border-t border-[var(--line)]">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signOut();
                      navigate('/');
                    }}
                    className="w-full btn danger sm flex items-center justify-center gap-2 text-xs cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out of Vault</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Authenticated Mobile Bottom Navigation Bar (Native App Style) */}
      {user && !isLanding && !isAuthPage && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg)] border-t border-[var(--line)] px-2 py-2 flex items-center justify-around pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-md"
          aria-label="Mobile Bottom Navigation"
        >
          <Link
            to="/dashboard"
            className={`flex flex-col items-center gap-1 py-1 px-3 text-[10px] font-mono uppercase tracking-wider transition ${
              location.pathname === '/dashboard' ? 'text-[var(--g)] font-bold' : 'text-[var(--mut)] hover:text-[var(--ink)]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Home</span>
          </Link>
          <Link
            to="/warranties"
            className={`flex flex-col items-center gap-1 py-1 px-3 text-[10px] font-mono uppercase tracking-wider transition ${
              location.pathname === '/warranties' ? 'text-[var(--g)] font-bold' : 'text-[var(--mut)] hover:text-[var(--ink)]'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Vault</span>
          </Link>
          <Link
            to="/add"
            className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-[var(--ink)] text-[var(--bg)] -mt-5 shadow-lg border-2 border-[var(--bg)] active:scale-95 transition"
            title="Add Warranty"
            aria-label="Add New Warranty"
          >
            <Plus className="w-5 h-5" />
          </Link>
          <Link
            to="/notifications"
            className={`relative flex flex-col items-center gap-1 py-1 px-3 text-[10px] font-mono uppercase tracking-wider transition ${
              location.pathname === '/notifications' ? 'text-[var(--g)] font-bold' : 'text-[var(--mut)] hover:text-[var(--ink)]'
            }`}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-2 bg-[var(--a)] text-[#16130F] text-[9px] font-mono font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center border border-[var(--ink)]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            <span>Alerts</span>
          </Link>
          <Link
            to="/profile"
            className={`flex flex-col items-center gap-1 py-1 px-3 text-[10px] font-mono uppercase tracking-wider transition ${
              location.pathname === '/profile' ? 'text-[var(--g)] font-bold' : 'text-[var(--mut)] hover:text-[var(--ink)]'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile</span>
          </Link>
        </nav>
      )}
    </>
  );
};
