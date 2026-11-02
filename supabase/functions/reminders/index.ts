// ====================================================================
// WarrantyVault: Supabase Edge Function for Daily Reminders
// Invoked daily to run public.generate_warranty_reminders()
// Protected via CRON_SECRET authorization and restricted CORS
// ====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Restrict allowed origins to trusted frontends / internal schedulers
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Verify Invocation Authorization (Cron Secret or Bearer Token)
    const expectedSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("authorization");

    if (expectedSecret && providedSecret !== expectedSecret && !authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized invocation" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables on Edge Function");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call stored procedure
    const { data, error } = await supabase.rpc("generate_warranty_reminders");

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Generated reminders successfully.",
        reminders_created: data,
        executed_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err: any) {
    // Server-side logging only; never leak internal details to client
    console.error("Reminder job execution failure:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal error processing reminders",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
