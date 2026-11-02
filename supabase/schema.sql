-- ====================================================================
-- WarrantyVault: Schema Migration
-- Defines profiles, products, warranties, documents, notifications
-- Constraints, triggers, status calculation, and performance indexes
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
-- Date convention:
-- Expiry date = purchase_date + duration_months.
-- The expiry date itself is still covered.
-- Expired: CURRENT_DATE > expiry_date.
-- Expiring Soon: CURRENT_DATE <= expiry_date AND (expiry_date - CURRENT_DATE) <= 30 (or reminder window).
-- Active: CURRENT_DATE <= expiry_date AND (expiry_date - CURRENT_DATE) > 30.

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

-- View presenting joined products + warranties with status and days remaining
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
