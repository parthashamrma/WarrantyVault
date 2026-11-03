import { describe, it, expect } from 'vitest';
import {
  calculateExpiryDate,
  getDaysRemaining,
  getWarrantyStatus,
  validateDocumentFile,
  generateSafeStoragePath,
  verifyWarrantyDocumentAuthenticity,
} from '../lib/warrantyUtils';
import {
  validateUserName,
  validateBrand,
  validateProductName,
} from '../lib/validation';
import {
  generateWarrantyEmail,
  sendWarrantyEmail,
} from '../lib/emailService';

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

describe('User Name, Brand & Product Name Validation', () => {
  it('validates authentic user names and rejects numbers, symbols, and keyboard smashes', () => {
    // Valid names
    expect(validateUserName('Alex Rivera').valid).toBe(true);
    expect(validateUserName('Jean-Luc Picard').valid).toBe(true);
    expect(validateUserName("Sarah O'Connor").valid).toBe(true);

    // Invalid: empty or too short
    expect(validateUserName('').valid).toBe(false);
    expect(validateUserName('A').valid).toBe(false);

    // Invalid: numbers
    const numCheck = validateUserName('Alex123');
    expect(numCheck.valid).toBe(false);
    expect(numCheck.error).toContain('cannot contain numbers');

    // Invalid: special symbols
    const symCheck = validateUserName('Parth<script>');
    expect(symCheck.valid).toBe(false);

    // Invalid: repetitive characters
    const repCheck = validateUserName('Aaaaaa');
    expect(repCheck.valid).toBe(false);
    expect(repCheck.error).toContain('repetitive');

    // Invalid: keyboard smashes
    const smashCheck = validateUserName('asdfgh');
    expect(smashCheck.valid).toBe(false);
  });

  it('validates brand names and rejects empty strings or keyboard smashes', () => {
    expect(validateBrand('Apple').valid).toBe(true);
    expect(validateBrand('Sony').valid).toBe(true);
    expect(validateBrand('B&O Play').valid).toBe(true);

    // Empty or smash
    expect(validateBrand('').valid).toBe(false);
    expect(validateBrand('asdf').valid).toBe(false);
    expect(validateBrand('1111').valid).toBe(false);
  });

  it('validates authentic product names and rejects random data, numbers, or consonant clusters', () => {
    // Valid product names
    expect(validateProductName('WH-1000XM5 Headphones', 'Sony').valid).toBe(true);
    expect(validateProductName('MacBook Pro 16-inch M3', 'Apple').valid).toBe(true);
    expect(validateProductName('OLED evo C3 Smart TV', 'LG').valid).toBe(true);

    // Invalid: pure numbers
    const numCheck = validateProductName('12345678');
    expect(numCheck.valid).toBe(false);
    expect(numCheck.error).toContain('must contain letters');

    // Invalid: repetitive characters
    const repCheck = validateProductName('Waaaaashing Machine');
    expect(repCheck.valid).toBe(false);
    expect(repCheck.error).toContain('repetitive');

    // Invalid: keyboard smashes
    const smashCheck = validateProductName('asdfghjk product');
    expect(smashCheck.valid).toBe(false);
    expect(smashCheck.error).toContain('Random character strings cannot be used');

    // Invalid: excessive consonant clusters
    const clusterCheck = validateProductName('Bcdfghjklm 500');
    expect(clusterCheck.valid).toBe(false);
    expect(clusterCheck.error).toContain('unpronounceable');
  });
});

