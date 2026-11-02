import { WarrantyStatus } from '../types/database';

/**
 * Calculates warranty expiry date based on purchase date and duration in months.
 * Safely handles leap years and variable month lengths.
 */
export function calculateExpiryDate(purchaseDate: string, durationMonths: number): string {
  if (!purchaseDate || isNaN(durationMonths) || durationMonths <= 0) {
    return '';
  }

  const [year, month, day] = purchaseDate.split('-').map(Number);
  if (!year || !month || !day) return '';

  const date = new Date(Date.UTC(year, month - 1, day));
  
  // Add months
  const targetMonth = date.getUTCMonth() + durationMonths;
  date.setUTCMonth(targetMonth);

  // If day rolled over into the next month (e.g., Jan 31 + 1 month -> March 3), clamp back to last day of target month
  const expectedMonth = (month - 1 + durationMonths) % 12;
  const normalizedExpectedMonth = expectedMonth < 0 ? expectedMonth + 12 : expectedMonth;
  if (date.getUTCMonth() !== normalizedExpectedMonth) {
    date.setUTCDate(0); // Go back to last day of previous month
  }

  return date.toISOString().split('T')[0];
}

/**
 * Calculates remaining days from base date (default today) to expiry date.
 * Expiry date itself is still covered (0 days left = expires end of today).
 * If today is after expiry date, days remaining is negative (< 0).
 */
export function getDaysRemaining(expiryDate: string, baseDate: Date = new Date()): number {
  if (!expiryDate) return 0;
  
  const [ey, em, ed] = expiryDate.split('-').map(Number);
  const expiry = Date.UTC(ey, em - 1, ed, 23, 59, 59, 999);
  
  const todayUtc = Date.UTC(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    0, 0, 0, 0
  );

  const diffMs = expiry - todayUtc;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Returns warranty status based on expiry date:
 * - Active: today <= expiry and daysRemaining > warning threshold
 * - Expiring Soon: today <= expiry and daysRemaining <= warning threshold (default 30 days)
 * - Expired: today > expiry (daysRemaining < 0)
 */
export function getWarrantyStatus(
  expiryDate: string,
  thresholdDays: number = 30,
  baseDate: Date = new Date()
): WarrantyStatus {
  if (!expiryDate) return 'Expired';
  const days = getDaysRemaining(expiryDate, baseDate);
  if (days < 0) return 'Expired';
  if (days <= thresholdDays) return 'Expiring Soon';
  return 'Active';
}

/**
 * Formats a YYYY-MM-DD string into an elegant human-readable date
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Validates document upload file
 */
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateDocumentFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size is ${sizeMb} MB. Maximum allowed size is 5 MB.`,
    };
  }

  // Check MIME type
  const mime = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase();
  const validExts = ['pdf', 'png', 'jpg', 'jpeg'];

  if (!ALLOWED_FILE_TYPES.includes(mime) && !validExts.includes(ext || '')) {
    return {
      valid: false,
      error: 'Invalid file type. Only PDF, PNG, and JPG/JPEG files are accepted.',
    };
  }

  return { valid: true };
}

/**
 * Generates an unguessable, safe storage path for a user document:
 * {userId}/{warrantyId}/{randomId}.{ext}
 */
export function generateSafeStoragePath(
  userId: string,
  warrantyId: string,
  originalFileName: string
): { storagePath: string; safeFileName: string } {
  const ext = originalFileName.split('.').pop()?.toLowerCase() || 'bin';
  // Strip non-alphanumeric chars from original base name for friendly display
  const baseName = originalFileName
    .substring(0, originalFileName.lastIndexOf('.'))
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 30);

  const randomPart = Math.random().toString(36).substring(2, 10);
  const safeFileName = `${baseName}_${randomPart}.${ext}`;
  const storagePath = `${userId}/${warrantyId}/${safeFileName}`;

  return { storagePath, safeFileName };
}

