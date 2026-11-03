export type UserRole = 'user' | 'admin';

export type WarrantyStatus = 'Active' | 'Expiring Soon' | 'Expired';

export interface EmailNotificationPreferences {
  warranty_started: boolean;
  expiring_soon: boolean;
  expired: boolean;
}

export interface Profile {
  id: string;
  name: string;
  role: UserRole;
  reminder_days: number[];
  email_notifications?: EmailNotificationPreferences;
  created_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  serial_no?: string | null;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface Warranty {
  id: string;
  product_id: string;
  purchase_date: string; // YYYY-MM-DD
  duration_months: number;
  expiry_date: string; // YYYY-MM-DD
  coverage_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type DocumentCategory =
  | 'Manufacturer Warranty Card'
  | 'Retail Tax Invoice'
  | 'Extended Protection Certificate';

export interface WarrantyDocument {
  id: string;
  warranty_id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  storage_path: string;
  uploaded_at: string;
  signedUrl?: string;
  is_authentic?: boolean;
  document_type?: DocumentCategory;
  verification_id?: string;
  security_hash?: string;
  issuer_stamp?: string;
}

export type NotificationType =
  | 'warranty_started'
  | 'expiring_soon'
  | 'expired';

export interface WarrantyNotification {
  id: string;
  user_id: string;
  warranty_id: string;
  reminder_date: string;
  sent_at: string;
  is_read: boolean;
  status: 'unread' | 'read';
  product_name?: string;
  brand?: string;
  type?: NotificationType;
  title?: string;
  message?: string;
  channel?: 'email' | 'in_app' | 'both';
  email_to?: string;
  email_subject?: string;
  email_html?: string;
  email_status?: 'sent' | 'delivered' | 'simulated';
}

export interface WarrantyItem extends Warranty {
  product: Product;
  documents?: WarrantyDocument[];
  status: WarrantyStatus;
  days_remaining: number;
}

export interface AdminStats {
  total_users: number;
  total_products: number;
  total_warranties: number;
  total_documents: number;
  active_warranties: number;
  expiring_soon_warranties: number;
  expired_warranties: number;
}

