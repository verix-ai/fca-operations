// Edge Function: facebook-lead-webhook
//
// Receives Facebook Lead Ads webhook deliveries and inserts the resulting
// leads into the `leads` table (source='facebook').
//
// Flow:
//   1. Meta POSTs us a tiny envelope { leadgen_id, form_id, page_id, ... }.
//      No PII is in the webhook payload by design.
//   2. We verify X-Hub-Signature-256 against FB_APP_SECRET, then call the
//      Graph API with FB_PAGE_ACCESS_TOKEN to fetch the real field_data.
//   3. We normalize and insert the lead, using facebook_leadgen_id as the
//      idempotency key (Meta retries on non-2xx, sometimes duplicates).
//   4. We ALWAYS return 200 OK once we've ACKed receipt, so Meta doesn't
//      retry for hours. Failures are logged for `supabase functions logs`.
//
// Webhook verification handshake (GET) is handled separately at the top.
//
// Required env vars (set with: supabase secrets set --env-file ./supabase/functions/.env)
//   SUPABASE_URL                  - injected automatically
//   SUPABASE_SERVICE_ROLE_KEY     - injected automatically
//   FB_VERIFY_TOKEN               - random string; must match the value pasted
//                                   into the Meta webhook subscription dialog.
//   FB_APP_SECRET                 - from Meta App Dashboard → Settings → Basic.
//                                   Used to verify X-Hub-Signature-256.
//   FB_PAGE_ACCESS_TOKEN          - long-lived Page access token for the
//                                   FriendlyCare Facebook Page.
//   FB_LEADS_TARGET_ORG_ID        - organization UUID to insert leads under.

// @ts-ignore Deno-specific import
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
// @ts-ignore Deno-specific import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"
import {
  normalizeEmail,
  normalizeFullName,
  normalizeMedicaid,
  normalizePhone,
  normalizeZip,
} from "../_shared/lead-normalize.ts"

// @ts-ignore Deno global
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
// @ts-ignore Deno global
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
// @ts-ignore Deno global
const VERIFY_TOKEN = Deno.env.get("FB_VERIFY_TOKEN") ?? ""
// @ts-ignore Deno global
const APP_SECRET = Deno.env.get("FB_APP_SECRET") ?? ""
// @ts-ignore Deno global
const PAGE_ACCESS_TOKEN = Deno.env.get("FB_PAGE_ACCESS_TOKEN") ?? ""
// @ts-ignore Deno global
const TARGET_ORG_ID = Deno.env.get("FB_LEADS_TARGET_ORG_ID") ?? ""

const GRAPH_API_VERSION = "v21.0"

function ok(body: unknown = "ok") {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 200 })
}

function unauthorized(reason: string) {
  console.warn("Rejected webhook:", reason)
  return new Response("Unauthorized", { status: 401 })
}

// Meta sends X-Hub-Signature-256: sha256=<hex digest of body using app secret>.
// Constant-time compare prevents timing attacks.
async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  if (!header || !header.startsWith("sha256=")) return false
  if (!APP_SECRET) {
    console.error("FB_APP_SECRET is not set; rejecting all webhooks")
    return false
  }

  const expectedHex = header.slice("sha256=".length).toLowerCase()

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody))
  const actualHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // Constant-time compare
  if (expectedHex.length !== actualHex.length) return false
  let mismatch = 0
  for (let i = 0; i < expectedHex.length; i++) {
    mismatch |= expectedHex.charCodeAt(i) ^ actualHex.charCodeAt(i)
  }
  return mismatch === 0
}

interface FbFieldDatum { name: string; values: string[] }

interface ParsedLead {
  full_name: string
  email: string | null
  phone: string | null
  zip: string | null
  medicaid_number: string | null
}

// Facebook lead form question "names" vary by form. Match leniently.
function pickField(fieldData: FbFieldDatum[], candidates: string[]): string | undefined {
  const lowered = fieldData.map((f) => ({ name: f.name?.toLowerCase() ?? "", value: f.values?.[0] }))
  for (const candidate of candidates) {
    const hit = lowered.find((f) => f.name === candidate)
    if (hit?.value) return hit.value
  }
  // Fallback: substring match (e.g. "what is your phone number?" contains "phone")
  for (const candidate of candidates) {
    const hit = lowered.find((f) => f.name.includes(candidate))
    if (hit?.value) return hit.value
  }
  return undefined
}

function parseFieldData(fieldData: FbFieldDatum[]): ParsedLead {
  const firstName = pickField(fieldData, ["first_name", "first name", "firstname"])
  const lastName = pickField(fieldData, ["last_name", "last name", "lastname"])
  const combined = pickField(fieldData, ["full_name", "full name", "name"])

  const full_name = normalizeFullName(
    combined ?? [firstName, lastName].filter(Boolean).join(" "),
  )

  return {
    full_name,
    email: normalizeEmail(pickField(fieldData, ["email", "email_address", "e-mail"])),
    phone: normalizePhone(pickField(fieldData, ["phone_number", "phone", "mobile", "cell"])),
    zip: normalizeZip(pickField(fieldData, ["zip_code", "zip", "postal_code", "zipcode", "post code"])),
    medicaid_number: normalizeMedicaid(
      pickField(fieldData, ["medicaid_number", "medicaid_id", "medicaid", "ga_medicaid"]),
    ),
  }
}

