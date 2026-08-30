# lively-dew-924c

Source of truth for the `lively-dew-924c` Cloudflare Worker. Previously this
Worker was edited directly in the Cloudflare dashboard's quick editor; this
directory brings it under version control.

## Routes

- `POST /mailerlite-subscribe` — adds an email to a MailerLite group.
  Body: `{ "email": "...", "name": "...", "groupKey": "A" | "B" | "C" | "D" | "NB" }`.
- `GET /verify-purchase?session_id=cs_...` — verifies a Stripe Checkout
  Session (created via one of the gate payment links), returns which gate
  it paid for, and — if the session's buyer email is present — adds that
  buyer to the matching gate's MailerLite "Buyer" group, which is what
  triggers that gate's 11-step welcome sequence automation (built in
  MailerLite already, currently disabled/waiting).

  Gate → MailerLite group mapping (`GATE_MAILERLITE_GROUPS` in `worker.js`):
  Gate 1 → `193979375492793939`, Gate 2 → `194025316835919214`,
  Gate 3 → `193578269634725820`, Gate 4 → `193578191164540344`,
  Gate 5 → `193578072636655259`, Gate 6 → `193576760955110675`.
  (Gate 0 has no Stripe purchase, so no group mapping is needed here.)

  Responses:
  - `200 { verified: true, gate, sessionId, amountTotal, currency }`
  - `4xx/5xx { verified: false, error }` for invalid session id
    (`invalid_session_id`), unknown/expired session (`session_not_found`),
    unpaid session (`not_paid`), a session that doesn't match one of the
    six gate payment links (`unknown_gate`), or a missing `STRIPE_SECRET_KEY`
    (`not_configured`).

  The MailerLite group-join is fire-and-forget: if it fails, the buyer still
  gets `verified: true` and sees their purchased content — a MailerLite
  hiccup shouldn't relock content someone already paid for. That also means
  a failed group-join is currently silent; if buyers report not receiving
  their welcome sequence, check the Worker's Cloudflare logs.

## Required secrets

Set these on the Worker (dashboard → Settings → Variables, or
`wrangler secret put <NAME>` from this directory):

- `MAILERLITE_API_KEY` — currently exists as a plain-text variable with an
  **empty value**, so `/mailerlite-subscribe` and the `/verify-purchase`
  group-join both silently no-op until this is set. Recommend converting it
  to an encrypted secret when setting the real key.
- `STRIPE_SECRET_KEY` — **not yet set**. Required for `/verify-purchase` to
  work at all; until it's set, that route returns `503 not_configured`.

Neither of these can be read back from the Stripe or MailerLite dashboards
by an API call — Stripe never returns an existing secret key's value over
the API, and this repo's MailerLite connector is OAuth-based with no raw
key exposed. Grace needs to set both directly:
`wrangler secret put STRIPE_SECRET_KEY` / `wrangler secret put MAILERLITE_API_KEY`
from this directory, or via the Cloudflare dashboard → Workers → lively-dew-924c
→ Settings → Variables.

## Deploying

```
cd worker
wrangler deploy
```

## Notes / assumptions to confirm

- `ALLOWED_ORIGINS` in `worker.js` is set to `https://sanctuary-grace.com`,
  confirmed against the canonical/`og:url` tags in THE-QUIET-AUTHORITY's
  `gate-one.html` (the copy actually served at that domain — see "Gate pages
  live elsewhere" below). Update it if the production domain ever changes.
- Gate → Stripe Payment Link mapping (`GATE_PAYMENT_LINKS` in `worker.js`)
  was originally read from the `href`s in `gate-one.html` through
  `gate-six.html`. If those links ever change, update `GATE_PAYMENT_LINKS`
  to match against THE-QUIET-AUTHORITY's copies (see below) — this repo no
  longer carries its own.
- All six gate pages call `/verify-purchase?session_id=...` when a
  `session_id` query param is present, and cache a successful verification
  in `localStorage` so a returning buyer doesn't need the param on every
  visit. **This still requires each Stripe Payment Link's "after payment"
  redirect to be set to append `?session_id={CHECKOUT_SESSION_ID}`** to the
  matching gate page URL (e.g.
  `https://sanctuary-grace.com/gate-one.html?session_id={CHECKOUT_SESSION_ID}`
  for Gate One) — that's a per-Payment-Link setting in the Stripe dashboard,
  outside this repo, and hasn't been confirmed. Without it, `session_id`
  never reaches the gate page and nothing auto-unlocks.

## Gate pages live elsewhere

`gate-one.html` through `gate-six.html` used to be duplicated here and in
THE-QUIET-AUTHORITY, which is what's actually deployed to
`sanctuary-grace.com` (this repo has no `CNAME` and no Pages deployment of
its own — it never served the duplicates it kept). The two copies drifted:
a paywall fix landed here first and, because nothing else read from this
repo's copies, missed the live site until it was ported to
THE-QUIET-AUTHORITY separately (PR #51 there).

To stop that from happening again, this repo's duplicates were deleted.
THE-QUIET-AUTHORITY's copies are the only ones that exist now — edit gate
content there, not here. This repo stays scoped to the Worker (`worker.js`,
this README, `wrangler.toml`), which doesn't need the HTML files at all;
`GATE_PAYMENT_LINKS` and `GATE_MAILERLITE_GROUPS` are already
self-contained constants in `worker.js`.
