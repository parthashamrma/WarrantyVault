import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email.')
    .email('That email doesn’t look right. Check for typos.'),
  password: z
    .string()
    .min(1, 'Enter your password.')
    .min(8, 'Use at least 8 characters.'),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Tell us what to call you (2+ characters).')
      .max(60, 'Name must be 60 characters or less.'),
    email: z
      .string()
      .trim()
      .min(1, 'Enter your email.')
      .email('That email doesn’t look right. Check for typos.'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .max(128, 'Password must be 128 characters or less.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords don’t match yet.',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email.')
    .email('That email doesn’t look right. Check for typos.'),
});

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Product name is required.')
    .max(100, 'Product name must be 100 characters or less.'),
  brand: z.string().trim().max(60).optional().nullable(),
  model: z.string().trim().max(60).optional().nullable(),
  serial_no: z.string().trim().max(80).optional().nullable(),
  category: z.string().trim().min(1, 'Category is required.'),
});

export const warrantySchema = z.object({
  purchase_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid purchase date (YYYY-MM-DD) is required.'),
  duration_months: z
    .number()
    .int('Duration must be a whole number of months.')
    .positive('Duration must be greater than 0 months.')
    .max(360, 'Duration cannot exceed 30 years (360 months).'),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  coverage_notes: z.string().trim().max(1000).optional().nullable(),
});

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(60, 'Name must be 60 characters or less.'),
  reminder_days: z
    .array(
      z
        .number()
        .int()
        .positive('Reminder days must be positive integers.')
        .max(365, 'Reminder days cannot exceed 365.')
    )
    .min(1, 'At least one reminder threshold is required.')
    .max(10, 'Maximum of 10 reminder thresholds allowed.'),
});

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
] as const;

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const documentUploadSchema = z.object({
  size: z.number().max(MAX_FILE_SIZE, 'File size must not exceed 5 MB.'),
  type: z.enum(ALLOWED_MIME_TYPES, {
    message: 'Invalid file type. Only PDF, PNG, and JPG/JPEG files are accepted.',
  }),
});
