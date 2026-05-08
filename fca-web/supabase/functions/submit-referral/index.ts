// fca-web/supabase/functions/submit-referral/index.ts
// Public endpoint for friendlycareagency.org/ref/<slug> referral submissions.
// - Resolves marketer by slug (current or alias) via service-role client
// - Validates honeypot, applies per-IP rate limit
// - Inserts into `referrals` matching the staff form's JSON-in-`notes` shape
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const RATE_LIMIT_MAX = 5;          // submissions
const RATE_LIMIT_WINDOW_SEC = 3600; // per hour, per IP

// In-memory rate limiter (sufficient for low-volume public form; resets on cold start).
// If volume grows, swap to a `submission_rate_limits` table with upsert + window query.
const ipHits = new Map<string, number[]>();

function rateLimit(ip: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - RATE_LIMIT_WINDOW_SEC;
  const arr = (ipHits.get(ip) ?? []).filter((t) => t > cutoff);
  if (arr.length >= RATE_LIMIT_MAX) {
    ipHits.set(ip, arr);
    return false;
  }
  arr.push(now);
  ipHits.set(ip, arr);
  return true;
}

type ServicesNeeded =
  | 'Ambulating/Transferring'
  | 'Bathing'
  | 'Dressing'
  | 'Feeding'
  | 'Hygiene/Grooming'
  | 'Basic Housekeeping'
  | 'Errand Assistance'
  | 'Emergency Response/Alert System or Device'
  | 'Do you require supplies to accommodate your individual needs?';

interface IncomingPayload {
  // Routing
  slug: string;

  // Anti-spam
  hp?: string; // honeypot — must be empty string

  // Person being referred
  referral_name: string;
  sex: 'Female' | 'Male' | 'Prefer not to say';
  referral_dob: string;       // YYYY-MM-DD
  medicaid_or_ssn: string;    // formatted ###-##-####
  phone: string;              // formatted (###) ###-####

  // Caregiver
  caregiver_name: string;
  caregiver_relationship: string;
  caregiver_phone: string;
  caregiver_lives_in_home: 'Yes' | 'No';

  // Address
  address_line1: string;
  address_line2?: string;
  city: string;
  zip: string;
  county?: string;
  state: string;

  // Care
  requested_program: string;
  physician: string;
  diagnosis: string;
  services_needed: ServicesNeeded[];

  // Benefits
  receives_benefits: 'Yes' | 'No';
  benefits_pay_date?: '1st' | '3rd';

  // Source
  heard_about_us: string;     // already-merged "Other: <text>" if applicable
  additional_info?: string;
}

function validate(p: IncomingPayload): string | null {
  const required = [
    'slug', 'referral_name', 'sex', 'referral_dob', 'medicaid_or_ssn', 'phone',
    'caregiver_name', 'caregiver_relationship', 'caregiver_phone', 'caregiver_lives_in_home',
    'address_line1', 'city', 'zip', 'state',
    'requested_program', 'physician', 'diagnosis',
    'receives_benefits', 'heard_about_us'
  ] as const;
  for (const k of required) {
    const v = (p as Record<string, unknown>)[k];
    if (typeof v !== 'string' || v.trim() === '') return `Missing required field: ${k}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.referral_dob)) return 'Invalid referral_dob';
  if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(p.phone)) return 'Invalid phone format';
  if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(p.caregiver_phone)) return 'Invalid caregiver_phone format';
  if (!/^\d{3}-\d{2}-\d{4}$/.test(p.medicaid_or_ssn)) return 'Invalid medicaid_or_ssn format';
  if (!Array.isArray(p.services_needed)) return 'services_needed must be an array';
  if (p.receives_benefits === 'Yes' && !p.benefits_pay_date) return 'benefits_pay_date required when receives_benefits is Yes';
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';

  if (!rateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Too many submissions. Please try again later.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: IncomingPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Honeypot: bots fill all fields, real users never see/touch this
  if (payload.hp && payload.hp.trim() !== '') {
    // Pretend success so bots don't learn they were caught
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const validationError = validate(payload);
  if (validationError) {
    return new Response(JSON.stringify({ error: validationError }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve marketer (authoritative server-side lookup; client cannot spoof)
  const { data: marketers, error: marketerErr } = await supabase
    .from('marketers')
    .select('id, name, email, organization_id, is_active')
    .or(`referral_slug.eq.${payload.slug},id.eq.${'00000000-0000-0000-0000-000000000000'}`)
    .limit(1);

  // The above .or() trick handles the citext direct match. For the alias path we do a second query.
  let marketer = (marketers ?? []).find((m) => m.is_active) ?? null;
  if (!marketer) {
    const { data: aliasRows } = await supabase
      .from('marketer_slug_aliases')
      .select('marketer_id')
      .eq('slug', payload.slug)
      .limit(1);
    const aliasMarketerId = aliasRows?.[0]?.marketer_id;
    if (aliasMarketerId) {
      const { data: m2 } = await supabase
        .from('marketers')
        .select('id, name, email, organization_id, is_active')
        .eq('id', aliasMarketerId)
        .limit(1)
        .maybeSingle();
      if (m2?.is_active) marketer = m2;
    }
  }

  if (!marketer || marketerErr) {
    return new Response(JSON.stringify({ error: 'Unknown referral link' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build the JSON-in-notes payload to match the staff app's existing shape
  const { slug: _slug, hp: _hp, heard_about_us, ...rest } = payload;

  const notesPayload = {
    ...rest,
    heard_about_us,
    state: payload.state,
    marketer_id: marketer.id,
    marketer_name: marketer.name,
    marketer_email: marketer.email ?? null,
    submission_source: 'public_website',
  };

  const { error: insertErr } = await supabase.from('referrals').insert({
    organization_id: marketer.organization_id,
    client_id: null,
    referred_by: marketer.name,
    referral_date: new Date().toISOString().slice(0, 10),
    referral_source: heard_about_us,
    notes: JSON.stringify(notesPayload),
  });

  if (insertErr) {
    console.error('referral insert failed', insertErr);
    return new Response(JSON.stringify({ error: 'Could not save referral' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, marketer_name: marketer.name }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
