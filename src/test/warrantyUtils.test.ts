import { describe, it, expect } from 'vitest';
import {
  calculateExpiryDate,
  getDaysRemaining,
  getWarrantyStatus,
  validateDocumentFile,
  generateSafeStoragePath,
} from '../lib/warrantyUtils';

describe('Warranty Date and Status Calculations', () => {
  it('correctly calculates expiry date from purchase date and duration', () => {
    // 12 months from 2026-01-15 -> 2027-01-15
    const expiry1 = calculateExpiryDate('2026-01-15', 12);
    expect(expiry1).toBe('2027-01-15');

    // 24 months from 2025-06-10 -> 2027-06-10
    const expiry2 = calculateExpiryDate('2025-06-10', 24);
    expect(expiry2).toBe('2027-06-10');

    // End-of-month clamp: Jan 31 + 1 month clamps to Feb 28
    const expiry3 = calculateExpiryDate('2026-01-31', 1);
    expect(expiry3).toBe('2026-02-28');
  });

  it('handles invalid date or duration gracefully', () => {
    expect(calculateExpiryDate('', 12)).toBe('');
    expect(calculateExpiryDate('2026-01-15', 0)).toBe('');
    expect(calculateExpiryDate('2026-01-15', -5)).toBe('');
  });

  it('determines status correctly: Active, Expiring Soon, Expired', () => {
    const fixedToday = new Date('2026-11-02T12:00:00Z');

    // Expired: expiry was yesterday or before
    const expiredStatus = getWarrantyStatus('2026-11-01', 30, fixedToday);
    expect(expiredStatus).toBe('Expired');

    // Expiring Soon: within 30 days (e.g. 15 days ahead)
    const expiringSoonStatus = getWarrantyStatus('2026-11-17', 30, fixedToday);
    expect(expiringSoonStatus).toBe('Expiring Soon');

    // Expiring Soon: exactly on the 30-day threshold
    const exactly30Status = getWarrantyStatus('2026-12-02', 30, fixedToday);
    expect(exactly30Status).toBe('Expiring Soon');

    // Active: more than 30 days ahead (e.g. 365 days ahead)
    const activeStatus = getWarrantyStatus('2027-11-02', 30, fixedToday);
    expect(activeStatus).toBe('Active');
  });

  it('calculates days remaining accurately', () => {
    const base = new Date('2026-11-02T12:00:00Z');

    // Same day: 0 days remaining (still active until end of today)
    const daysZero = getDaysRemaining('2026-11-02', base);
    expect(daysZero).toBe(0);

    // 10 days in future
    const daysTen = getDaysRemaining('2026-11-12', base);
    expect(daysTen).toBe(10);

    // 5 days in past (expired)
    const daysPast = getDaysRemaining('2026-10-28', base);
    expect(daysPast).toBeLessThan(0);
  });
});

describe('Document Upload Validation & Path Security', () => {
  it('accepts valid PDF, PNG, and JPEG files within 5MB', () => {
    const validPdf = new File(['%PDF-1.4 test data'], 'invoice.pdf', {
      type: 'application/pdf',
    });
    expect(validateDocumentFile(validPdf).valid).toBe(true);

    const validPng = new File(['fake-png-data'], 'warranty_card.png', {
      type: 'image/png',
    });
    expect(validateDocumentFile(validPng).valid).toBe(true);
  });

  it('rejects disallowed file types (exe, zip, sh)', () => {
    const maliciousFile = new File(['echo virus'], 'script.sh', {
      type: 'application/x-sh',
    });
    const result = validateDocumentFile(maliciousFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Only PDF, PNG, and JPG/JPEG files are accepted');
  });

  it('rejects files larger than 5MB', () => {
    // 6 MB dummy content
    const largeContent = new Uint8Array(6 * 1024 * 1024);
    const oversizedFile = new File([largeContent], 'huge_scan.pdf', {
      type: 'application/pdf',
    });
    const result = validateDocumentFile(oversizedFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Maximum allowed size is 5 MB');
  });

  it('generates secure, sanitized storage paths scoped to user id and warranty id', () => {
    const userId = 'usr-12345';
    const warrantyId = 'war-67890';
    const originalName = 'BestBuy Receipt (2026)!@#$.pdf';

    const { storagePath, safeFileName } = generateSafeStoragePath(
      userId,
      warrantyId,
      originalName
    );

    // Verify folder structure is strictly {userId}/{warrantyId}/{filename}
    expect(storagePath.startsWith(`${userId}/${warrantyId}/`)).toBe(true);
    expect(safeFileName.endsWith('.pdf')).toBe(true);
    // Disallowed characters stripped out
    expect(safeFileName).not.toContain('!');
    expect(safeFileName).not.toContain('@');
    expect(safeFileName).not.toContain('#');
  });
});

