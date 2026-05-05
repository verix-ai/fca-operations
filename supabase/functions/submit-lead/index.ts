// Edge Function: submit-lead
// Receives public form submissions from the FriendlyCare website's
// "Check Eligibility" form and inserts them into the `leads` table.
//
// Required env vars (set with: supabase secrets set --env-file ./supabase/functions/.env)
//   SUPABASE_URL                  - injected automatically
//   SUPABASE_SERVICE_ROLE_KEY     - injected automatically
//   LEADS_TARGET_ORG_ID           - UUID of the FriendlyCare org to insert leads into
//   LEADS_ALLOWED_ORIGIN          - the website origin allowed to call this fn (e.g. https://friendlycare.com)
//                                   use "*" only during development.

// @ts-ignore Deno-specific import
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
// @ts-ignore Deno-specific import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

// @ts-ignore Deno global
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
// @ts-ignore Deno global
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
// @ts-ignore Deno global
const TARGET_ORG_ID = Deno.env.get("LEADS_TARGET_ORG_ID")!
// @ts-ignore Deno global
const ALLOWED_ORIGIN = Deno.env.get("LEADS_ALLOWED_ORIGIN") ?? "*"

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, authorization",
  "Access-Control-Max-Age": "86400",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizePhone(raw: string) {
  const digits = (raw || "").replace(/\D/g, "")
  if (digits.length < 10) return null
  return digits.slice(-10)
}

function normalizeZip(raw: string) {
  const digits = (raw || "").replace(/\D/g, "")
  if (digits.length < 5) return null
  return digits.slice(0, 5)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  if (!TARGET_ORG_ID) {
    console.error("LEADS_TARGET_ORG_ID is not set")
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400)
  }

  const fullName = String(payload.full_name ?? "").trim()
  const email = String(payload.email ?? "").trim().toLowerCase()
  const phoneRaw = String(payload.phone ?? "").trim()
  const zipRaw = String(payload.zip ?? "").trim()
  const medicaidRaw = String(payload.medicaid_number ?? "").trim()
  const medicaidNumber = medicaidRaw.length > 0 ? medicaidRaw : null

  if (!fullName) return jsonResponse({ error: "full_name is required" }, 400)
  if (!email || !isValidEmail(email)) return jsonResponse({ error: "valid email is required" }, 400)

  const phone = normalizePhone(phoneRaw)
  if (!phone) return jsonResponse({ error: "valid 10-digit phone is required" }, 400)

  const zip = normalizeZip(zipRaw)
  if (!zip) return jsonResponse({ error: "valid 5-digit zip is required" }, 400)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Look up county; if found we tag state='GA', otherwise OUT_OF_STATE.
  const { data: zipRow } = await supabase
    .from("ga_zip_counties")
    .select("county")
    .eq("zip", zip)
    .maybeSingle()

  const county = zipRow?.county ?? null
  const state = county ? "GA" : "OUT_OF_STATE"

  const { error: insertError } = await supabase.from("leads").insert({
    organization_id: TARGET_ORG_ID,
    full_name: fullName,
    email,
    phone,
    zip,
    county,
    state,
    medicaid_number: medicaidNumber,
    status: "new",
  })

  if (insertError) {
    console.error("Insert failed:", insertError)
    return jsonResponse({ error: "Could not save submission" }, 500)
  }

  return jsonResponse({ success: true })
})
