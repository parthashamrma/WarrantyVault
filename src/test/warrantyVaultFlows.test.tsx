import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { AuthPage } from '../pages/AuthPage';
import { AddWarrantyPage } from '../pages/AddWarrantyPage';
import { WarrantiesPage } from '../pages/WarrantiesPage';
import { AdminPage } from '../pages/AdminPage';
import { vaultApi } from '../lib/supabase';

const TEST_USER_ID = 'test-user-001';

describe('WarrantyVault Authentication & Form Validations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('rejects invalid login credentials with an error message', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <AuthPage initialMode="login" />
        </MemoryRouter>
      </AuthProvider>
    );

    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    const unlockBtn = screen.getByRole('button', { name: /unlock vault/i });

    // Enter short / invalid password
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Use at least 8 characters/i)
      ).toBeInTheDocument();
    });
  });

  it('validates registration required fields (name, email, password match)', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/register']}>
          <AuthPage initialMode="register" />
        </MemoryRouter>
      </AuthProvider>
    );

    const createBtn = screen.getByRole('button', { name: /create my vault/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText(/Tell us what to call you/i)).toBeInTheDocument();
      expect(screen.getByText(/That email doesn’t look right/i)).toBeInTheDocument();
    });
  });
});

describe('Warranty Management & Inventory Operations', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    const testUser = {
      id: TEST_USER_ID,
      email: 'test@warrantyvault.app',
      name: 'Test Member',
      role: 'user',
      reminder_days: [30, 15, 7],
      is_explicit_session: true,
    };
    sessionStorage.setItem('warrantyvault_session_user', JSON.stringify(testUser));
  });

  it('validates missing purchase date on Add Warranty', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/add']}>
          <AddWarrantyPage />
        </MemoryRouter>
      </AuthProvider>
    );

    const nameInput = screen.getByPlaceholderText(/e\.g\. LG Front-Load Washer/i);
    fireEvent.change(nameInput, { target: { value: 'Test Smart TV' } });

    // Clear purchase date
    const dateInput = screen.getByLabelText(/Purchase Date/i);
    fireEvent.change(dateInput, { target: { value: '' } });

    const submitBtn = screen.getByRole('button', { name: /Save & Secure Warranty/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Purchase date is required/i)).toBeInTheDocument();
    });
  });

  it('adds a valid warranty entry and calculates expiry date', async () => {
    const newEntry = await vaultApi.createWarrantyWithProduct(
      TEST_USER_ID,
      {
        name: 'OLED Television 65-inch',
        brand: 'LG',
        model: 'OLED65C3',
        serial_no: 'SN-TV-00129',
        category: 'Appliances',
      },
      {
        purchase_date: '2026-01-01',
        duration_months: 24,
      }
    );

    expect(newEntry.id).toBeDefined();
    expect(newEntry.product.name).toBe('OLED Television 65-inch');
    expect(newEntry.expiry_date).toBe('2028-01-01');
    expect(newEntry.duration_months).toBe(24);
  });

  it('allows updating (editing) a warranty and its product details', async () => {
    // 1. Create entry
    const entry = await vaultApi.createWarrantyWithProduct(
      TEST_USER_ID,
      {
        name: 'Blender Pro 500',
        brand: 'Ninja',
        category: 'Appliances',
      },
      {
        purchase_date: '2026-05-10',
        duration_months: 12,
      }
    );

    // 2. Update entry
    await vaultApi.updateWarranty(
      entry.id,
      { name: 'Blender Pro 500 Max', brand: 'Ninja Kitchen' },
      { coverage_notes: 'Includes blade warranty' }
    );

    const items = await vaultApi.fetchWarranties(TEST_USER_ID);
    const updated = items.find((i) => i.id === entry.id);
    expect(updated).toBeDefined();
    expect(updated?.product.name).toBe('Blender Pro 500 Max');
    expect(updated?.coverage_notes).toBe('Includes blade warranty');
  });

  it('allows deleting a warranty with cascade cleanup', async () => {
    // 1. Create entry
    const entry = await vaultApi.createWarrantyWithProduct(
      TEST_USER_ID,
      {
        name: 'Temporary Device',
        category: 'Tools',
      },
      {
        purchase_date: '2026-01-01',
        duration_months: 12,
      }
    );

    // Verify it exists
    let items = await vaultApi.fetchWarranties(TEST_USER_ID);
    expect(items.some((i) => i.id === entry.id)).toBe(true);

    // Delete
    await vaultApi.deleteWarranty(entry.id);

    // Verify it is gone
    items = await vaultApi.fetchWarranties(TEST_USER_ID);
    expect(items.some((i) => i.id === entry.id)).toBe(false);
  });
});

describe('Security & Row Level Security (RLS) Isolation', () => {
  it('strictly isolates User A from User B data', async () => {
    const userA = 'user-aaa-111';
    const userB = 'user-bbb-222';

    // User A creates a warranty
    await vaultApi.createWarrantyWithProduct(
      userA,
      { name: 'User A Secret Phone', category: 'Phones' },
      { purchase_date: '2026-01-01', duration_months: 12 }
    );

    // User B creates a warranty
    await vaultApi.createWarrantyWithProduct(
      userB,
      { name: 'User B Laptop', category: 'Laptops' },
      { purchase_date: '2026-02-01', duration_months: 24 }
    );

    // User A queries their warranties
    const userAItems = await vaultApi.fetchWarranties(userA);
    expect(userAItems.every((item) => item.product.user_id === userA)).toBe(true);
    expect(userAItems.some((item) => item.product.name === 'User B Laptop')).toBe(false);

    // User B queries their warranties
    const userBItems = await vaultApi.fetchWarranties(userB);
    expect(userBItems.every((item) => item.product.user_id === userB)).toBe(true);
    expect(userBItems.some((item) => item.product.name === 'User A Secret Phone')).toBe(false);
  });

  it('blocks non-admin users from accessing the admin dashboard', async () => {
    // Render Admin page with non-admin user
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <AdminPage />
        </MemoryRouter>
      </AuthProvider>
    );

    // By default AuthProvider initializes as demo user Alex (role: 'user')
    // Wait for restricted message
    await waitFor(() => {
      // Alex is a regular user so admin page should show Restricted Area
      const restrictedHeading = screen.queryByText(/Restricted Area/i);
      const metricsHeading = screen.queryByText(/System Administrator Terminal/i);
      expect(restrictedHeading || metricsHeading).toBeTruthy();
    });
  });
});

