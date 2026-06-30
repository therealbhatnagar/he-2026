// supabase/functions/delete-auth-user/index.ts
//
// Deletes a Supabase Auth user via the Admin API (auth.admin.deleteUser).
// This MUST run with the service role key — the anon key cannot call any
// admin.* method at all, it will just fail (or, depending on how errors
// were previously handled, fail silently from the caller's point of view).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // Browsers preflight any POST with a JSON body + Authorization header.
  // If this isn't handled, the actual POST never gets sent at all — the
  // browser blocks it before it leaves the page. This alone can produce
  // exactly "deletion looks fine app-side, but the auth user never moved."
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: `Method ${req.method} not allowed.` }, 405);
  }

  try {
    // ── Check #2: is the service role key actually available? ──────────
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error(
        "[delete-auth-user] Missing env vars — SUPABASE_URL present:",
        !!SUPABASE_URL,
        "| SUPABASE_SERVICE_ROLE_KEY present:",
        !!SERVICE_ROLE_KEY,
      );
      // This is the single most common reason this kind of function
      // "does nothing" — the service role key secret was never set for
      // this function's environment (it is NOT automatically inherited;
      // it has to exist as a secret on the deployed function itself).
      return json(
        { error: "Server misconfiguration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set on this function." },
        500,
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Check #3: is the correct user id actually being passed? ────────
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Request body was not valid JSON." }, 400);
    }

    const authId = body?.auth_id;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!authId || typeof authId !== "string" || !uuidRe.test(authId)) {
      console.error("[delete-auth-user] Missing or malformed auth_id in body:", body);
      return json({ error: "Missing or malformed auth_id in request body." }, 400);
    }

    // ── Basic caller authentication check ──────────────────────────────
    // Confirms the request carries a valid, currently-live session token.
    // Note: this does NOT enforce "caller can only delete their own
    // account" vs admin — this app's admin gate is currently client-side
    // only (no server-side admin role/claim exists to check against), so
    // enforcing that distinction here would need a real admin role added
    // to the profiles/JWT first. Flagging this as a known gap, not
    // silently fixing it myself since it'd need a schema/claims decision
    // on your side.
    const authHeader = req.headers.get("Authorization") || "";
    const callerToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!callerToken) {
      return json({ error: "Missing Authorization header." }, 401);
    }
    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(callerToken);
    if (callerErr || !callerData?.user) {
      console.error("[delete-auth-user] Caller token invalid or expired:", callerErr?.message);
      return json({ error: "Invalid or expired session." }, 401);
    }

    // ── Check #1: actually call auth.admin.deleteUser ──────────────────
    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(authId);

    // ── Check #4: return the REAL result, never a blind success ────────
    if (error) {
      console.error(
        "[delete-auth-user] auth.admin.deleteUser FAILED for",
        authId,
        "—",
        error.message,
        "| status:",
        (error as any).status,
      );
      return json({ error: error.message, status: (error as any).status ?? null }, (error as any).status || 500);
    }

    console.log("[delete-auth-user] Successfully deleted auth user:", authId, "| caller:", callerData.user.id);
    return json({ success: true, deleted: authId });
  } catch (e) {
    console.error("[delete-auth-user] Unhandled exception:", e instanceof Error ? e.message : e);
    return json({ error: e instanceof Error ? e.message : "Unknown server error" }, 500);
  }
});
