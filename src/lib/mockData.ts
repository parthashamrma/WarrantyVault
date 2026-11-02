import { Product, Warranty, WarrantyDocument, WarrantyNotification, Profile } from '../types/database';
import { calculateExpiryDate, getWarrantyStatus, getDaysRemaining } from './warrantyUtils';

export const DEMO_USER_ID = 'a0000000-0000-0000-0000-000000000001';
export const DEMO_ADMIN_ID = 'b0000000-0000-0000-0000-000000000002';

export const INITIAL_PROFILES: Profile[] = [
  {
    id: DEMO_USER_ID,
    name: 'Alex Mercer',
    role: 'user',
    reminder_days: [30, 15, 7],
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
  {
    id: DEMO_ADMIN_ID,
    name: 'Vault Custodian',
    role: 'admin',
    reminder_days: [30, 15, 7],
    created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
  },
];

const today = new Date();
const formatDateOffset = (days: number) => {
  const d = new Date(today.getTime() + days * 86400000);
  return d.toISOString().split('T')[0];
};

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    user_id: DEMO_USER_ID,
    name: 'Front-Load Washer',
    brand: 'LG',
    model: 'WM4000HBA',
    serial_no: 'LG-89472-X',
    category: 'Appliances',
    created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 40 * 86400000).toISOString(),
  },
  {
    id: 'prod-002',
    user_id: DEMO_USER_ID,
    name: 'Noise Cancelling Headphones',
    brand: 'Sony',
    model: 'WH-1000XM5',
    serial_no: 'SN-XM5-9921',
    category: 'Audio',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'prod-003',
    user_id: DEMO_USER_ID,
    name: 'Creator Laptop 15',
    brand: 'Dell',
    model: 'XPS 15 9520',
    serial_no: 'DL-XPS-4432',
    category: 'Laptops',
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 'prod-004',
    user_id: DEMO_USER_ID,
    name: 'MacBook Pro 16-inch M3 Max',
    brand: 'Apple',
    model: 'A2991',
    serial_no: 'C02G994KMD6R',
    category: 'Laptops',
    created_at: new Date(Date.now() - 65 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 65 * 86400000).toISOString(),
  },
  {
    id: 'prod-005',
    user_id: DEMO_USER_ID,
    name: 'Barista Touch Espresso Machine',
    brand: 'Breville',
    model: 'BES880BSS',
    serial_no: 'BR-77419-ES',
    category: 'Appliances',
    created_at: new Date(Date.now() - 200 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 200 * 86400000).toISOString(),
  },
];

export const INITIAL_WARRANTIES: Warranty[] = [
  {
    id: 'war-001',
    product_id: 'prod-001',
    purchase_date: formatDateOffset(-346),
    duration_months: 12,
    expiry_date: formatDateOffset(19), // 19 days remaining (Expiring Soon)
    coverage_notes: 'Direct Drive motor covered for 10 years, all parts and labor covered for 1 year. Keep receipt.',
    created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 40 * 86400000).toISOString(),
  },
  {
    id: 'war-002',
    product_id: 'prod-002',
    purchase_date: formatDateOffset(-153),
    duration_months: 24,
    expiry_date: formatDateOffset(412), // ~412 days remaining (Active)
    coverage_notes: 'Accidental damage not covered. Free ear cushion replacement during first 12 months.',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'war-003',
    product_id: 'prod-003',
    purchase_date: formatDateOffset(-390),
    duration_months: 12,
    expiry_date: formatDateOffset(-25), // Expired 25 days ago
    coverage_notes: 'Standard Premium Support expired. Battery replacement request was submitted.',
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 'war-004',
    product_id: 'prod-004',
    purchase_date: formatDateOffset(-65),
    duration_months: 12,
    expiry_date: formatDateOffset(300), // ~300 days remaining (Active)
    coverage_notes: 'AppleCare+ eligible. Covers limited hardware and 90 days technical phone support.',
    created_at: new Date(Date.now() - 65 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 65 * 86400000).toISOString(),
  },
  {
    id: 'war-005',
    product_id: 'prod-005',
    purchase_date: formatDateOffset(-724),
    duration_months: 24,
    expiry_date: formatDateOffset(6), // 6 days remaining (Expiring Soon)
    coverage_notes: 'Thermal block heating and pressure pump covered against scale defects.',
    created_at: new Date(Date.now() - 200 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 200 * 86400000).toISOString(),
  },
];

export const INITIAL_DOCUMENTS: WarrantyDocument[] = [
  {
    id: 'doc-001',
    warranty_id: 'war-001',
    user_id: DEMO_USER_ID,
    file_name: 'LG_Washer_Invoice_BestBuy.pdf',
    file_type: 'application/pdf',
    storage_path: `${DEMO_USER_ID}/war-001/lg_invoice.pdf`,
    uploaded_at: new Date(Date.now() - 40 * 86400000).toISOString(),
  },
  {
    id: 'doc-002',
    warranty_id: 'war-001',
    user_id: DEMO_USER_ID,
    file_name: 'LG_Extended_Warranty_Card.png',
    file_type: 'image/png',
    storage_path: `${DEMO_USER_ID}/war-001/lg_card.png`,
    uploaded_at: new Date(Date.now() - 39 * 86400000).toISOString(),
  },
  {
    id: 'doc-003',
    warranty_id: 'war-002',
    user_id: DEMO_USER_ID,
    file_name: 'Sony_Amazon_Receipt.pdf',
    file_type: 'application/pdf',
    storage_path: `${DEMO_USER_ID}/war-002/sony_receipt.pdf`,
    uploaded_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'doc-004',
    warranty_id: 'war-003',
    user_id: DEMO_USER_ID,
    file_name: 'Dell_Invoice_9520.pdf',
    file_type: 'application/pdf',
    storage_path: `${DEMO_USER_ID}/war-003/dell_inv.pdf`,
    uploaded_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
];

export const INITIAL_NOTIFICATIONS: WarrantyNotification[] = [
  {
    id: 'notif-001',
    user_id: DEMO_USER_ID,
    warranty_id: 'war-001',
    product_name: 'Front-Load Washer',
    reminder_date: formatDateOffset(0),
    sent_at: new Date(Date.now() - 4 * 3600000).toISOString(),
    is_read: false,
    status: 'unread',
  },
  {
    id: 'notif-002',
    user_id: DEMO_USER_ID,
    warranty_id: 'war-005',
    product_name: 'Barista Touch Espresso Machine',
    reminder_date: formatDateOffset(0),
    sent_at: new Date(Date.now() - 20 * 3600000).toISOString(),
    is_read: false,
    status: 'unread',
  },
  {
    id: 'notif-003',
    user_id: DEMO_USER_ID,
    warranty_id: 'war-003',
    product_name: 'Creator Laptop 15',
    reminder_date: formatDateOffset(-25),
    sent_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    is_read: true,
    status: 'read',
  },
];

