import { createClient } from '@supabase/supabase-js';
import {
  Profile,
  Product,
  Warranty,
  WarrantyDocument,
  WarrantyNotification,
  WarrantyItem,
  AdminStats,
  WarrantyStatus,
} from '../types/database';
import {
  calculateExpiryDate,
  getWarrantyStatus,
  getDaysRemaining,
  generateSafeStoragePath,
} from './warrantyUtils';
import {
  INITIAL_PROFILES,
  INITIAL_PRODUCTS,
  INITIAL_WARRANTIES,
  INITIAL_DOCUMENTS,
  INITIAL_NOTIFICATIONS,
} from './mockData';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isLiveSupabase = Boolean(
  import.meta.env.MODE !== 'test' &&
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder-project')
);

// Never use service_role key in frontend!
export const supabase = createClient(
  isLiveSupabase ? supabaseUrl : 'https://placeholder-project.supabase.co',
  isLiveSupabase ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// ----------------------------------------------------------------------
// Local Demo Storage State (used when live Supabase is not connected or in demo mode)
// ----------------------------------------------------------------------
const STORAGE_PREFIX = 'warrantyvault_';

function getLocal<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(defaultVal));
  } catch {
    return JSON.parse(JSON.stringify(defaultVal));
  }
}

function setLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
  } catch (e) {
    console.error('LocalStorage write failed:', e);
  }
}

// Initialize mock storage if empty
if (!localStorage.getItem(STORAGE_PREFIX + 'init')) {
  setLocal('profiles', INITIAL_PROFILES);
  setLocal('products', INITIAL_PRODUCTS);
  setLocal('warranties', INITIAL_WARRANTIES);
  setLocal('documents', INITIAL_DOCUMENTS);
  setLocal('notifications', INITIAL_NOTIFICATIONS);
  localStorage.setItem(STORAGE_PREFIX + 'init', 'true');
}

