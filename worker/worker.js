// Cloudflare Worker: lively-dew-924c
//
// Routes:
//   POST /mailerlite-subscribe  - adds a subscriber to a MailerLite group
//   GET  /verify-purchase       - verifies a Stripe Checkout Session and
//                                 reports which gate it paid for

const STRIPE_API = 'https://api.stripe.com/v1';

// Each gate sells through its own Stripe Payment Link (see gate-*.html).
// A verified Checkout Session's payment_link.url is matched against this
// map to determine which gate the buyer paid for.
const GATE_PAYMENT_LINKS = {
  one: 'https://buy.stripe.com/eVqfZh8Ba8Od0Es8YGcQU0w',
  two: 'https://buy.stripe.com/6oU3cv8Bac0pcna0sacQU0x',
  three: 'https://buy.stripe.com/9B600j9FefcB0EscaScQU0y',
  four: 'https://buy.stripe.com/dRmdR9g3CfcB72Qgr8cQU0z',
  five: 'https://buy.stripe.com/6oU00j4kU9Sh3QE7UCcQU0A',
  six: 'https://buy.stripe.com/eVq8wP8Ba0hHgDqej0cQU0B',
};

// Update this once the site's real origin is confirmed (custom domain or
// the GitHub Pages URL). Requests from origins not in this list still get
// a valid JSON response, just without CORS headers, so the browser blocks
// the read.
const ALLOWED_ORIGINS = new Set([
  'https://transform24.github.io',
]);

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]+$/;

function corsHeaders(origin) {
  const headers = { Vary: 'Origin' };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function gateForPaymentLinkUrl(linkUrl) {
  for (const [gate, url] of Object.entries(GATE_PAYMENT_LINKS)) {
    if (url === linkUrl) return gate;
  }
  return null;
}

async function handleVerifyPurchase(request, env, origin) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(origin),
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'GET') {
    return json({ verified: false, error: 'method_not_allowed' }, 405, origin);
  }

  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
    return json({ verified: false, error: 'invalid_session_id' }, 400, origin);
  }

  if (!env.STRIPE_SECRET_KEY) {
    return json({ verified: false, error: 'not_configured' }, 503, origin);
  }

  let session;
  try {
    const stripeRes = await fetch(
      `${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_link`,
      { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
    );
    if (!stripeRes.ok) {
      return json({ verified: false, error: 'session_not_found' }, 404, origin);
    }
    session = await stripeRes.json();
  } catch (err) {
    return json({ verified: false, error: 'stripe_request_failed' }, 502, origin);
  }

  const paid = session.payment_status === 'paid' && session.status === 'complete';
  const paymentLinkUrl =
    session.payment_link && typeof session.payment_link === 'object' ? session.payment_link.url : null;
  const gate = paymentLinkUrl ? gateForPaymentLinkUrl(paymentLinkUrl) : null;

  if (!paid) {
    return json({ verified: false, error: 'not_paid' }, 402, origin);
  }
  if (!gate) {
    return json({ verified: false, error: 'unknown_gate' }, 402, origin);
  }

  return json(
    {
      verified: true,
      gate,
      sessionId: session.id,
      amountTotal: session.amount_total,
      currency: session.currency,
    },
    200,
    origin
  );
}

async function handleMailerliteSubscribe(request, env) {
  const MAILERLITE_GROUPS = {
    A: '196101704591083355',
    B: '196101706647340497',
    C: '196101708750783558',
    D: '196101710880441776',
    NB: '196101713496639044',
  };

  const { email, name, groupKey } = await request.json();
  const groupId = MAILERLITE_GROUPS[groupKey];
  if (!email || !groupId) {
    return new Response('Bad request', { status: 400 });
  }
  await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Bearer ' + env.MAILERLITE_API_KEY,
    },
    body: JSON.stringify({ email, fields: { name: name || '' }, groups: [groupId] }),
  });
  return new Response('OK', { status: 200 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (url.pathname === '/mailerlite-subscribe' && request.method === 'POST') {
      return handleMailerliteSubscribe(request, env);
    }

    if (url.pathname === '/verify-purchase') {
      return handleVerifyPurchase(request, env, origin);
    }

    return new Response('Not found', { status: 404 });
  },
};
