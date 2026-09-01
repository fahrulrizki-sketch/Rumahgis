#!/usr/bin/env node

/**
 * Read-only credential/account check for Threads API.
 * Tidak membuat atau mempublikasikan post.
 */

const API_BASE = process.env.THREADS_API_BASE || 'https://graph.threads.net/v1.0';
const ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN;
const EXPECTED_USER_ID = process.env.THREADS_USER_ID;

if (!ACCESS_TOKEN) {
  console.error('THREADS_ACCESS_TOKEN belum tersedia. Healthcheck dihentikan tanpa melakukan write.');
  process.exit(2);
}

const url = new URL(`${API_BASE}/me`);
url.searchParams.set('fields', 'id,username');
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
  if (!body.id) throw new Error('Healthcheck berhasil terhubung tetapi API tidak mengembalikan user id.');
  if (EXPECTED_USER_ID && String(body.id) !== String(EXPECTED_USER_ID)) {
    throw new Error(`Token terhubung ke user id ${body.id}, bukan THREADS_USER_ID ${EXPECTED_USER_ID}.`);
  }

  console.log(JSON.stringify({
    ok: true,
    write_performed: false,
    user_id: body.id,
    username: body.username || null,
    expected_user_id_matched: EXPECTED_USER_ID ? true : null
  }, null, 2));
} finally {
  clearTimeout(timeout);
}
