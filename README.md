# Sanctuary Grace Ecosystem Hub: Master Blueprint

Owner: Grace (Sanctuary Grace Ministry, Transform24)
Last rebuilt: 2026-10-07
Purpose: This file is the permanent memory baseline. Every session, human or AI, reads this file first, before any other action.

---

## 1. PERMANENT EXECUTION MANDATES (never override)

1. **Scripture is King James Version (KJV) only.** Verify every verse against the KJV before it reaches Grace. Never paraphrase a verse and present it as scripture.
   - Isaiah 43:18 (KJV): "Remember ye not the former things, neither consider the things of old."
   - Luke 4:17-18 (KJV): "And there was delivered unto him the book of the prophet Esaias. And when he had opened the book, he found the place where it was written, The Spirit of the Lord is upon me, because he hath anointed me to preach the gospel to the poor; he hath sent me to heal the brokenhearted, to preach deliverance to the captives, and recovering of sight to the blind, to set at liberty them that are bruised,"
2. **No em dashes, ever.** The long dash character is banned in all copy, code comments, commit messages and documents. Use a period, comma, colon or the word "and" instead.
3. **Humanized, sequential tone.** Write like a caring person walking someone through a path, one step at a time, in order. Plain words, no jargon, no hype, no performative warmth.
4. **Do only what Grace asked.** If a step goes beyond the request, stop and say so in one line.
5. **No paid generation or any cost without Grace approving the cost first.**
6. **Never upload to YouTube.** Grace does her own quality check and uploads herself.
7. **Never ask Grace to paste keys, tokens or passwords into chat.** If a secret is ever shared in chat, stop all work and rotate it.
8. **Never rebuild what already exists.** Search the repos and Drive first.
9. **Grace is not the messenger.** Never ask her to relay, copy or retype what the files already hold.

---

## 2. SESSION START CHECKLIST (every session, in this order)

1. Read this README.md.
2. Read `CLAUDE.md` in the project being touched (Quiet Authority holds the full agent SOP).
3. Read the live truth: `_system/status.md` and `STATUS.txt` in THE-QUIET-AUTHORITY.
4. State three lines to Grace: done, running, next.
5. Work only on what she asked. Update STATUS.txt after every meaningful step.
6. Before calling anything finished: saved to GitHub and Google Drive, sizes compared, STATUS.txt true.

(Claude Code loads `CLAUDE.md` automatically, and that file imports this README, so this baseline is read at the start of every session.)

---

## 3. THE ECOSYSTEM MAP

| Property | GitHub repo | What it is |
|---|---|---|
| The Quiet Authority | `Transform24/THE-QUIET-AUTHORITY` | The main site and hub. Serves sanctuary-grace.com through GitHub Pages. Holds the content agents (Pinterest, Substack, Instagram, YouTube), the approval gate, the gate pages and the shared SOP files. |
| The Circle of Silence | `Transform24/THE-CIRCLE-OF-SILENCE` | The Cloudflare Worker (`lively-dew-924c`) that handles MailerLite sign-ups, Stripe purchase checks, the TWWP and Names of God ebook delivery, and restore-access. Also holds the Secret Place page and ebook assets. |
| The Wilderness | `Transform24/the-wilderness-storefront-` | The Wilderness storefront and book manifest. |

Other repos in the account (not part of this hub): `TQA-2`, `Math-cat`.

### The umbrella workspace
For shared context, the three properties are gathered side by side under one root folder named `sanctuary-grace-ecosystem`:

```
sanctuary-grace-ecosystem/
  README.md                 (this blueprint)
  the-quiet-authority/
  circle-of-silence/
  the-wilderness/
```

IMPORTANT: this umbrella is a working copy for context only. The three GitHub repos stay separate and stay live. See section 6 for why they must not be physically merged.

---

## 4. LIVE INFRASTRUCTURE

- **Domain:** `sanctuary-grace.com` (with a hyphen). Cloudflare zone, active. The spelling `sanctuarygrace.com` (no hyphen) is NOT in the Cloudflare account. Always use the hyphen.
- **Hosting:** GitHub Pages from the root of THE-QUIET-AUTHORITY (`CNAME` file, four GitHub A records, `www` points to `transform24.github.io`). Cloudflare SSL mode: Full.
- **Email engine:** MailerLite (live). Sending authentication is set in Cloudflare DNS (section 5).
- **Payments:** Stripe, live.
- **Worker:** `lively-dew-924c` on Cloudflare Workers. Secrets held in Cloudflare (names only): `MAILERLITE_API_KEY`, `RESTORE_ACCESS_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_TEST_SECRET_KEY`, `TWWP_SEED_SECRET`.
- **Automation (GitHub Actions in THE-QUIET-AUTHORITY):** pinterest-agent (running daily, refreshes its own access token once the one-time setup is done), substack-agent (PAUSED by Grace 2026-10-03, manual run only, saves a DRAFT only and never publishes), substack-deploy (PAUSED, publishes only what Grace moves into `workflows/output/substack-approved/`, and skips anything already marked PUBLISHED in the log), instagram (paused, Meta restriction), youtube, live-smoke-test, ux-check.
- **Secondary domain:** `sanctuarygrace.store`, Cloudflare zone is pending (nameservers not yet switched at the registrar).

