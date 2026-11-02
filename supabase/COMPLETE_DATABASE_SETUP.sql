-- ====================================================================
-- WARRANTYVAULT: COMPLETE ONE-CLICK DATABASE SETUP SCRIPT
-- Paste this entire script into your Supabase SQL Editor and click RUN.
-- Sets up:
--   1. Tables: profiles, products, warranties, documents, notifications
--   2. Triggers: auto-create profile on signup, auto-calculate expiry date
--   3. Row Level Security (RLS) on all tables (Strict User Isolation)
--   4. Private Storage bucket 'warranty-docs' (5MB limit, PDF/PNG/JPG only)
--   5. Admin stats function (SECURITY DEFINER)
--   6. Performance indexes
-- ====================================================================

-- 1. PROFILES TABLE (Linked 1:1 to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  reminder_days INT[] NOT NULL DEFAULT '{30,15,7}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to auto-create profile on auth.users sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, reminder_days)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Vault Member'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    ARRAY[30, 15, 7]
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  brand TEXT,
  model TEXT,
  serial_no TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. WARRANTIES TABLE
CREATE TABLE IF NOT EXISTS public.warranties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL,
  duration_months INT NOT NULL CHECK (duration_months > 0),
  expiry_date DATE NOT NULL,
  coverage_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_expiry CHECK (expiry_date >= purchase_date)
);

-- Trigger: Automatically calculate or verify expiry_date = purchase_date + duration_months
CREATE OR REPLACE FUNCTION public.calculate_warranty_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.expiry_date IS NULL OR NEW.expiry_date = NEW.purchase_date THEN
    NEW.expiry_date := (NEW.purchase_date + (NEW.duration_months || ' months')::interval)::date;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calculate_warranty_expiry ON public.warranties;
CREATE TRIGGER trg_calculate_warranty_expiry
  BEFORE INSERT OR UPDATE ON public.warranties
  FOR EACH ROW EXECUTE FUNCTION public.calculate_warranty_expiry();

-- Trigger: Update updated_at on products
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. DOCUMENTS TABLE (Metadata for private files in storage)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warranty_id UUID NOT NULL REFERENCES public.warranties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('application/pdf', 'image/png', 'image/jpeg', 'image/jpg')),
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  warranty_id UUID NOT NULL REFERENCES public.warranties(id) ON DELETE CASCADE,
  reminder_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read'))
);

-- 6. WARRANTY STATUS CALCULATION FUNCTION & VIEW
CREATE OR REPLACE FUNCTION public.get_warranty_status(p_expiry_date DATE)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_expiry_date < CURRENT_DATE THEN 'Expired'
    WHEN (p_expiry_date - CURRENT_DATE) <= 30 THEN 'Expiring Soon'
    ELSE 'Active'
  END;
$$;

CREATE OR REPLACE VIEW public.v_warranties_with_status AS
SELECT
  w.id,
  w.product_id,
  p.user_id,
  p.name AS product_name,
  p.brand,
  p.model,
  p.serial_no,
  p.category,
  w.purchase_date,
  w.duration_months,
  w.expiry_date,
  (w.expiry_date - CURRENT_DATE) AS days_remaining,
  public.get_warranty_status(w.expiry_date) AS status,
  w.coverage_notes,
  w.created_at,
  w.updated_at
FROM public.warranties w
JOIN public.products p ON p.id = w.product_id;

-- 7. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_search ON public.products(name, brand, category);
CREATE INDEX IF NOT EXISTS idx_warranties_product_id ON public.warranties(product_id);
CREATE INDEX IF NOT EXISTS idx_warranties_expiry_date ON public.warranties(expiry_date);
CREATE INDEX IF NOT EXISTS idx_documents_warranty_id ON public.documents(warranty_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_dedup ON public.notifications(warranty_id, reminder_date);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Products Policies
DROP POLICY IF EXISTS "Users can select own products" ON public.products;
CREATE POLICY "Users can select own products"
  ON public.products FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
CREATE POLICY "Users can insert own products"
  ON public.products FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own products" ON public.products;
CREATE POLICY "Users can update own products"
  ON public.products FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own products" ON public.products;
CREATE POLICY "Users can delete own products"
  ON public.products FOR DELETE
  USING (user_id = auth.uid());

-- Warranties Policies
DROP POLICY IF EXISTS "Users can select own warranties" ON public.warranties;
CREATE POLICY "Users can select own warranties"
  ON public.warranties FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = warranties.product_id
      AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert warranties for own products" ON public.warranties;
CREATE POLICY "Users can insert warranties for own products"
  ON public.warranties FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = warranties.product_id
      AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own warranties" ON public.warranties;
CREATE POLICY "Users can update own warranties"
  ON public.warranties FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = warranties.product_id
      AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = warranties.product_id
      AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own warranties" ON public.warranties;
CREATE POLICY "Users can delete own warranties"
  ON public.warranties FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = warranties.product_id
      AND p.user_id = auth.uid()
    )
  );

-- Documents Policies
DROP POLICY IF EXISTS "Users can select own documents" ON public.documents;
CREATE POLICY "Users can select own documents"
  ON public.documents FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.warranties w
      JOIN public.products p ON p.id = w.product_id
      WHERE w.id = documents.warranty_id
      AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE
  USING (user_id = auth.uid());

-- Notifications Policies
DROP POLICY IF EXISTS "Users can select own notifications" ON public.notifications;
CREATE POLICY "Users can select own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- Admin Aggregate Stats Function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_result JSON;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_products', (SELECT COUNT(*) FROM public.products),
    'total_warranties', (SELECT COUNT(*) FROM public.warranties),
    'total_documents', (SELECT COUNT(*) FROM public.documents),
    'active_warranties', (SELECT COUNT(*) FROM public.warranties WHERE expiry_date >= CURRENT_DATE AND (expiry_date - CURRENT_DATE) > 30),
    'expiring_soon_warranties', (SELECT COUNT(*) FROM public.warranties WHERE expiry_date >= CURRENT_DATE AND (expiry_date - CURRENT_DATE) <= 30),
    'expired_warranties', (SELECT COUNT(*) FROM public.warranties WHERE expiry_date < CURRENT_DATE)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ====================================================================
-- STORAGE BUCKET CONFIGURATION (warranty-docs)
-- ====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'warranty-docs',
  'warranty-docs',
  false,
  5242880, -- 5 MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

-- Storage Policies
DROP POLICY IF EXISTS "Users can read own warranty documents" ON storage.objects;
CREATE POLICY "Users can read own warranty documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'warranty-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload own warranty documents" ON storage.objects;
CREATE POLICY "Users can upload own warranty documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'warranty-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own warranty documents" ON storage.objects;
CREATE POLICY "Users can update own warranty documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'warranty-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'warranty-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own warranty documents" ON storage.objects;
CREATE POLICY "Users can delete own warranty documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'warranty-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

