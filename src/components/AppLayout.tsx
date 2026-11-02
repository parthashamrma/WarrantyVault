import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const isAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);

  // Scroll to top on route change & update #bar scroll progress
  useEffect(() => {
    window.scrollTo(0, 0);

    const bar = document.getElementById('bar');
    if (isAuthPage) {
      if (bar) bar.style.transform = 'scaleX(0)';
      return;
    }

    const updateBar = () => {
      if (!bar) return;
      const vh = window.innerHeight;
      const totalH = document.documentElement.scrollHeight - vh;
      if (totalH > 0) {
        const progress = Math.min(1, Math.max(0, window.scrollY / totalH));
        bar.style.transform = `scaleX(${progress})`;
      } else {
        bar.style.transform = 'scaleX(0)';
      }
    };

    window.addEventListener('scroll', updateBar, { passive: true });
    window.addEventListener('resize', updateBar);
    updateBar();

    return () => {
      window.removeEventListener('scroll', updateBar);
      window.removeEventListener('resize', updateBar);
    };
  }, [location.pathname, isAuthPage]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] antialiased transition-colors">
      <Navbar />
      <main className={`flex-1 ${!isLanding && !isAuthPage ? 'pt-[70px] pb-24 md:pb-0' : ''}`}>
        <Outlet />
      </main>
      {!isLanding && !isAuthPage && <Footer />}
    </div>
  );
};