// ----------------------------------------------------------------------
// Unified Vault API
// ----------------------------------------------------------------------
export const vaultApi = {
  // Check if live Supabase is active
  isConfigured(): boolean {
    return isLiveSupabase;
  },

  // 1. AUTH & PROFILE
  async getProfile(userId: string): Promise<Profile | null> {
    if (isLiveSupabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (error) {
          console.warn('Profile fetch warning (schema might not be applied yet):', error.message);
          return null;
        }
        return data as Profile;
      } catch (err) {
        console.warn('getProfile exception:', err);
        return null;
      }
    }

    const profiles = getLocal<Profile[]>('profiles', INITIAL_PROFILES);
    return profiles.find((p) => p.id === userId) || null;
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    if (isLiveSupabase) {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    }

    const profiles = getLocal<Profile[]>('profiles', INITIAL_PROFILES);
    const idx = profiles.findIndex((p) => p.id === userId);
    if (idx === -1) throw new Error('Profile not found');
    profiles[idx] = { ...profiles[idx], ...updates };
    setLocal('profiles', profiles);
    return profiles[idx];
  },

  // 2. WARRANTIES & PRODUCTS
  async fetchWarranties(userId: string): Promise<WarrantyItem[]> {
    if (isLiveSupabase) {
      try {
        // Supabase RLS ensures only records owned by auth.uid() are returned
        const { data: prods, error: pErr } = await supabase
          .from('products')
          .select('*, warranties(*, documents(*))')
          .eq('user_id', userId);

        if (pErr) {
          console.warn('Could not fetch products/warranties from Supabase (tables may not be migrated yet):', pErr.message);
          return [];
        }

        const items: WarrantyItem[] = [];
        for (const prod of prods || []) {
          const { warranties: warList, ...productData } = prod;
          for (const war of warList || []) {
            const { documents: docList, ...warrantyData } = war;
            const status = getWarrantyStatus(warrantyData.expiry_date);
            const days_remaining = getDaysRemaining(warrantyData.expiry_date);
            items.push({
              ...warrantyData,
              product: productData as Product,
              documents: (docList || []) as WarrantyDocument[],
              status,
              days_remaining,
            });
          }
        }
        return items.sort((a, b) => a.days_remaining - b.days_remaining);
      } catch (err) {
        console.warn('fetchWarranties error:', err);
        return [];
      }
    }

    // Local Mock / Demo flow
    const products = getLocal<Product[]>('products', INITIAL_PRODUCTS).filter((p) => p.user_id === userId);
    const warranties = getLocal<Warranty[]>('warranties', INITIAL_WARRANTIES);
    const documents = getLocal<WarrantyDocument[]>('documents', INITIAL_DOCUMENTS).filter((d) => d.user_id === userId);

    const items: WarrantyItem[] = [];
    for (const prod of products) {
      const prodWarranties = warranties.filter((w) => w.product_id === prod.id);
      for (const war of prodWarranties) {
        const docs = documents.filter((d) => d.warranty_id === war.id);
        const status = getWarrantyStatus(war.expiry_date);
        const days_remaining = getDaysRemaining(war.expiry_date);
        items.push({
          ...war,
          product: prod,
          documents: docs,
          status,
          days_remaining,
        });
      }
    }

    return items.sort((a, b) => a.days_remaining - b.days_remaining);
  },

  async createWarrantyWithProduct(
    userId: string,
    productData: {
      name: string;
      brand?: string;
      model?: string;
      serial_no?: string;
      category: string;
    },
    warrantyData: {
      purchase_date: string;
      duration_months: number;
      expiry_date?: string;
      coverage_notes?: string;
    },
    files?: File[]
  ): Promise<WarrantyItem> {
    const computedExpiry =
      warrantyData.expiry_date ||
      calculateExpiryDate(warrantyData.purchase_date, warrantyData.duration_months);

    if (isLiveSupabase) {
      // 1. Insert product
      const { data: newProd, error: prodErr } = await supabase
        .from('products')
        .insert({
          user_id: userId,
          name: productData.name.trim(),
          brand: productData.brand?.trim() || null,
          model: productData.model?.trim() || null,
          serial_no: productData.serial_no?.trim() || null,
          category: productData.category || 'General',
        })
        .select()
        .single();

      if (prodErr) throw prodErr;

      // 2. Insert warranty
      const { data: newWar, error: warErr } = await supabase
        .from('warranties')
        .insert({
          product_id: newProd.id,
          purchase_date: warrantyData.purchase_date,
          duration_months: warrantyData.duration_months,
          expiry_date: computedExpiry,
          coverage_notes: warrantyData.coverage_notes?.trim() || null,
        })
        .select()
        .single();

      if (warErr) throw warErr;

      // 3. Upload attached files if present
      const uploadedDocs: WarrantyDocument[] = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const { storagePath, safeFileName } = generateSafeStoragePath(
            userId,
            newWar.id,
            file.name
          );

          const { error: uploadErr } = await supabase.storage
            .from('warranty-docs')
            .upload(storagePath, file, {
              contentType: file.type,
              upsert: false,
            });

          if (!uploadErr) {
            const { data: docData, error: docErr } = await supabase
              .from('documents')
              .insert({
                warranty_id: newWar.id,
                user_id: userId,
                file_name: safeFileName,
                file_type: file.type,
                storage_path: storagePath,
              })
              .select()
              .single();

            if (!docErr && docData) {
              uploadedDocs.push(docData as WarrantyDocument);
            }
          }
        }
      }

      return {
        ...newWar,
        product: newProd,
        documents: uploadedDocs,
        status: getWarrantyStatus(computedExpiry),
        days_remaining: getDaysRemaining(computedExpiry),
      };
    }

    // Local Mock / Demo flow
    const products = getLocal<Product[]>('products', INITIAL_PRODUCTS);
    const warranties = getLocal<Warranty[]>('warranties', INITIAL_WARRANTIES);
    const documents = getLocal<WarrantyDocument[]>('documents', INITIAL_DOCUMENTS);

    const newProdId = 'prod-' + Date.now();
    const newWarId = 'war-' + Date.now();
    const nowIso = new Date().toISOString();

    const createdProd: Product = {
      id: newProdId,
      user_id: userId,
      name: productData.name.trim(),
      brand: productData.brand?.trim() || null,
      model: productData.model?.trim() || null,
      serial_no: productData.serial_no?.trim() || null,
      category: productData.category || 'General',
      created_at: nowIso,
      updated_at: nowIso,
    };

    const createdWar: Warranty = {
      id: newWarId,
      product_id: newProdId,
      purchase_date: warrantyData.purchase_date,
      duration_months: warrantyData.duration_months,
      expiry_date: computedExpiry,
      coverage_notes: warrantyData.coverage_notes?.trim() || null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const createdDocs: WarrantyDocument[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const { storagePath, safeFileName } = generateSafeStoragePath(
          userId,
          newWarId,
          file.name
        );
        const doc: WarrantyDocument = {
          id: 'doc-' + Math.random().toString(36).substring(2, 9),
          warranty_id: newWarId,
          user_id: userId,
          file_name: safeFileName,
          file_type: file.type,
          storage_path: storagePath,
          uploaded_at: nowIso,
        };
        createdDocs.push(doc);
      }
    }

    products.push(createdProd);
    warranties.push(createdWar);
    documents.push(...createdDocs);

    setLocal('products', products);
    setLocal('warranties', warranties);
    setLocal('documents', documents);

    return {
      ...createdWar,
      product: createdProd,
      documents: createdDocs,
      status: getWarrantyStatus(computedExpiry),
      days_remaining: getDaysRemaining(computedExpiry),
    };
  },

  async updateWarranty(
    warrantyId: string,
    productData: Partial<Product>,
    warrantyData: Partial<Warranty>
  ): Promise<void> {
    if (isLiveSupabase) {
      if (warrantyData.purchase_date && warrantyData.duration_months && !warrantyData.expiry_date) {
        warrantyData.expiry_date = calculateExpiryDate(
          warrantyData.purchase_date,
          warrantyData.duration_months
        );
      }

      const { data: war, error: fetchErr } = await supabase
        .from('warranties')
        .select('product_id')
        .eq('id', warrantyId)
        .single();

      if (fetchErr) throw fetchErr;

      const { error: wErr } = await supabase
        .from('warranties')
        .update({ ...warrantyData, updated_at: new Date().toISOString() })
        .eq('id', warrantyId);
      if (wErr) throw wErr;

      if (productData && Object.keys(productData).length > 0) {
        const { error: pErr } = await supabase
          .from('products')
          .update({ ...productData, updated_at: new Date().toISOString() })
          .eq('id', war.product_id);
        if (pErr) throw pErr;
      }
      return;
    }

    // Local Mock
    const warranties = getLocal<Warranty[]>('warranties', INITIAL_WARRANTIES);
    const products = getLocal<Product[]>('products', INITIAL_PRODUCTS);

    const wIdx = warranties.findIndex((w) => w.id === warrantyId);
    if (wIdx === -1) throw new Error('Warranty not found');

    const war = warranties[wIdx];
    const newPurchaseDate = warrantyData.purchase_date || war.purchase_date;
    const newDuration = warrantyData.duration_months || war.duration_months;
    const newExpiry =
      warrantyData.expiry_date || calculateExpiryDate(newPurchaseDate, newDuration);

    warranties[wIdx] = {
      ...war,
      ...warrantyData,
      expiry_date: newExpiry,
      updated_at: new Date().toISOString(),
    };

    const pIdx = products.findIndex((p) => p.id === war.product_id);
    if (pIdx !== -1 && productData) {
      products[pIdx] = {
        ...products[pIdx],
        ...productData,
        updated_at: new Date().toISOString(),
      };
      setLocal('products', products);
    }

    setLocal('warranties', warranties);
  },

  async deleteWarranty(warrantyId: string): Promise<void> {
    if (isLiveSupabase) {
      // First find associated storage docs to remove them from private bucket
      const { data: docs } = await supabase
        .from('documents')
        .select('storage_path')
        .eq('warranty_id', warrantyId);

      if (docs && docs.length > 0) {
        const paths = docs.map((d) => d.storage_path);
        await supabase.storage.from('warranty-docs').remove(paths);
      }

      // Deleting product or warranty will cascade delete in Postgres
      const { data: war } = await supabase
        .from('warranties')
        .select('product_id')
        .eq('id', warrantyId)
        .single();

      if (war?.product_id) {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', war.product_id);
        if (error) throw error;
      }
      return;
    }

    // Local Mock
    const warranties = getLocal<Warranty[]>('warranties', INITIAL_WARRANTIES);
    const products = getLocal<Product[]>('products', INITIAL_PRODUCTS);
    const documents = getLocal<WarrantyDocument[]>('documents', INITIAL_DOCUMENTS);
    const notifications = getLocal<WarrantyNotification[]>('notifications', INITIAL_NOTIFICATIONS);

    const war = warranties.find((w) => w.id === warrantyId);
    if (!war) return;

    setLocal('warranties', warranties.filter((w) => w.id !== warrantyId));
    setLocal('products', products.filter((p) => p.id !== war.product_id));
    setLocal('documents', documents.filter((d) => d.warranty_id !== warrantyId));
    setLocal('notifications', notifications.filter((n) => n.warranty_id !== warrantyId));
  },

  // 3. DOCUMENTS & SIGNED URLS
  async uploadDocument(
    userId: string,
    warrantyId: string,
    file: File
  ): Promise<WarrantyDocument> {
    const { storagePath, safeFileName } = generateSafeStoragePath(
      userId,
      warrantyId,
      file.name
    );

    if (isLiveSupabase) {
      // Upload to private bucket
      const { error: uploadErr } = await supabase.storage
        .from('warranty-docs')
        .upload(storagePath, file, { contentType: file.type });

      if (uploadErr) throw uploadErr;

      // Insert DB record
      const { data, error: docErr } = await supabase
        .from('documents')
        .insert({
          warranty_id: warrantyId,
          user_id: userId,
          file_name: safeFileName,
          file_type: file.type,
          storage_path: storagePath,
        })
        .select()
        .single();

      if (docErr) throw docErr;
      return data as WarrantyDocument;
    }

    // Local Mock
    const documents = getLocal<WarrantyDocument[]>('documents', INITIAL_DOCUMENTS);
    const doc: WarrantyDocument = {
      id: 'doc-' + Date.now(),
      warranty_id: warrantyId,
      user_id: userId,
      file_name: safeFileName,
      file_type: file.type,
      storage_path: storagePath,
      uploaded_at: new Date().toISOString(),
    };
    documents.push(doc);
    setLocal('documents', documents);
    return doc;
  },

  async deleteDocument(documentId: string): Promise<void> {
    if (isLiveSupabase) {
      const { data: doc, error: fetchErr } = await supabase
        .from('documents')
        .select('storage_path')
        .eq('id', documentId)
        .single();

      if (fetchErr) throw fetchErr;

      if (doc?.storage_path) {
        await supabase.storage.from('warranty-docs').remove([doc.storage_path]);
      }

      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);
      if (error) throw error;
      return;
    }

    // Local Mock
    const documents = getLocal<WarrantyDocument[]>('documents', INITIAL_DOCUMENTS);
    setLocal('documents', documents.filter((d) => d.id !== documentId));
  },

  async createSignedUrl(storagePath: string, expiresInSeconds = 60): Promise<string> {
    if (isLiveSupabase) {
      const { data, error } = await supabase.storage
        .from('warranty-docs')
        .createSignedUrl(storagePath, expiresInSeconds);

      if (error) throw error;
      return data.signedUrl;
    }

    // Local Mock: Return a realistic simulated temporary signed blob URL or safe placeholder
    return `data:text/plain;charset=utf-8,Simulated%20Secure%20Document%20Signed%20URL%20for%20${encodeURIComponent(
      storagePath
    )}%0AValid%20for%20${expiresInSeconds}%20seconds.`;
  },

  // 4. NOTIFICATIONS
  async fetchNotifications(userId: string): Promise<WarrantyNotification[]> {
    if (isLiveSupabase) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*, warranties(product_id, products(name))')
          .eq('user_id', userId)
          .order('sent_at', { ascending: false });

        if (error) {
          console.warn('Notifications fetch warning:', error.message);
          return [];
        }
        return (data || []).map((n: any) => ({
          id: n.id,
          user_id: n.user_id,
          warranty_id: n.warranty_id,
          reminder_date: n.reminder_date,
          sent_at: n.sent_at,
          is_read: n.is_read,
          status: n.is_read ? 'read' : 'unread',
          product_name: n.warranties?.products?.name || 'Protected Product',
        }));
      } catch (err) {
        console.warn('fetchNotifications error:', err);
        return [];
      }
    }

    const notifs = getLocal<WarrantyNotification[]>('notifications', INITIAL_NOTIFICATIONS)
      .filter((n) => n.user_id === userId);
    return notifs.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
  },

  async markNotificationAsRead(id: string): Promise<void> {
    if (isLiveSupabase) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, status: 'read' })
        .eq('id', id);
      if (error) throw error;
      return;
    }

    const notifs = getLocal<WarrantyNotification[]>('notifications', INITIAL_NOTIFICATIONS);
    const idx = notifs.findIndex((n) => n.id === id);
    if (idx !== -1) {
      notifs[idx].is_read = true;
      notifs[idx].status = 'read';
      setLocal('notifications', notifs);
    }
  },

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    if (isLiveSupabase) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, status: 'read' })
        .eq('user_id', userId);
      if (error) throw error;
      return;
    }

    const notifs = getLocal<WarrantyNotification[]>('notifications', INITIAL_NOTIFICATIONS);
    notifs.forEach((n) => {
      if (n.user_id === userId) {
        n.is_read = true;
        n.status = 'read';
      }
    });
    setLocal('notifications', notifs);
  },

  // 5. ADMIN AGGREGATE STATS (SECURITY DEFINER)
  async getAdminStats(): Promise<AdminStats> {
    if (isLiveSupabase) {
      try {
        // Calls Postgres function get_admin_stats()
        const { data, error } = await supabase.rpc('get_admin_stats');
        if (!error && data) {
          return data as AdminStats;
        }
      } catch (err) {
        console.warn('getAdminStats error, falling back to mock stats:', err);
      }
    }

    // Local Mock stats
    const profiles = getLocal<Profile[]>('profiles', INITIAL_PROFILES);
    const products = getLocal<Product[]>('products', INITIAL_PRODUCTS);
    const warranties = getLocal<Warranty[]>('warranties', INITIAL_WARRANTIES);
    const documents = getLocal<WarrantyDocument[]>('documents', INITIAL_DOCUMENTS);

    let active = 0;
    let expiring = 0;
    let expired = 0;

    for (const w of warranties) {
      const s = getWarrantyStatus(w.expiry_date);
      if (s === 'Active') active++;
      else if (s === 'Expiring Soon') expiring++;
      else expired++;
    }

    return {
      total_users: profiles.length,
      total_products: products.length,
      total_warranties: warranties.length,
      total_documents: documents.length,
      active_warranties: active,
      expiring_soon_warranties: expiring,
      expired_warranties: expired,
    };
  },
};

