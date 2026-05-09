// fca-web/supabase/functions/submit-referral/index.ts
// Public endpoint for friendlycareagency.org/ref/<slug> referral submissions.
// - Resolves any active office user (admin/marketer) by slug or alias via service-role client
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
    const v = (p as unknown as Record<string, unknown>)[k];
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

  // Reject oversized bodies before they reach req.json() to avoid OOM. 32KB is generous for a form payload.
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > 32768) {
    return new Response(JSON.stringify({ error: 'Payload too large' }), {
      status: 413,
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

  // Direct slug match on users
  const { data: u1, error: u1Err } = await supabase
    .from('users')
    .select('id, name, email, role, organization_id, is_active')
    .eq('referral_slug', payload.slug)
    .maybeSingle();

  const OFFICE_ROLES = ['admin', 'marketer'];
  const isOfficeRole = (role: string | null | undefined) =>
    typeof role === 'string' && OFFICE_ROLES.includes(role);

  let referrer = (u1?.is_active && isOfficeRole(u1.role)) ? u1 : null;

  // Alias fallback
  if (!referrer) {
    const { data: alias } = await supabase
      .from('user_slug_aliases')
      .select('user_id')
      .eq('slug', payload.slug)
      .maybeSingle();
    if (alias?.user_id) {
      const { data: u2 } = await supabase
        .from('users')
        .select('id, name, email, role, organization_id, is_active')
        .eq('id', alias.user_id)
        .maybeSingle();
      if (u2?.is_active && isOfficeRole(u2.role)) referrer = u2;
    }
  }

  if (!referrer || u1Err) {
    return new Response(JSON.stringify({ error: 'Unknown referral link' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build the JSON-in-notes payload. Generic referrer_* keys are the new shape;
  // marketer_* keys are kept for backward-compat with existing dashboards when the
  // resolved user happens to be a marketer.
  const { slug: _slug, hp: _hp, ...rest } = payload;

  const notesPayload: Record<string, unknown> = {
    ...rest,
    referrer_user_id: referrer.id,
    referrer_name: referrer.name,
    referrer_email: referrer.email ?? null,
    referrer_role: referrer.role,
    submission_source: 'public_website',
  };

  if (referrer.role === 'marketer') {
    // Look up the marketers row so existing reports keyed off marketer_id keep working.
    const { data: m } = await supabase
      .from('marketers')
      .select('id, name, email')
      .eq('user_id', referrer.id)
      .maybeSingle();
    if (m) {
      notesPayload.marketer_id = m.id;
      notesPayload.marketer_name = m.name;
      notesPayload.marketer_email = m.email ?? null;
    }
  }

  const { error: insertErr } = await supabase.from('referrals').insert({
    organization_id: referrer.organization_id,
    client_id: null,
    referred_by: referrer.name,
    referral_date: new Date().toISOString().slice(0, 10),
    referral_source: payload.heard_about_us,
    notes: JSON.stringify(notesPayload),
  });

  if (insertErr) {
    console.error('referral insert failed', insertErr);
    return new Response(JSON.stringify({ error: 'Could not save referral' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, referrer_name: referrer.name }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
