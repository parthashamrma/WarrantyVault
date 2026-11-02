-- ====================================================================
-- WarrantyVault: Row Level Security (RLS) Policies
-- Strict user-isolation: user A cannot access user B's records or files
-- Admin role restricted to aggregate statistics only (SECURITY DEFINER)
-- ====================================================================

-- 1. ENABLE RLS ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. PROFILES POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. PRODUCTS POLICIES
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

-- 4. WARRANTIES POLICIES (Enforced via product ownership)
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

-- 5. DOCUMENTS POLICIES
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

-- 6. NOTIFICATIONS POLICIES
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

-- 7. ADMIN AGGREGATE FUNCTION (SECURITY DEFINER)
-- Allows administrators to view high-level counts without leaking file contents or individual rows.
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
  -- Verify caller has admin role
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
