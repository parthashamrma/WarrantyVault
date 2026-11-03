import { z } from 'zod';

/**
 * Validates a user's full name:
 * - 2 to 60 characters
 * - Only alphabetic characters, spaces, hyphens, and apostrophes
 * - Rejects numbers, special symbols, single-letter initials, repetitive characters, and keyboard smashes
 */
export function validateUserName(name: string): { valid: boolean; error?: string } {
  const trimmed = (name || '').trim();

  if (!trimmed) {
    return { valid: false, error: 'Tell us what to call you (2+ characters).' };
  }

  if (trimmed.length < 2) {
    return { valid: false, error: 'Tell us what to call you (2+ characters).' };
  }

  if (trimmed.length > 60) {
    return { valid: false, error: 'Name must be 60 characters or less.' };
  }

  // Reject digits/numbers
  if (/\d/.test(trimmed)) {
    return { valid: false, error: 'Names cannot contain numbers. Please enter your real name.' };
  }

  // Reject forbidden symbols like < > / \ @ # $ % ^ & * ( ) _ = + { } [ ] ; : " ?
  if (!/^[a-zA-ZÀ-ÿ]+([ '-][a-zA-ZÀ-ÿ]+)*$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Name can only contain alphabetic letters, spaces, hyphens, and apostrophes.',
    };
  }

  // Must have at least 2 alphabetic characters
  const letterCount = (trimmed.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  if (letterCount < 2) {
    return { valid: false, error: 'Name must contain at least 2 letters.' };
  }

  // Reject 3+ identical consecutive characters (e.g., "aaaaa", "zzzz")
  if (/(.)\1{2,}/i.test(trimmed)) {
    return {
      valid: false,
      error: 'Please enter a genuine name without repetitive letters.',
    };
  }

  // Reject keyboard smashes and placeholder test names
  const lower = trimmed.toLowerCase();
  const invalidPatterns = [
    'asdf', 'sdfg', 'dfgh', 'fghj', 'ghjk', 'hjkl',
    'qwerty', 'werty', 'zxcv', 'xcvb', 'cvbn',
    'unknown', 'anonymous', 'placeholder', 'null', 'undefined'
  ];

  if (invalidPatterns.some((pat) => lower === pat || (lower.includes(pat) && lower.length <= pat.length + 2))) {
    return {
      valid: false,
      error: 'That name appears to be random or placeholder characters. Please enter your authentic name.',
    };
  }

  return { valid: true };
}

/**
 * Catalog of Recognized & Verified Brands across categories
 */
export const VERIFIED_BRANDS: Record<string, string[]> = {
  'Apple': ['iPhone 15 Pro', 'iPhone 15 Pro Max', 'MacBook Pro 16-inch M3', 'MacBook Air 15-inch', 'iPad Pro 13-inch', 'Apple Watch Ultra 2', 'AirPods Pro (2nd Gen)'],
  'Sony': ['WH-1000XM5 Headphones', 'Bravia XR OLED 65-inch 4K', 'PlayStation 5 Console', 'Alpha 7 IV Mirrorless Camera', 'DualSense Edge Controller'],
  'LG': ['Front-Load Washer WM4000', 'OLED evo C3 65-inch 4K TV', 'InstaView Door-in-Door Refrigerator', 'Dual Inverter Smart Air Conditioner'],
  'Samsung': ['Galaxy S24 Ultra', 'Neo QLED 4K Smart TV', 'Bespoke 4-Door French Door Refrigerator', 'Galaxy Watch 6 Classic', 'Odyssey Neo G9 Monitor'],
  'Dell': ['XPS 15 9530 Laptop', 'XPS 13 Plus Ultrabook', 'Alienware m18 Gaming Laptop', 'UltraSharp 32 4K USB-C Hub Monitor'],
  'HP': ['Spectre x360 2-in-1 Laptop', 'Envy Desktop PC', 'Color LaserJet Pro Multifunction Printer', 'OMEN 16 Gaming Laptop'],
  'Lenovo': ['ThinkPad X1 Carbon Gen 11', 'Legion Pro 7i Gaming Laptop', 'Yoga 9i 2-in-1', 'IdeaPad Slim 5'],
  'Asus': ['ROG Zephyrus G16', 'Zenbook 14 OLED', 'TUF Gaming A15', 'ProArt Studiobook 16 OLED'],
  'Bose': ['QuietComfort Ultra Headphones', 'Smart Soundbar 900', 'QuietComfort Ultra Earbuds', 'SoundLink Revolve+ II Speaker'],
  'Dyson': ['V15 Detect Cordless Vacuum', 'Purifier Hot+Cool HP07', 'Supersonic Hair Dryer', 'Airwrap Multi-Styler Complete'],
  'Breville': ['Barista Touch Espresso Machine', 'Smart Oven Air Fryer Pro', 'Juice Fountain Cold Plus', 'Precision Brewer Thermal Maker'],
  'Whirlpool': ['Top Load Smart Washer', 'Double Oven Electric Range', 'Fingerprint Resistant French Door Fridge', 'Built-in Dishwasher'],
  'Bosch': ['800 Series Dishwasher', 'Counter-Depth French Door Refrigerator', 'Series 6 Heat Pump Dryer', '18V Brushless Drill Driver'],
  'Canon': ['EOS R6 Mark II Mirrorless Camera', 'EOS R5 Full-Frame Camera', 'RF 24-70mm F2.8 L IS USM Lens', 'imageCLASS Laser Printer'],
  'Nikon': ['Z8 Full-Frame Mirrorless Camera', 'Z6 II Mirrorless Camera', 'NIKKOR Z 70-200mm f/2.8 VR S Lens'],
  'Philips': ['Sonicare DiamondClean 9000 Toothbrush', 'Airfryer XXL with Twin TurboStar', 'Hue Smart Lighting Starter Kit'],
  'Nintendo': ['Switch OLED Model', 'Switch Pro Controller', 'Switch Lite Console'],
  'Microsoft': ['Surface Pro 9 2-in-1 Tablet', 'Surface Laptop 5', 'Xbox Series X 1TB Console'],
  'DeWalt': ['20V MAX Cordless Drill Combo Kit', 'ATOMIC 20V MAX Circular Saw', '12-Inch Sliding Compound Miter Saw'],
  'Rolex': ['Submariner Date 41mm', 'Oyster Perpetual 36mm', 'Cosmograph Daytona 40mm', 'Datejust 36mm'],
  'Ninja': ['Blender Pro 500', 'Foodi 10-in-1 XL Pro Air Fry Oven', 'Speedi Rapid Cooker & Air Fryer'],
  'Google': ['Pixel 8 Pro Smartphone', 'Pixel Watch 2', 'Pixel Tablet with Speaker Dock', 'Nest Learning Thermostat'],
  'Panasonic': ['LUMIX S5 II Mirrorless Camera', 'Countertop Microwave Oven', 'Arc5 Electric Razor'],
  'Logitech': ['MX Master 3S Wireless Mouse', 'MX Keys Advanced Wireless Keyboard', 'G Pro X Superlight Gaming Mouse'],
};

/**
 * Validates brand name:
 * - Brand is required (warranties must be tied to a legitimate manufacturer brand)
 * - 2 to 50 characters
 * - Only legitimate brand text (letters, numbers, basic punctuation like &, +, -)
 * - Anti-keyboard smash
 */
export function validateBrand(brand: string): { valid: boolean; error?: string } {
  const trimmed = (brand || '').trim();

  if (!trimmed) {
    return { valid: false, error: 'Manufacturer / brand is required. Select or enter a verified brand.' };
  }

  if (trimmed.length < 2) {
    return { valid: false, error: 'Brand name must be at least 2 characters.' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Brand name must be 50 characters or less.' };
  }

  // Must start with letter or digit, contain genuine brand characters
  if (!/^[a-zA-Z0-9À-ÿ][a-zA-Z0-9À-ÿ\s&.'+-]{0,48}[a-zA-Z0-9À-ÿ.]?$/.test(trimmed)) {
    return { valid: false, error: 'Brand name contains invalid characters. Enter a genuine manufacturer name.' };
  }

  // No keyboard smashes
  const lower = trimmed.toLowerCase();
  const smashes = ['asdf', 'qwerty', 'zxcv', '1111', '0000', 'xxxx', 'test', 'fake'];
  if (smashes.some((s) => lower === s || (lower.includes(s) && lower.length <= s.length + 2))) {
    return { valid: false, error: 'Please enter a genuine manufacturer or brand name.' };
  }

  return { valid: true };
}

/**
 * Validates product name (warranty name):
 * - Random data cannot be used as warranty name
 * - 3 to 100 characters
 * - Must contain letters describing the product
 * - Rejects keyboard smashes, repetitive patterns, or excessive unpronounceable consonant clusters
 */
export function validateProductName(name: string, _brand?: string): { valid: boolean; error?: string } {
  const trimmed = (name || '').trim();

  if (!trimmed) {
    return { valid: false, error: 'Product name is required.' };
  }

  if (trimmed.length < 3) {
    return { valid: false, error: 'Product name must be at least 3 characters.' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Product name must be 100 characters or less.' };
  }

  // Must contain letters (cannot be pure numbers or symbols like "123456" or "---")
  if (!/[a-zA-ZÀ-ÿ]/.test(trimmed)) {
    return { valid: false, error: 'Product name must contain letters describing the item (not just numbers).' };
  }

  // Reject 4+ repeated characters (e.g. "aaaaa", "xxxxx", "11111")
  if (/(.)\1{3,}/i.test(trimmed)) {
    return { valid: false, error: 'Random repetitive text cannot be used as a warranty product name.' };
  }

  // Reject keyboard smashes (e.g. asdfgh, qwerty, zxcvb)
  const lower = trimmed.toLowerCase();
  const smashes = ['asdfgh', 'qwerty', 'zxcvbn', 'lkjhgf', 'poiuyt', '123456', 'abcdef', 'testtest'];
  if (smashes.some((s) => lower.includes(s))) {
    return {
      valid: false,
      error: 'Random character strings cannot be used as a warranty name. Enter an authentic product name or model.',
    };
  }

  // Excessive consonant clusters without vowels or spaces (e.g., "bcdfghjkl" has 8 consonants in a row)
  const withoutSpaces = trimmed.replace(/[\s\d_-]+/g, '');
  if (/[bcdfghjklmnpqrstvwxyz]{6,}/i.test(withoutSpaces)) {
    return {
      valid: false,
      error: 'Product name contains random unpronounceable characters. Enter a genuine product name.',
    };
  }

  return { valid: true };
}

// ----------------------------------------------------------------------
// Zod Schemas
// ----------------------------------------------------------------------

export const userNameSchema = z
  .string()
  .trim()
  .superRefine((val, ctx) => {
    const res = validateUserName(val);
    if (!res.valid && res.error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error,
      });
    }
  });

/**
 * Password complexity validation:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 */
export function validatePassword(pw: string): { valid: boolean; error?: string } {
  if (!pw || pw.length < 8) {
    return { valid: false, error: 'Use at least 8 characters.' };
  }
  if (!/[A-Z]/.test(pw)) {
    return { valid: false, error: 'Password must include at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(pw)) {
    return { valid: false, error: 'Password must include at least one lowercase letter (a-z).' };
  }
  if (!/\d/.test(pw)) {
    return { valid: false, error: 'Password must include at least one number (0-9).' };
  }
  return { valid: true };
}

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
    name: userNameSchema,
    email: z
      .string()
      .trim()
      .min(1, 'Enter your email.')
      .email('That email doesn’t look right. Check for typos.'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .max(128, 'Password must be 128 characters or less.')
      .superRefine((val, ctx) => {
        const check = validatePassword(val);
        if (!check.valid && check.error) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: check.error });
        }
      }),
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
    .superRefine((val, ctx) => {
      const res = validateProductName(val);
      if (!res.valid && res.error) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.error });
      }
    }),
  brand: z
    .string()
    .trim()
    .optional()
    .nullable()
    .superRefine((val, ctx) => {
      if (val) {
        const res = validateBrand(val);
        if (!res.valid && res.error) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.error });
        }
      }
    }),
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
  name: userNameSchema,
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