async function fetchLeadFromGraph(leadgenId: string): Promise<FbFieldDatum[]> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(leadgenId)}` +
    `?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN)}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Graph API ${res.status}: ${body}`)
  }
  const json = await res.json() as { field_data?: FbFieldDatum[] }
  return json.field_data ?? []
}

interface LeadgenEvent {
  leadgen_id: string
  form_id?: string
  page_id?: string
  ad_id?: string
  created_time?: number
}

function extractLeadgenEvents(payload: unknown): LeadgenEvent[] {
  const events: LeadgenEvent[] = []
  // deno-lint-ignore no-explicit-any
  const root = payload as any
  if (root?.object !== "page") return events
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue
      const v = change.value ?? {}
      if (typeof v.leadgen_id === "string") {
        events.push({
          leadgen_id: v.leadgen_id,
          form_id: v.form_id,
          page_id: v.page_id,
          ad_id: v.ad_id,
          created_time: v.created_time,
        })
      }
    }
  }
  return events
}

async function processLeadgenEvent(
  supabase: ReturnType<typeof createClient>,
  event: LeadgenEvent,
): Promise<void> {
  const fieldData = await fetchLeadFromGraph(event.leadgen_id)
  const parsed = parseFieldData(fieldData)

  if (!parsed.full_name) {
    console.error(`Lead ${event.leadgen_id} has no usable name; field_data:`, fieldData)
    return
  }

  let county: string | null = null
  let state: "GA" | "OUT_OF_STATE" = "OUT_OF_STATE"
  if (parsed.zip) {
    const { data: zipRow } = await supabase
      .from("ga_zip_counties")
      .select("county")
      .eq("zip", parsed.zip)
      .maybeSingle()
    county = (zipRow as { county?: string } | null)?.county ?? null
    state = county ? "GA" : "OUT_OF_STATE"
  }

  const { error } = await supabase.from("leads").insert({
    organization_id: TARGET_ORG_ID,
    full_name: parsed.full_name,
    email: parsed.email,
    phone: parsed.phone,
    zip: parsed.zip,
    county,
    state,
    medicaid_number: parsed.medicaid_number,
    status: "new",
    source: "facebook",
    facebook_leadgen_id: event.leadgen_id,
  })

  if (error) {
    // 23505 = unique_violation — Meta retried a delivery we already processed.
    // Anything else (RLS, FK, check constraint) gets logged for triage but
    // we don't surface it to Meta: returning 5xx would trigger more retries.
    if ((error as { code?: string }).code === "23505") {
      console.log(`Duplicate leadgen_id ${event.leadgen_id}; skipping.`)
    } else {
      console.error(`Insert failed for leadgen ${event.leadgen_id}:`, error)
    }
  } else {
    console.log(`Inserted Facebook lead ${event.leadgen_id} (form ${event.form_id ?? "?"})`)
  }
}

serve(async (req) => {
  const url = new URL(req.url)

  // -------- GET: webhook verification handshake --------
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode")
    const token = url.searchParams.get("hub.verify_token")
    const challenge = url.searchParams.get("hub.challenge")
    if (mode === "subscribe" && token && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 })
    }
    return unauthorized("verify token mismatch or missing params")
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  // -------- POST: lead delivery --------
  // Read raw body BEFORE parsing JSON — signature is over the exact bytes.
  const rawBody = await req.text()
  const signatureOk = await verifySignature(rawBody, req.headers.get("x-hub-signature-256"))
  if (!signatureOk) {
    return unauthorized("invalid x-hub-signature-256")
  }

  if (!PAGE_ACCESS_TOKEN || !TARGET_ORG_ID) {
    console.error("FB_PAGE_ACCESS_TOKEN or FB_LEADS_TARGET_ORG_ID is not set")
    // Still ACK to Meta — keep the queue moving; we'll find this in the logs.
    return ok({ received: true, processed: 0 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    console.error("Invalid JSON from Meta webhook")
    return ok({ received: true, processed: 0 })
  }

  const events = extractLeadgenEvents(payload)
  if (events.length === 0) {
    return ok({ received: true, processed: 0 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Process sequentially. Volume per webhook is tiny (usually 1 lead);
  // parallelism would just complicate error handling.
  let processed = 0
  for (const event of events) {
    try {
      await processLeadgenEvent(supabase, event)
      processed++
    } catch (err) {
      console.error(`Failed to process leadgen ${event.leadgen_id}:`, err)
    }
  }

  return ok({ received: true, processed })
})
