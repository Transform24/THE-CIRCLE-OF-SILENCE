# The Circle of Silence — Workspace
*Last updated: 2026-08-22*

This repo is entirely live product surface — there is no documentation layer, no scripts, no separate content-ops substrate to restructure. Every file here is either a page real visitors and buyers see, or the backend that gates payment to them. This file exists only to close the one real ICM gap the repo had: no entry point at all. Nothing has been moved to create it.

## What's here

| File | What it is |
|---|---|
| `gate-zero.html` | Free entry gate — Brain Dump + Checklist tools, email opt-in |
| `gate-one.html` … `gate-six.html` | The six paid gates, $9 each via Stripe Payment Link, unlocked by `/verify-purchase` |
| `secret-place-app.html` | Habit tracker product |
| `the-secret-place.html` | Free entry experience, email capture |
| `INDEX.HTML` | **Unclear/stray — see Known Issues.** Its content is The Quiet Authority's landing page, not this repo's. |
| `worker/` | The live Cloudflare Worker (`lively-dew-924c`) — paywall verification + MailerLite subscription. Its own `README.md` is a solid contract (routes, inputs, outputs) but see Known Issues for where it's stale. |

## The paywall flow

1. Buyer clicks a gate's Stripe Payment Link (hardcoded in both the gate page and `worker/worker.js`'s `GATE_PAYMENT_LINKS` — verified in sync as of this pass, all six match).
2. Stripe's Payment Link "after payment" redirect is supposed to send them back to `https://sanctuary-grace.com/gate-<name>.html?session_id={CHECKOUT_SESSION_ID}` — **this per-Payment-Link Stripe dashboard setting was never confirmed** (noted in `worker/README.md`; still unconfirmed as of this pass). Without it, `session_id` never reaches the page and nothing auto-unlocks.
3. The gate page's bottom `<script>` block calls `GET /verify-purchase?session_id=...` on the Worker.
4. The Worker looks up the session with Stripe, matches its Payment Link URL against `GATE_PAYMENT_LINKS` to determine which gate was purchased, and returns `verified: true/false`.
5. On success, the buyer's email (if Stripe collected one) is added to that gate's MailerLite "Buyer" group — this is what triggers the gate's 11-step welcome sequence (built in MailerLite, currently disabled/waiting per the Worker's README). This join is fire-and-forget: a MailerLite failure never re-locks content someone already paid for.
6. A successful verification is cached in `localStorage` so returning buyers don't need the `session_id` param on every visit.

## Live Worker config — verified directly against Cloudflare, 2026-08-22

`worker/README.md` claims both secrets are unset. **That's stale.** Checked directly via the Cloudflare API (`GET /accounts/.../workers/scripts/lively-dew-924c/settings`), not the README:

| Variable | Status |
|---|---|
| `MAILERLITE_API_KEY` | Set, stored as `secret_text` (properly encrypted — value not readable, which is correct) |
| `STRIPE_SECRET_KEY` | Set — but see Known Issues, this needs attention despite being "set" |

## Known Issues — flagged, not fixed

These are live bugs on the live product, surfaced during this audit. None have been touched — each needs a decision from Grace before anyone acts on it.

### 1. Dead Systeme.io links on two live pages
- `gate-zero.html` — "Save My Progress" button → `https://tdwdemp.systeme.io/2582a435`
- `the-secret-place.html` (4 places) — "Send Me My Result By Email" button → `https://tdwdemp.systeme.io/e23b27d5`

The Systeme.io account under this ministry's Cloudflare identity is permanently shut down. Both buttons currently send real visitors to a dead destination. Replacement (MailerLite, most likely) is being tracked as its own task — not part of this restructure.

### 2. `STRIPE_SECRET_KEY` stored as `plain_text`, not `secret_text`
Unlike `MAILERLITE_API_KEY`, this variable is not encrypted at rest on the Worker — its value is readable by anyone with dashboard or API read access to the Worker's settings (confirmed: the same read call used to verify it exists returned its literal value). Fix: rotate the key in Stripe, then re-add it via `wrangler secret put STRIPE_SECRET_KEY` (or the dashboard's "Encrypt" toggle) so it becomes `secret_text` like the MailerLite key.

### 3. `STRIPE_SECRET_KEY` appears to be a test-mode key
The key currently set begins `rk_test_...` — Stripe's own prefix for a restricted **test-mode** key. If the six gate Payment Links buyers actually pay through are live-mode (the normal case for a product taking real payments), a test-mode key cannot verify those checkout sessions — Stripe segregates test and live data completely, so a lookup against a live `session_id` with a test key returns `session_not_found`. **If true, `/verify-purchase` is currently failing for every real paying buyer**, silently denying them content they already paid for (per the fire-and-forget/never-relock design, they'd just see `verified: false` and stay locked out — no error surfaces to Grace). Needs confirmation: are the gate Payment Links live-mode? If so, this needs a live-mode key.

### 4. `INDEX.HTML` — unclear identity
Its `<title>` and `og:url` are The Quiet Authority's landing page (`https://transform24.github.io/THE-QUIET-AUTHORITY/`), not Circle of Silence content. Confirmed a stray, not intentional. Not deleted or touched — flagged for whoever eventually decides what should live at this repo's root instead.

### 5. `worker/README.md` is stale on Worker secret status
Says both `STRIPE_SECRET_KEY` and `MAILERLITE_API_KEY` are unset. Both are actually set (see table above). Worth a pass to bring that file's "Required secrets" section in line with the verified state here, once the plain_text/test-mode issues above are resolved (no point updating it twice).

## Gate → Stripe → MailerLite group mapping (from `worker/worker.js`, for reference)

| Gate | Stripe Payment Link | MailerLite Buyer group ID |
|---|---|---|
| 1 | buy.stripe.com/eVqfZh8Ba8Od0Es8YGcQU0w | 193979375492793939 |
| 2 | buy.stripe.com/6oU3cv8Bac0pcna0sacQU0x | 194025316835919214 |
| 3 | buy.stripe.com/9B600j9FefcB0EscaScQU0y | 193578269634725820 |
| 4 | buy.stripe.com/dRmdR9g3CfcB72Qgr8cQU0z | 193578191164540344 |
| 5 | buy.stripe.com/6oU00j4kU9Sh3QE7UCcQU0A | 193578072636655259 |
| 6 | buy.stripe.com/eVq8wP8Ba0hHgDqej0cQU0B | 193576760955110675 |

`gate-zero` has no Stripe purchase, so no group mapping applies.
