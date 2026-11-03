-- ====================================================================
-- WarrantyVault: Scheduled Reminders Engine
-- Automatically generates notifications based on user's threshold preferences
-- Avoids duplicate notifications for the same warranty on the same day
-- ====================================================================

CREATE OR REPLACE FUNCTION public.generate_warranty_reminders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted_count INT := 0;
  v_user RECORD;
  v_threshold INT;
  v_rec RECORD;
BEGIN
  -- Iterate through all users
  FOR v_user IN SELECT id, reminder_days FROM public.profiles LOOP
    -- For each configured reminder threshold day (e.g., 30, 15, 7)
    FOREACH v_threshold IN ARRAY v_user.reminder_days LOOP
      FOR v_rec IN
        SELECT
          w.id AS warranty_id,
          p.name AS product_name,
          w.expiry_date
        FROM public.warranties w
        JOIN public.products p ON p.id = w.product_id
        WHERE p.user_id = v_user.id
          AND w.expiry_date = (CURRENT_DATE + v_threshold)
      LOOP
        -- Check if a reminder has already been created for this warranty on today's date
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.warranty_id = v_rec.warranty_id
            AND n.reminder_date = CURRENT_DATE
        ) THEN
          INSERT INTO public.notifications (
            user_id,
            warranty_id,
            reminder_date,
            is_read,
            status,
            type,
            title,
            message,
            channel,
            email_status
          )
          VALUES (
            v_user.id,
            v_rec.warranty_id,
            CURRENT_DATE,
            false,
            'unread',
            'expiring_soon',
            v_rec.product_name || ' warranty expiring in ' || v_threshold || ' days',
            'Your warranty coverage for ' || v_rec.product_name || ' expires on ' || v_rec.expiry_date || '. File claims before deadline.',
            'both',
            'delivered'
          );
          v_inserted_count := v_inserted_count + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN v_inserted_count;
END;
$$;

-- Schedule daily execution at 06:00 UTC if pg_cron is enabled in the database
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule existing job if present
    PERFORM cron.unschedule('daily-warranty-reminders');
    -- Schedule daily run at 06:00 UTC
    PERFORM cron.schedule(
      'daily-warranty-reminders',
      '0 6 * * *',
      'SELECT public.generate_warranty_reminders();'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- In standard Supabase projects without pg_cron active, reminders can be triggered via Edge Function or client
    RAISE NOTICE 'pg_cron extension not active. Use the Supabase Edge Function or webhook to trigger generate_warranty_reminders().';
END;
$$;

