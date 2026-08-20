# CLAUDE.md

This file reflects **verified current reality only**, checked directly against the code in this repo as of 2026-08-20. Nothing below is copied from a prior doc or a prompt's claims without being confirmed against actual files. If a future session's task description asserts something about this repo that isn't in this file (a workflow, an integration, a prior fix), **verify it against the actual files before trusting it** — this repo has repeatedly been the subject of task prompts describing infrastructure that was never actually committed here.

## What this repo is

Sanctuary Grace Ministry's web funnel: **The Quiet Authority (TQA) → The Secret Place → How to Pray → the habit-tracker app → Circle of Silence (7 paid gates)**. It is 11 static HTML files, nothing else — no build system, no package.json, no server, no `.github/workflows/`, no CI. Every page is fully self-contained (inline `<style>` and `<script>`).

| File | Role |
|---|---|
| `INDEX.HTML` | The Quiet Authority — 8-question quiz, reveals a "Silence Profile," free |
| `the-secret-place.html` | "Which Woman Are You" quiz → philosophy/method explainer, free |
| `how-to-pray.html` | Bridge page: Matthew 6:6–13 (KJV) prayer pattern, free |
| `secret-place-app.html` | The actual habit-tracker tool — silence timer, journal ("Record"), audio library, free |
| `gate-zero.html` | Circle of Silence Gate Zero — free |
| `gate-one.html` … `gate-six.html` | Circle of Silence Gates One–Six — $9 each via Stripe Payment Links, one-time |

### Funnel path (as currently wired in code)
`INDEX.HTML` → `the-secret-place.html` → `how-to-pray.html` → `secret-place-app.html` → `gate-zero.html` → `gate-one.html` → `gate-two.html` → `gate-three.html` → `gate-four.html` → `gate-five.html` → `gate-six.html`

Every page in this chain writes a `{step, label, url}` object to `localStorage['sg_last_step']` on load. `INDEX.HTML` and `the-secret-place.html` read it back and show a "continue where you left off" banner if the visitor has gotten further than that page — client-side only, per-browser, no backend.

## Payment: Stripe Payment Links, unlock is NOT verified server-side

Each gate's own buy button is a static `buy.stripe.com` Payment Link, hardcoded per file (grep `buy.stripe.com` in each `gate-*.html` for the current URLs — do not hand-copy them into another doc, re-verify at time of use since these can be regenerated in Stripe).

**Unlock mechanism, and its problem:** after a Stripe purchase, the buyer presumably lands back on the gate page with `?purchased=gateN` in the URL (this redirect is configured in the Stripe dashboard, not in this repo — unverified from code alone). Each gate page's own JavaScript checks that query param client-side and, if present, hides the buy section and reveals the paid toolkit:

```js
if (params.get('purchased') === 'gate1') {
  document.getElementById('buy-section').style.display = 'none';
  document.getElementById('toolkit-section').style.display = 'block';
}
```

**This is not a real paywall.** There is no server, webhook, or API call anywhere in this repo that verifies the purchase actually happened. Anyone can type `gate-N.html?purchased=gateN` into a browser and get the full paid content for any gate, free, right now. Confirmed live by reading the code directly (not assumed) — this is unfixed and needs a real backend (e.g., a Cloudflare Worker verifying a Stripe webhook and issuing a signed token) before it can be trusted. Do not report this as "fixed" unless a session actually adds server-side verification and someone confirms it.

## Email / lead capture — mixed, unmigrated

- **Beacons** is live and active in `INDEX.HTML` only: an embedded email-capture form (`beacons.ai/embeds/emailForm.js`) and a direct `fetch()` to `beacons.ai/api/v1/email-form/.../subscribe` on quiz completion (lines ~450–470, ~731–737).
- **Formspree** (`formspree.io/f/xeoqkgjb`) is live in `INDEX.HTML`, used only to notify Grace by email of new quiz completions and salvation decisions — not a subscriber list.
- **Systeme.io** links are still live in the code, status of the underlying account **unverified** — 5 total:
  - `gate-zero.html:153` — "Save My Progress" → `tdwdemp.systeme.io/2582a435`
  - `the-secret-place.html:133,147,161,175` — "Send Me My Result By Email" (×4) → `tdwdemp.systeme.io/e23b27d5`
- **MailerLite**: no reference anywhere in this repo's code. If MailerLite is the intended email engine going forward, it has not been wired into any file here yet — that is future work, not a completed migration.
- **Cloudflare Worker**: no reference anywhere in this repo's code. If one exists in a Cloudflare account, it is not connected to anything in this repo currently.

Do not describe MailerLite or a Cloudflare Worker as "the current email engine" in this repo until an actual file here calls them — grep for `mailerlite` and `worker` to re-check before writing that claim.

## Known gaps / open decisions (not yet fixed, by design — need Grace's decision)

1. **Paywall bypass** — see above. Needs backend infrastructure, not a doc fix.
2. **5 Systeme.io links** — dead or alive unconfirmed; if dead, need a replacement destination decided before repointing.
3. **No inventory docs, no workflows** — this repo has no automation of any kind. Any task description referencing `gate-buyer-sync.yml`, agent pipelines, or other `.md` planning docs is describing something that does not exist here.

## Working conventions in this codebase

- Theme: `#0d0d0d` background, `#C9A84C` gold, `#F5F0E8` cream text, Cormorant Garamond serif + sans-serif labels — consistent across every Secret Place/Circle of Silence page except `INDEX.HTML`, which uses its own separate TQA palette (CSS custom properties `--gold`, `--sage`, `--cream`, etc.).
- Per-gate form fields persist to `localStorage` under keys like `gate1_response`, `gate6_becoming` — check the bottom `<script>` block of each gate file for its exact keys before adding new ones.
- `INDEX.HTML`'s canonical URL (`transform24.github.io/THE-QUIET-AUTHORITY/`) differs from every other page's canonical domain (`sanctuary-grace.com`) — unresolved inconsistency, not yet investigated.
