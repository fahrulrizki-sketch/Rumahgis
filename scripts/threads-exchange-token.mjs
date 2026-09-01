#!/usr/bin/env node

/**
 * Exchange a short-lived Threads user token for a long-lived token.
 * Secrets are read only from environment variables and never written to GitHub.
 */

const API_HOST = process.env.THREADS_API_HOST || 'https://graph.threads.net';
const SHORT_TOKEN = process.env.THREADS_SHORT_LIVED_TOKEN;
const APP_SECRET = process.env.THREADS_APP_SECRET;

if (!SHORT_TOKEN || !APP_SECRET) {
  console.error('THREADS_SHORT_LIVED_TOKEN dan THREADS_APP_SECRET wajib tersedia.');
  process.exit(2);
}

const url = new URL(`${API_HOST}/access_token`);
url.searchParams.set('grant_type', 'th_exchange_token');
url.searchParams.set('client_secret', APP_SECRET);
url.searchParams.set('access_token', SHORT_TOKEN);

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

try {
  const res = await fetch(url, { signal: controller.signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message || JSON.stringify(body);
    throw new Error(`Threads API ${res.status}: ${message}`);
  }
  if (!body.access_token) throw new Error('API tidak mengembalikan long-lived access token.');

  console.log(JSON.stringify({
    ok: true,
    access_token: body.access_token,
    token_type: body.token_type || 'bearer',
    expires_in: body.expires_in || null
  }, null, 2));
} finally {
  clearTimeout(timeout);
}