describe('Warranty Document Authenticity Verification', () => {
  it('accepts authentic warranty cards, guarantee slips, and retail invoices', () => {
    // 200 bytes dummy content
    const content = new Uint8Array(200);

    const warrantyCard = new File([content], 'Sony_Manufacturer_Warranty_Card.pdf', {
      type: 'application/pdf',
    });
    const cardRes = verifyWarrantyDocumentAuthenticity(warrantyCard, { brand: 'Sony' });
    expect(cardRes.valid).toBe(true);
    expect(cardRes.auth?.isAuthentic).toBe(true);
    expect(cardRes.auth?.documentType).toBe('Manufacturer Warranty Card');
    expect(cardRes.auth?.verificationId.startsWith('AUTH-WV-')).toBe(true);

    const taxInvoice = new File([content], 'Apple_Store_Retail_Tax_Invoice.pdf', {
      type: 'application/pdf',
    });
    const invRes = verifyWarrantyDocumentAuthenticity(taxInvoice, { brand: 'Apple' });
    expect(invRes.valid).toBe(true);
    expect(invRes.auth?.documentType).toBe('Retail Tax Invoice');

    const extendedCert = new File([content], 'AppleCare_Plus_Protection_Plan.pdf', {
      type: 'application/pdf',
    });
    const certRes = verifyWarrantyDocumentAuthenticity(extendedCert, { brand: 'Apple' });
    expect(certRes.valid).toBe(true);
    expect(certRes.auth?.documentType).toBe('Extended Protection Certificate');
  });

  it('rejects files without genuine warranty or invoice markers', () => {
    const content = new Uint8Array(200);
    const randomPhoto = new File([content], 'family_vacation_photo.jpg', {
      type: 'image/jpeg',
    });

    const res = verifyWarrantyDocumentAuthenticity(randomPhoto, { brand: 'Sony' });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Card Authentication Failed');
  });

  it('rejects corrupt or empty files (< 100 bytes)', () => {
    const tinyContent = new Uint8Array(10);
    const corruptCard = new File([tinyContent], 'genuine_warranty_card.pdf', {
      type: 'application/pdf',
    });

    const res = verifyWarrantyDocumentAuthenticity(corruptCard, { brand: 'Sony' });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('corrupt or empty');
  });
});

describe('Automated Email Notifications for Warranty Reminders', () => {
  const sampleContext = {
    productName: 'OLED Smart Television',
    brand: 'Sony',
    model: 'XR-65A80L',
    serialNo: 'SN-TV-00129',
    category: 'Appliances',
    purchaseDate: '2026-01-01',
    durationMonths: 24,
    expiryDate: '2028-01-01',
    daysRemaining: 15,
    warrantyId: 'war-test-101',
    recipientEmail: 'alex@warrantyvault.app',
  };

  it('generates a rich "warranty_started" activation email', () => {
    const email = generateWarrantyEmail('warranty_started', sampleContext);
    expect(email.subject).toContain('Coverage Activated: Sony OLED Smart Television');
    expect(email.title).toBe('Warranty Coverage Activated');
    expect(email.html).toContain('WARRANTYVAULT');
    expect(email.html).toContain('COVERAGE ACTIVATED');
    expect(email.html).toContain('XR-65A80L');
    expect(email.html).toContain('alex@warrantyvault.app');
    expect(email.text).toContain('Purchase Date');
  });

  it('generates an urgent "expiring_soon" reminder email with action advice', () => {
    const email = generateWarrantyEmail('expiring_soon', sampleContext);
    expect(email.subject).toContain('15 Days Left: Sony OLED Smart Television Expiring Soon');
    expect(email.title).toContain('15 Days Left');
    expect(email.html).toContain('EXPIRING IN 15 DAYS');
    expect(email.html).toContain('File any eligible warranty claim');
    expect(email.text).toContain('Days Remaining: 15 Days');
  });

  it('generates a clear "expired" notice email', () => {
    const email = generateWarrantyEmail('expired', {
      ...sampleContext,
      daysRemaining: 0,
    });
    expect(email.subject).toContain('Sony OLED Smart Television Warranty Has Expired');
    expect(email.title).toBe('Warranty Coverage Expired');
    expect(email.html).toContain('COVERAGE EXPIRED');
    expect(email.html).toContain('tax records');
  });

  it('simulates live email dispatch with delivery receipt', async () => {
    const email = generateWarrantyEmail('expiring_soon', sampleContext);
    const result = await sendWarrantyEmail({
      to: sampleContext.recipientEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
      type: 'expiring_soon',
    });
    expect(result.success).toBe(true);
    expect(result.emailId.startsWith('wv-mail-')).toBe(true);
    expect(result.status).toBe('delivered');
  });
});

