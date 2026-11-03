import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AuthPage } from '../pages/AuthPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { Dashboard } from '../pages/Dashboard';

// Helper Component to Inspect AuthContext State
const AuthStateInspector: React.FC = () => {
  const { user } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{user ? 'LOGGED_IN' : 'LOGGED_OUT'}</div>
      <div data-testid="auth-user-email">{user?.email || 'NONE'}</div>
      <div data-testid="auth-confirmed-at">{user?.email_confirmed_at || 'UNCONFIRMED'}</div>
    </div>
  );
};

describe('Supabase Authentication Security & Pre-Production Audit Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Checklist Item 1: Login with a never-registered email -> must FAIL
  it('Checklist 1: Login with a never-registered email must fail with generic error and never synthesize user', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <AuthStateInspector />
          <Routes>
            <Route
              path="/login"
              element={<AuthPage initialMode="login" />}
            />
            <Route
              path="/dashboard"
              element={<div data-testid="dashboard-screen">Dashboard</div>}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    const unlockBtn = screen.getByRole('button', { name: /unlock vault/i });

    // Enter never-registered random email
    fireEvent.change(emailInput, { target: { value: 'ghost-never-registered@random.com' } });
    fireEvent.change(passwordInput, { target: { value: 'MasterPass123' } });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      // Must display generic error
      expect(screen.getByRole('alert')).toHaveTextContent(/Invalid email or password/i);
      // User must remain logged out!
      expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_OUT');
    });

    // Verify localStorage has not created a rogue user
    const regUsers = JSON.parse(localStorage.getItem('warrantyvault_registered_users') || '[]');
    expect(regUsers.some((u: any) => u.email === 'ghost-never-registered@random.com')).toBe(false);
  });

  // Checklist Item 2: Signup with fake email (123@gmail.com) -> no session until OTP is entered
  it('Checklist 2: Signup with 123@gmail.com does NOT create a session until OTP is entered', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/register']}>
          <Routes>
            <Route
              path="/register"
              element={
                <>
                  <AuthStateInspector />
                  <AuthPage initialMode="register" />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    const nameInput = screen.getByPlaceholderText(/Your name/i);
    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const passwordInputs = screen.getAllByPlaceholderText(/••••••••/i);
    const masterPwInput = passwordInputs[0];
    const confirmPwInput = passwordInputs[1];
    const createBtn = screen.getByRole('button', { name: /create my vault/i });

    fireEvent.change(nameInput, { target: { value: 'Fake Account Test' } });
    fireEvent.change(emailInput, { target: { value: '123@gmail.com' } });
    fireEvent.change(masterPwInput, { target: { value: 'SecretKey99!' } });
    fireEvent.change(confirmPwInput, { target: { value: 'SecretKey99!' } });
    fireEvent.click(createBtn);

    // Transitions to OTP screen
    await waitFor(() => {
      expect(screen.getByText(/Enter 6-digit code/i)).toBeInTheDocument();
      // Crucial: Auth status MUST REMAIN LOGGED_OUT!
      expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_OUT');
    });

    // Unreachable inbox means user never gets the token: verify no session in sessionStorage
    expect(sessionStorage.getItem('warrantyvault_session_user')).toBeNull();
  });

  // Checklist Item 3: Login before verifying email -> blocked
  it('Checklist 3: Login before verifying email is blocked and redirects to OTP verification', async () => {
    // Register unverified user in storage
    const unverifiedUser = {
      id: 'usr-unverified-1',
      email: 'unconfirmed@domain.com',
      name: 'Unconfirmed User',
      password: 'StrongPassword1',
      role: 'user',
      isVerified: false,
      otp: '654321',
      email_confirmed_at: null,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem('warrantyvault_registered_users', JSON.stringify([unverifiedUser]));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <AuthStateInspector />
          <Routes>
            <Route
              path="/login"
              element={<AuthPage initialMode="login" />}
            />
            <Route
              path="/dashboard"
              element={<div data-testid="dashboard-screen">Dashboard</div>}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    const unlockBtn = screen.getByRole('button', { name: /unlock vault/i });

    fireEvent.change(emailInput, { target: { value: 'unconfirmed@domain.com' } });
    fireEvent.change(passwordInput, { target: { value: 'StrongPassword1' } });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      // Must be redirected to OTP verification screen and blocked
      expect(screen.getByText(/Enter 6-digit code/i)).toBeInTheDocument();
      expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_OUT');
    });
  });

  // Checklist Item 4: Wrong password -> generic error
  it('Checklist 4: Wrong password shows generic error and never reveals account details', async () => {
    const verifiedUser = {
      id: 'usr-verified-1',
      email: 'verified@vault.com',
      name: 'Verified User',
      password: 'CorrectMasterKey1',
      role: 'user',
      isVerified: true,
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    localStorage.setItem('warrantyvault_registered_users', JSON.stringify([verifiedUser]));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <AuthStateInspector />
          <Routes>
            <Route
              path="/login"
              element={<AuthPage initialMode="login" />}
            />
            <Route
              path="/dashboard"
              element={<div data-testid="dashboard-screen">Dashboard</div>}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    const unlockBtn = screen.getByRole('button', { name: /unlock vault/i });

    fireEvent.change(emailInput, { target: { value: 'verified@vault.com' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPassword999' } });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Invalid email or password/i);
      expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_OUT');
    });
  });

  // Checklist Item 5: Wrong/expired OTP -> rejected
  it('Checklist 5: Wrong OTP code is strictly rejected', async () => {
    const unverifiedUser = {
      id: 'usr-otp-test',
      email: 'otpcheck@vault.com',
      name: 'OTP User',
      password: 'Password123',
      role: 'user',
      isVerified: false,
      otp: '777888',
      email_confirmed_at: null,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem('warrantyvault_registered_users', JSON.stringify([unverifiedUser]));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <AuthStateInspector />
          <Routes>
            <Route
              path="/login"
              element={<AuthPage initialMode="login" />}
            />
            <Route
              path="/dashboard"
              element={<div data-testid="dashboard-screen">Dashboard</div>}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Try logging in to get to OTP screen
    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    const unlockBtn = screen.getByRole('button', { name: /unlock vault/i });

    fireEvent.change(emailInput, { target: { value: 'otpcheck@vault.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    fireEvent.click(unlockBtn);

    // On OTP screen, enter wrong 6-digit code
    await waitFor(() => {
      expect(screen.getByText(/Enter 6-digit code/i)).toBeInTheDocument();
    });

    const otpInput = screen.getByPlaceholderText('123456');
    const verifyBtn = screen.getByRole('button', { name: /Verify & Unlock Vault/i });

    fireEvent.change(otpInput, { target: { value: '000000' } });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Invalid or expired 6-digit code/i);
      expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_OUT');
    });

    // Enter correct code '777888' (or simulated '123456')
    fireEvent.change(otpInput, { target: { value: '777888' } });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_IN');
    });
  });

  // Checklist Item 6: Direct URL access to protected pages without session -> redirected to /login
  it('Checklist 6: Direct URL access to protected pages without session redirects to /login', async () => {
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
            <Route path="/login" element={<div data-testid="login-redirect-screen">Login Page Screen</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('login-redirect-screen')).toBeInTheDocument();
    });
  });

  // Checklist Item 7: Refreshing page keeps valid sessions only
  it('Checklist 7: Session restore keeps valid confirmed sessions and discards unconfirmed ones', async () => {
    // 1. Valid confirmed session:
    const validSession = {
      id: 'session-user-1',
      email: 'active@session.com',
      name: 'Active Session Member',
      role: 'user',
      reminder_days: [30, 15, 7],
      email_confirmed_at: new Date().toISOString(),
      is_explicit_session: true,
    };
    sessionStorage.setItem('warrantyvault_session_user', JSON.stringify(validSession));

    const { unmount } = render(
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

    unmount();

    // 2. Unconfirmed or tampered session:
    const invalidSession = {
      id: 'tampered-user',
      email: 'tampered@fake.com',
      name: 'Tampered Member',
      role: 'user',
      reminder_days: [30, 15, 7],
      email_confirmed_at: null, // UNCONFIRMED
      is_explicit_session: true,
    };
    sessionStorage.setItem('warrantyvault_session_user', JSON.stringify(invalidSession));

    render(
      <AuthProvider>
        <MemoryRouter>
          <AuthStateInspector />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_OUT');
    });
  });
});
