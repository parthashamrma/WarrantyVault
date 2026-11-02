-- ====================================================================
-- WarrantyVault: Seed Data
-- Demo user & admin accounts with sample warranties in all 3 statuses:
-- 1. Active (Sony WH-1000XM5, MacBook Pro)
-- 2. Expiring Soon (LG Front-Load Washer, Breville Espresso)
-- 3. Expired (Dell XPS 15, Dyson V8)
-- ====================================================================

DO $$
DECLARE
  v_demo_user_id UUID := 'a0000000-0000-0000-0000-000000000001';
  v_admin_user_id UUID := 'b0000000-0000-0000-0000-000000000002';
  v_prod_washer UUID := 'c0000000-0000-0000-0000-000000000001';
  v_prod_sony UUID := 'c0000000-0000-0000-0000-000000000002';
  v_prod_dell UUID := 'c0000000-0000-0000-0000-000000000003';
  v_prod_macbook UUID := 'c0000000-0000-0000-0000-000000000004';
  v_prod_breville UUID := 'c0000000-0000-0000-0000-000000000005';
  
  v_war_washer UUID := 'd0000000-0000-0000-0000-000000000001';
  v_war_sony UUID := 'd0000000-0000-0000-0000-000000000002';
  v_war_dell UUID := 'd0000000-0000-0000-0000-000000000003';
  v_war_macbook UUID := 'd0000000-0000-0000-0000-000000000004';
  v_war_breville UUID := 'd0000000-0000-0000-0000-000000000005';
BEGIN
  -- 1. Create or ensure Auth Users exist (if auth.users table is present)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES
      (v_demo_user_id, 'demo@warrantyvault.app', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Alex Mercer","role":"user"}', now(), now(), 'authenticated', 'authenticated'),
      (v_admin_user_id, 'admin@warrantyvault.app', crypt('AdminPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Vault Custodian","role":"admin"}', now(), now(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 2. Profiles
  INSERT INTO public.profiles (id, name, role, reminder_days)
  VALUES
    (v_demo_user_id, 'Alex Mercer', 'user', ARRAY[30, 15, 7]),
    (v_admin_user_id, 'Vault Custodian', 'admin', ARRAY[30, 15, 7])
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role;

  -- 3. Products for Demo User
  INSERT INTO public.products (id, user_id, name, brand, model, serial_no, category)
  VALUES
    (v_prod_washer, v_demo_user_id, 'Front-Load Washer', 'LG', 'WM4000HBA', 'LG-89472-X', 'Appliances'),
    (v_prod_sony, v_demo_user_id, 'Noise Cancelling Headphones', 'Sony', 'WH-1000XM5', 'SN-XM5-9921', 'Audio'),
    (v_prod_dell, v_demo_user_id, 'Creator Laptop 15', 'Dell', 'XPS 15 9520', 'DL-XPS-4432', 'Laptops'),
    (v_prod_macbook, v_demo_user_id, 'MacBook Pro 16-inch M3 Max', 'Apple', 'A2991', 'C02G994KMD6R', 'Laptops'),
    (v_prod_breville, v_demo_user_id, 'Barista Touch Espresso Machine', 'Breville', 'BES880BSS', 'BR-77419-ES', 'Appliances')
  ON CONFLICT (id) DO NOTHING;

  -- 4. Warranties in all 3 statuses:
  -- Active: Sony (> 30 days left, ~400 days left) and MacBook Pro (~300 days left)
  -- Expiring Soon: LG Washer (19 days left) and Breville (6 days left)
  -- Expired: Dell XPS 15 (expired 25 days ago)
  INSERT INTO public.warranties (id, product_id, purchase_date, duration_months, expiry_date, coverage_notes)
  VALUES
    -- Expiring Soon (19 days remaining)
    (v_war_washer, v_prod_washer, CURRENT_DATE - 346, 12, CURRENT_DATE + 19, 'Direct Drive motor covered for 10 years, all parts & labor 1 year. Keep receipt.'),
    -- Active (~412 days remaining)
    (v_war_sony, v_prod_sony, CURRENT_DATE - 153, 24, CURRENT_DATE + 412, 'Accidental damage not covered. Free ear pad replacement during first 12 months.'),
    -- Expired (expired 25 days ago)
    (v_war_dell, v_prod_dell, CURRENT_DATE - 390, 12, CURRENT_DATE - 25, 'Standard Premium Support expired. Battery replacement request was submitted.'),
    -- Active (~300 days remaining)
    (v_war_macbook, v_prod_macbook, CURRENT_DATE - 65, 12, CURRENT_DATE + 300, 'AppleCare+ eligible. Covers limited hardware and 90 days technical phone support.'),
    -- Expiring Soon (6 days remaining)
    (v_war_breville, v_prod_breville, CURRENT_DATE - 724, 24, CURRENT_DATE + 6, 'Thermal block heating and pressure pump covered against scale defects.')
  ON CONFLICT (id) DO NOTHING;

  -- 5. Documents for warranties
  INSERT INTO public.documents (id, warranty_id, user_id, file_name, file_type, storage_path)
  VALUES
    (gen_random_uuid(), v_war_washer, v_demo_user_id, 'LG_Washer_Invoice_BestBuy.pdf', 'application/pdf', v_demo_user_id || '/' || v_war_washer || '/lg_invoice.pdf'),
    (gen_random_uuid(), v_war_washer, v_demo_user_id, 'LG_Extended_Warranty_Card.png', 'image/png', v_demo_user_id || '/' || v_war_washer || '/lg_card.png'),
    (gen_random_uuid(), v_war_sony, v_demo_user_id, 'Sony_Amazon_Receipt.pdf', 'application/pdf', v_demo_user_id || '/' || v_war_sony || '/sony_receipt.pdf'),
    (gen_random_uuid(), v_war_dell, v_demo_user_id, 'Dell_Invoice_9520.pdf', 'application/pdf', v_demo_user_id || '/' || v_war_dell || '/dell_inv.pdf')
  ON CONFLICT (id) DO NOTHING;

  -- 6. Notifications for upcoming / recent thresholds
  INSERT INTO public.notifications (user_id, warranty_id, reminder_date, is_read, status)
  VALUES
    (v_demo_user_id, v_war_washer, CURRENT_DATE, false, 'unread'),
    (v_demo_user_id, v_war_breville, CURRENT_DATE, false, 'unread'),
    (v_demo_user_id, v_war_dell, CURRENT_DATE - 25, true, 'read')
  ON CONFLICT (id) DO NOTHING;

END;
$$;