---

## 5. EMAIL AUTHENTICATION (MailerLite on sanctuary-grace.com)

These records must exist in Cloudflare DNS for the zone `sanctuary-grace.com`. All are present as of 2026-10-07.

| Type | Name | Value | Purpose |
|---|---|---|---|
| TXT | `sanctuary-grace.com` | `v=spf1 include:_spf.mx.cloudflare.net a mx include:_spf.mlsend.com ~all` | SPF. Authorizes MailerLite and Cloudflare Email Routing. Only ONE SPF record may exist. |
| CNAME | `litesrv._domainkey` | `litesrv._domainkey.mlsend.com` | DKIM for MailerLite. DNS only (grey cloud), never proxied. |
| TXT | `sanctuary-grace.com` | `mailerlite-domain-verification=...` | Proves domain ownership to MailerLite. |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:tdwdemp@gmail.com` | DMARC. Monitoring only. |

Rule: never delete these. Never proxy the DKIM CNAME. Never add a second SPF record, merge into the existing one.

---

## 6. NEVER DO (workspace wide)

- Never force-push `main`.
- Never move `index.html`, `gate-*.html`, `CNAME`, `.nojekyll`, `approval-gate.html`, `privacy.html`, `404.html` or their sibling assets out of the THE-QUIET-AUTHORITY repo root. GitHub Pages serves from the root.
- Never move `workflows/scripts/*.py`, `workflows/output/*`, `workflows/youtube-log.md` or `workflows/substack-log.md`. The workflow files and the scripts hardcode those exact paths.
- Never nest a repo inside another repo and expect its `.github/workflows` to run. GitHub only reads workflows from the top level of each repo.
- Never add npm, build tools or frameworks to the live site.
- Never change design tokens or brand voice without Grace's approval.
- Never reference Make.com or Systeme.io as live. Both are dead. MailerLite is the email engine.
- Never resume the paused Substack schedule unless Grace says so.
- Never commit a secret. Abort if a diff contains `sk_live_`, `sk_test_`, `rk_live_`, `ghp_`, `github_pat_` or `API_KEY=` followed by a value.

---

## 7. SECRETS POLICY

- Real values live only in: Cloudflare Worker secrets, GitHub Actions secrets, or a local gitignored `.env`.
- `.env.example` in this repo lists the key names with empty values. Copy it to `.env` and fill it in locally. `.env` is gitignored.
- GitHub Actions secrets expected in THE-QUIET-AUTHORITY (names only): `ANTHROPIC_API_KEY`, `SUBSTACK_COOKIE_ID`, `GEMINI_API_KEY`, `PINTEREST_ACCESS_TOKEN` (temporary fallback only), `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, `PINTEREST_REFRESH_TOKEN`, `PINTEREST_BOARD_ID`, `YOUTUBE_SESSION_SID`, `YOUTUBE_SESSION_HSID`, `GH_SECRETS_PAT`.
- `PINTEREST_APP_SECRET` is the App Secret from the Pinterest Developer Configure tab (App ID 1585025). It was regenerated on 2026-10-07 after it was pasted in chat once.
- `PINTEREST_REFRESH_TOKEN` is created by the one-time workflow `pinterest-oauth-setup.yml` after Grace approves the app, and is renewed automatically by `pinterest-agent.yml`. It is NOT in place until that setup runs.
- `GH_SECRETS_PAT` is a fine-grained GitHub token with Secrets read and write on THE-QUIET-AUTHORITY only. The agent uses it to save a renewed Pinterest refresh token. It expires on the date Grace chose, so renew it before then.
- `PINTEREST_API_KEY` was deleted on 2026-10-07. Nothing uses it.
- Never paste any of these values into chat. Enter them only in GitHub Settings, Secrets and variables, Actions.

---

## 8. OPEN ITEMS (as of 2026-10-07)

1. Gate 1 email sequence has no live delivery path since Systeme.io was shut down. Needs a decision: load into MailerLite.
2. Video project is blocked until Grace allows `sanctuary-grace.com` and `bible-api.com` in the cloud environment Network access settings and supplies the stills, music and verse list.
3. Workflow commit email `noreply@sanctuarygrace.com` uses the wrong domain spelling. Cosmetic, fix when next editing the workflows.
4. DMARC is monitoring only (`p=none`). Tighten after a few weeks of clean reports.
5. COMPLETED 2026-10-07: Cloudflare "Always Use HTTPS" is on and minimum TLS is 1.2 for sanctuary-grace.com (SSL mode stays Full). Verified by reading the settings back and confirming http redirects to https.
6. Verify each GitHub Actions secret is still valid (see Grace's refresh instructions delivered with this blueprint).
7. Pinterest one-time approval is still pending: add the redirect address `https://sanctuary-grace.com/pinterest-callback.html` in the Pinterest Configure tab, approve the app, then run `pinterest-oauth-setup.yml` with the code. Also note that Pinterest Trial access shows pins only to the app owner, so daily pins may not be public until Standard access is approved.
8. The first real Substack draft is the first true test of the cookie. Earlier runs in June failed with HTTP 403. Substack stays paused until Grace says otherwise.
