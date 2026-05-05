# FriendlyCare — Check Eligibility Form Integration

This is the contract for the FriendlyCare **website team**. The website's
"Check Eligibility" form sends submissions to a Supabase Edge Function called
`submit-lead`. The function inserts a row into the `leads` table inside the FCA
operations app, where call-center agents follow up on it.

---

## Endpoint

```
POST https://<PROJECT_REF>.supabase.co/functions/v1/submit-lead
```

Replace `<PROJECT_REF>` with the FriendlyCare Supabase project reference. Ask
the FCA Ops team for the exact URL — it's the same project that powers the FCA
Operations app.

## Headers

| Header           | Value                                                            |
| ---------------- | ---------------------------------------------------------------- |
| `Content-Type`   | `application/json`                                               |
| `apikey`         | The Supabase **anon** public key (provided by FCA Ops)           |
| `Authorization`  | `Bearer <anon-key>` (same key as above)                          |

> The `apikey` / `Authorization` headers are required by the Supabase Functions
> gateway. They identify the project, **not** the user — they are safe to ship
> in client-side code.

## Request body

```json
{
  "full_name": "Jane Smith",
  "phone": "(404) 555-1234",
  "email": "jane@example.com",
  "zip": "30303",
  "medicaid_number": "123456789012"
}
```

### Field rules

| Field             | Required | Notes                                                          |
| ----------------- | -------- | -------------------------------------------------------------- |
| `full_name`       | yes      | Free-form text. We trim whitespace.                            |
| `phone`           | yes      | Any format — we strip non-digits. Must contain ≥ 10 digits.    |
| `email`           | yes      | Must look like an email. We lowercase it.                      |
| `zip`             | yes      | Any format — we strip non-digits. Must contain ≥ 5 digits.     |
| `medicaid_number` | optional | GA Medicaid #. Free-form text — we accept whatever you send. Omit or pass empty/null if the user didn't fill it in. |

The function will derive `county` and `state` (`GA` vs `OUT_OF_STATE`)
server-side from the ZIP. The website does **not** need to send those.

## Response

### Success — `200 OK`
```json
{ "success": true }
```

### Validation error — `400 Bad Request`
```json
{ "error": "valid 5-digit zip is required" }
```

### Server error — `500`
```json
{ "error": "Could not save submission" }
```

---

## Example: vanilla `fetch`

```js
async function submitEligibility(form) {
  const response = await fetch(
    'https://<PROJECT_REF>.supabase.co/functions/v1/submit-lead',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: '<SUPABASE_ANON_KEY>',
        Authorization: 'Bearer <SUPABASE_ANON_KEY>',
      },
      body: JSON.stringify({
        full_name: form.fullName,
        phone: form.phone,
        email: form.email,
        zip: form.zip,
        medicaid_number: form.medicaidNumber, // optional — omit or null if blank
      }),
    }
  )

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({}))
    throw new Error(error || 'Submission failed')
  }
  return response.json()
}
```

## Example: `curl`

```bash
curl -X POST \
  https://<PROJECT_REF>.supabase.co/functions/v1/submit-lead \
  -H "Content-Type: application/json" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -d '{
    "full_name": "Test Lead",
    "phone": "404-555-0100",
    "email": "test@example.com",
    "zip": "30303"
  }'
```

---

## Notes for the website team

- **No CORS work needed on your side** — the function returns the appropriate
  CORS headers. The FCA Ops team configures `LEADS_ALLOWED_ORIGIN` server-side.
  Tell us your production origin (e.g. `https://friendlycare.com`) and any
  staging domains.
- **No spam protection right now.** If we start seeing junk submissions,
  we'll add a CAPTCHA / honeypot. No action needed yet.
- **Out-of-state** submissions are accepted — they're flagged
  `state: OUT_OF_STATE` and shown in a separate filter in the FCA app. You do
  not need to block non-GA ZIPs on the form.

---

## Server-side setup (FCA Ops only)

The Edge Function lives at [supabase/functions/submit-lead/index.ts](../supabase/functions/submit-lead/index.ts).

### Required Supabase secrets

```bash
supabase secrets set LEADS_TARGET_ORG_ID=<friendlycare-organization-uuid>
supabase secrets set LEADS_ALLOWED_ORIGIN=https://friendlycare.com
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### Deploy

```bash
supabase functions deploy submit-lead --project-ref <PROJECT_REF>
```

### Migrations to apply first

1. [supabase/migrations/20260505_create_leads.sql](../supabase/migrations/20260505_create_leads.sql) — schema
2. [supabase/migrations/20260505_seed_ga_zip_counties.sql](../supabase/migrations/20260505_seed_ga_zip_counties.sql) — 707 GA ZIPs across all 159 counties
