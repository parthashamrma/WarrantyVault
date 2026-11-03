import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AuthPage } from '../pages/AuthPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { Dashboard } from '../pages/Dashboard';

const AuthStateInspector: React.FC = () => {
  const { user } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{user ? 'LOGGED_IN' : 'LOGGED_OUT'}</div>
      <div data-testid="auth-user-email">{user?.email || 'NONE'}</div>
    </div>
  );
};

describe('Authentication Flow & Verification (Email & Password)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('Checklist 1: Login with never-registered email must fail and demand registration first', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <AuthStateInspector />
          <Routes>
            <Route path="/login" element={<AuthPage initialMode="login" />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    const unlockBtn = screen.getByRole('button', { name: /unlock vault/i });

    // Enter never-registered email
    fireEvent.change(emailInput, { target: { value: 'ghost-unregistered@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecretPass123' } });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/No account found with this email|Invalid email or password/i);
      expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_OUT');
    });
  });

  it('Checklist 2: Enforces strict email format validation', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<AuthPage initialMode="login" />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const unlockBtn = screen.getByRole('button', { name: /unlock vault/i });

    // Malformed email
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(screen.getByText(/That email doesn’t look right/i)).toBeInTheDocument();
    });
  });

  it('Checklist 3: User must register first, and after registration login succeeds', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/register']}>
          <AuthStateInspector />
          <Routes>
            <Route path="/register" element={<AuthPage initialMode="register" />} />
            <Route path="/login" element={<AuthPage initialMode="login" />} />
            <Route path="/dashboard" element={<div data-testid="dashboard-view">Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    const nameInput = screen.getByPlaceholderText(/Your name/i);
    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const passwordInputs = screen.getAllByPlaceholderText(/••••••••/i);
    const createBtn = screen.getByRole('button', { name: /create my vault/i });

    fireEvent.change(nameInput, { target: { value: 'Alex Mercer' } });
    fireEvent.change(emailInput, { target: { value: 'alex.mercer@vaultsecurity.com' } });
    fireEvent.change(passwordInputs[0], { target: { value: 'VaultSecret99!' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'VaultSecret99!' } });
    fireEvent.click(createBtn);

    await waitFor(() => {
      // User is now registered and authenticated
      expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_IN');
      expect(screen.getByTestId('auth-user-email')).toHaveTextContent('alex.mercer@vaultsecurity.com');
    });

    // Check localStorage persistence
    const regUsers = JSON.parse(localStorage.getItem('warrantyvault_registered_users') || '[]');
    expect(regUsers.some((u: any) => u.email === 'alex.mercer@vaultsecurity.com')).toBe(true);
  });

  it('Checklist 4: Wrong password shows generic error and rejects login', async () => {
    const user = {
      id: 'usr-pwd-test',
      email: 'member@vault.com',
      name: 'Vault Member',
      password: 'CorrectPassword1',
      role: 'user',
      created_at: new Date().toISOString(),
    };
    localStorage.setItem('warrantyvault_registered_users', JSON.stringify([user]));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <AuthStateInspector />
          <Routes>
            <Route path="/login" element={<AuthPage initialMode="login" />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    const unlockBtn = screen.getByRole('button', { name: /unlock vault/i });

    fireEvent.change(emailInput, { target: { value: 'member@vault.com' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongMasterKey99' } });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Invalid email or password/i);
      expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_OUT');
    });
  });

  it('Checklist 5: Direct URL access to protected pages without session redirects to /login', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div data-testid="login-redirect-screen">Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('login-redirect-screen')).toBeInTheDocument();
    });
  });

  it('Checklist 6: Session restore keeps valid session on refresh', async () => {
    const validSession = {
      id: 'session-user-1',
      email: 'active@session.com',
      name: 'Active Session Member',
      role: 'user',
      reminder_days: [30, 15, 7],
      is_explicit_session: true,
    };
    sessionStorage.setItem('warrantyvault_session_user', JSON.stringify(validSession));

    render(
      <AuthProvider>
        <MemoryRouter>
          <AuthStateInspector />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_IN');
      expect(screen.getByTestId('auth-user-email')).toHaveTextContent('active@session.com');
    });
  });
});
