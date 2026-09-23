// Pre-launch check for the gate paywall, run with a live Stripe key from the
// environment (never pass it on the command line or commit it):
//
//   STRIPE_SECRET_KEY=sk_live_... node worker/check-live.mjs
//
// A restricted key with read access to Payment Links is enough. Checks:
//   1. Each GATE_PAYMENT_LINKS / SECRET_PLACE_PAYMENT_LINK url in worker.js
//      exists as an active live Payment Link.
//   2. Each gate link redirects after payment to its own gate page with
//      ?session_id={CHECKOUT_SESSION_ID}, which /verify-purchase needs.
//   3. The deployed Worker has STRIPE_SECRET_KEY bound (a dummy session id
//      returns session_not_found, not not_configured).
// No Node dependencies; Node 18+.

import { readFileSync } from 'node:fs';

const WORKER = 'https://lively-dew-924c.tdwdemp.workers.dev';
const SITE = 'https://sanctuary-grace.com';

const key = process.env.STRIPE_SECRET_KEY;
if (!key || !key.startsWith('sk_live_') && !key.startsWith('rk_live_')) {
  console.error('Set STRIPE_SECRET_KEY to a live secret or restricted key (sk_live_/rk_live_).');
  process.exit(2);
}

const src = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
const gateBlock = src.match(/const GATE_PAYMENT_LINKS = \{([\s\S]*?)\};/)[1];
const gateLinks = Object.fromEntries(
  [...gateBlock.matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]])
);
const secretPlaceLink = src.match(/const SECRET_PLACE_PAYMENT_LINK = '([^']+)'/)[1];

async function stripeGet(path) {
  const res = await fetch('https://api.stripe.com/v1' + path, {
    headers: { Authorization: 'Bearer ' + key },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${path}: ${body.error ? body.error.message : res.status}`);
  return body;
}

const liveLinks = [];
for (let after = null, more = true; more; ) {
  const page = await stripeGet('/payment_links?limit=100' + (after ? '&starting_after=' + after : ''));
  liveLinks.push(...page.data);
  more = page.has_more;
  after = page.data.length ? page.data[page.data.length - 1].id : null;
}
const byUrl = new Map(liveLinks.map((l) => [l.url, l]));

let failures = 0;
const report = (ok, label, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
};

for (const [gate, url] of Object.entries(gateLinks)) {
  const link = byUrl.get(url);
  if (!link) {
    report(false, `gate ${gate}`, `${url} is not a live Payment Link on this account`);
    continue;
  }
  report(link.active, `gate ${gate} link active`, link.active ? '' : `${link.id} is deactivated`);
  const expected = `${SITE}/gate-${gate}.html?session_id={CHECKOUT_SESSION_ID}`;
  const redirect =
    link.after_completion && link.after_completion.type === 'redirect'
      ? link.after_completion.redirect.url
      : null;
  report(
    redirect === expected,
    `gate ${gate} redirect`,
    redirect === expected ? '' : `is ${redirect || '(no redirect — Stripe confirmation page)'}, want ${expected}`
  );
}

const sp = byUrl.get(secretPlaceLink);
report(Boolean(sp && sp.active), 'secret place link active', sp ? '' : `${secretPlaceLink} not found`);

try {
  const res = await fetch(`${WORKER}/verify-purchase?session_id=cs_live_keycheck`);
  const body = await res.json();
  report(
    body.error === 'session_not_found',
    'worker STRIPE_SECRET_KEY bound',
    body.error === 'session_not_found' ? '' : `got ${res.status} ${body.error}`
  );
} catch (err) {
  report(false, 'worker reachable', err.message);
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
