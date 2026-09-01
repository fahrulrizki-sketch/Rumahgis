#!/usr/bin/env node

/**
 * Refresh an unexpired long-lived Threads token.
 * Prints the refreshed token to stdout. Never writes secrets to the repo.
 */

const API_HOST = process.env.THREADS_API_HOST || 'https://graph.threads.net';
const ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('THREADS_ACCESS_TOKEN belum tersedia.');
  process.exit(2);
}

const url = new URL(`${API_HOST}/refresh_access_token`);
url.searchParams.set('grant_type', 'th_refresh_token');
url.searchParams.set('access_token', ACCESS_TOKEN);

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

try {
  const res = await fetch(url, { signal: controller.signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message || JSON.stringify(body);
    throw new Error(`Threads API ${res.status}: ${message}`);
  }
  if (!body.access_token) throw new Error('API tidak mengembalikan access_token baru.');

  console.log(JSON.stringify({
    ok: true,
    access_token: body.access_token,
    token_type: body.token_type || 'bearer',
    expires_in: body.expires_in || null
  }, null, 2));
} finally {
  clearTimeout(timeout);
}
