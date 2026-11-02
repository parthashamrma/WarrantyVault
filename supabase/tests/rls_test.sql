-- ====================================================================
-- WarrantyVault: Row Level Security (RLS) Verification Test Script
-- Run this in Postgres / Supabase SQL Editor to verify complete isolation
-- between User A and User B.
-- ====================================================================

BEGIN;

-- 1. Setup Test Users
INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'user_a@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'user_b@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, name, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'User A', 'user'),
  ('22222222-2222-2222-2222-222222222222', 'User B', 'user')
ON CONFLICT (id) DO NOTHING;

-- 2. Act as User A: Create Product, Warranty, and Document
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

INSERT INTO public.products (id, user_id, name, brand, category)
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'User A Secret iPhone', 'Apple', 'Phones');

INSERT INTO public.warranties (id, product_id, purchase_date, duration_months, expiry_date)
VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', CURRENT_DATE, 12, CURRENT_DATE + 365);

INSERT INTO public.documents (id, warranty_id, user_id, file_name, file_type, storage_path)
VALUES ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'secret_invoice.pdf', 'application/pdf', '11111111-1111-1111-1111-111111111111/invoice.pdf');

-- User A checks own rows (Should see 1 row each)
DO $$
DECLARE
  v_prod_count INT;
  v_war_count INT;
  v_doc_count INT;
BEGIN
  SELECT count(*) INTO v_prod_count FROM public.products WHERE id = '33333333-3333-3333-3333-333333333333';
  SELECT count(*) INTO v_war_count FROM public.warranties WHERE id = '44444444-4444-4444-4444-444444444444';
  SELECT count(*) INTO v_doc_count FROM public.documents WHERE id = '55555555-5555-5555-5555-555555555555';

  ASSERT v_prod_count = 1, 'TEST FAILED: User A should see their own product';
  ASSERT v_war_count = 1, 'TEST FAILED: User A should see their own warranty';
  ASSERT v_doc_count = 1, 'TEST FAILED: User A should see their own document';
  RAISE NOTICE 'SUCCESS: User A can read their own records.';
END;
$$;

-- 3. Switch context to User B: Attempt unauthorized reads and modifications
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

DO $$
DECLARE
  v_prod_count INT;
  v_war_count INT;
  v_doc_count INT;
  v_updated INT;
  v_deleted INT;
BEGIN
  -- Attempt unauthorized select
  SELECT count(*) INTO v_prod_count FROM public.products WHERE id = '33333333-3333-3333-3333-333333333333';
  SELECT count(*) INTO v_war_count FROM public.warranties WHERE id = '44444444-4444-4444-4444-444444444444';
  SELECT count(*) INTO v_doc_count FROM public.documents WHERE id = '55555555-5555-5555-5555-555555555555';

  ASSERT v_prod_count = 0, 'RLS VIOLATION: User B was able to view User A product!';
  ASSERT v_war_count = 0, 'RLS VIOLATION: User B was able to view User A warranty!';
  ASSERT v_doc_count = 0, 'RLS VIOLATION: User B was able to view User A document!';

  -- Attempt unauthorized update
  UPDATE public.products SET name = 'Hacked' WHERE id = '33333333-3333-3333-3333-333333333333';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  ASSERT v_updated = 0, 'RLS VIOLATION: User B was able to update User A product!';

  -- Attempt unauthorized delete
  DELETE FROM public.warranties WHERE id = '44444444-4444-4444-4444-444444444444';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ASSERT v_deleted = 0, 'RLS VIOLATION: User B was able to delete User A warranty!';

  RAISE NOTICE 'SUCCESS: RLS successfully blocked User B from SELECT, UPDATE, and DELETE on User A data.';
END;
$$;

-- 4. Verify Admin Security Definer Enforcement
-- User B (regular user) should fail to call get_admin_stats()
DO $$
BEGIN
  PERFORM public.get_admin_stats();
  RAISE EXCEPTION 'TEST FAILED: Non-admin user should not be able to call get_admin_stats()';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%Access denied. Administrator privileges required.%' THEN
      RAISE NOTICE 'SUCCESS: get_admin_stats() rejected unauthorized caller with proper access denied exception.';
    ELSE
      RAISE;
    END IF;
END;
$$;

ROLLBACK;

