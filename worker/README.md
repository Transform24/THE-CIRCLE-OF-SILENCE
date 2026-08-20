# lively-dew-924c

Source of truth for the `lively-dew-924c` Cloudflare Worker. Previously this
Worker was edited directly in the Cloudflare dashboard's quick editor; this
directory brings it under version control.

## Routes

- `POST /mailerlite-subscribe` — adds an email to a MailerLite group.
  Body: `{ "email": "...", "name": "...", "groupKey": "A" | "B" | "C" | "D" | "NB" }`.
- `GET /verify-purchase?session_id=cs_...` — verifies a Stripe Checkout
  Session (created via one of the gate payment links) and returns which
  gate it paid for.

  Responses:
  - `200 { verified: true, gate, sessionId, amountTotal, currency }`
  - `4xx/5xx { verified: false, error }` for invalid session id
    (`invalid_session_id`), unknown/expired session (`session_not_found`),
    unpaid session (`not_paid`), a session that doesn't match one of the
    six gate payment links (`unknown_gate`), or a missing `STRIPE_SECRET_KEY`
    (`not_configured`).

## Required secrets

Set these on the Worker (dashboard → Settings → Variables, or
`wrangler secret put <NAME>` from this directory):

- `MAILERLITE_API_KEY` — currently exists as a plain-text variable with an
  **empty value**, so `/mailerlite-subscribe` does not actually work yet.
  Recommend converting it to an encrypted secret when setting the real key.
- `STRIPE_SECRET_KEY` — **not yet set**. Required for `/verify-purchase` to
  work; until it's set, that route returns `503 not_configured`.

## Deploying

```
cd worker
wrangler deploy
```

## Notes / assumptions to confirm

- `ALLOWED_ORIGINS` in `worker.js` is set to `https://transform24.github.io`
  as a placeholder (guessed from the repo's GitHub Pages workflow — there's
  no `CNAME` file and no Cloudflare Pages project on this account). Update
  it to the site's actual origin, or the browser will block the response.
- Gate → Stripe Payment Link mapping is read from the `href`s in
  `gate-one.html` through `gate-six.html`. If those links change, update
  `GATE_PAYMENT_LINKS` in `worker.js` to match.
- The gate pages don't currently call `/verify-purchase` at all — none of
  them redirect to a success page or read a `session_id` after checkout.
  Wiring that up (post-payment redirect + unlock logic in the gate pages)
  is a separate follow-up; this change only adds the Worker endpoint.
