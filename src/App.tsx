import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { WarrantiesPage } from './pages/WarrantiesPage';
import { WarrantyDetailPage } from './pages/WarrantyDetailPage';
import { AddWarrantyPage } from './pages/AddWarrantyPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<AuthPage initialMode="login" />} />
                <Route path="/register" element={<AuthPage initialMode="register" />} />
                <Route path="/forgot-password" element={<AuthPage initialMode="forgot" />} />

                {/* Authenticated Vault Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/warranties"
                  element={
                    <ProtectedRoute>
                      <WarrantiesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/warranties/:id"
                  element={
                    <ProtectedRoute>
                      <WarrantyDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/add"
                  element={
                    <ProtectedRoute>
                      <AddWarrantyPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <NotificationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Route (Strictly Protected) */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute adminOnly={true}>
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />

                {/* 404 Dedicated Fallback */}
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
