#!/usr/bin/env node

/**
 * RumahGIS Threads publisher
 *
 * Aman secara default: dry-run kecuali --publish diberikan.
 * Credential hanya dibaca dari environment variable.
 *
 * Required for live publishing:
 *   THREADS_ACCESS_TOKEN
 * Optional:
 *   THREADS_USER_ID (jika kosong, diambil dari /me)
 *   THREADS_API_BASE (default https://graph.threads.net/v1.0)
 */

import fs from 'node:fs/promises';
import { validateThread } from './thread-schema.mjs';

const args = process.argv.slice(2);
const publish = args.includes('--publish');
const fileArg = args.find((a) => !a.startsWith('--'));

if (!fileArg) {
  console.error('Usage: node scripts/threads-publisher.mjs <post.json> [--publish]');
  process.exit(2);
}

const API_BASE = process.env.THREADS_API_BASE || 'https://graph.threads.net/v1.0';
let USER_ID = process.env.THREADS_USER_ID || null;
const ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN;
const REQUEST_TIMEOUT_MS = Number(process.env.THREADS_REQUEST_TIMEOUT_MS || 30000);
const PUBLISH_RETRIES = Number(process.env.THREADS_PUBLISH_RETRIES || 4);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadPost(path) {
  const raw = await fs.readFile(path, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.replies)) data.replies = [];

  const errors = validateThread(data);
  if (errors.length) {
    throw new Error(`Payload tidak valid:\n- ${errors.join('\n- ')}`);
  }
  return data;
}

function makeApiError(res, body) {
  const message = body?.error?.message || JSON.stringify(body);
  const error = new Error(`Threads API ${res.status}: ${message}`);
  error.status = res.status;
  error.body = body;
  return error;
}

async function apiGet(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw makeApiError(res, body);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveUserId() {
  if (USER_ID) return USER_ID;
  const me = await apiGet('/me', { fields: 'id,username', access_token: ACCESS_TOKEN });
  if (!me.id) throw new Error('Threads API /me tidak mengembalikan user id.');
  USER_ID = String(me.id);
  return USER_ID;
}

function paramsFor(item, replyToId) {
  const p = new URLSearchParams();
  const media = item.media || {};

  if (media.image_url) {
    p.set('media_type', 'IMAGE');
    p.set('image_url', media.image_url);
  } else if (media.video_url) {
    p.set('media_type', 'VIDEO');
    p.set('video_url', media.video_url);
  } else {
    p.set('media_type', 'TEXT');
  }

  p.set('text', item.text);
  if (replyToId) p.set('reply_to_id', replyToId);
  p.set('access_token', ACCESS_TOKEN || 'DRY_RUN_TOKEN');
  return p;
}

async function apiPost(path, params) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      body: params,
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw makeApiError(res, body);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function createContainer(item, replyToId) {
  const userId = await resolveUserId();
  return apiPost(`/${userId}/threads`, paramsFor(item, replyToId));
}

async function publishContainer(containerId) {
  const userId = await resolveUserId();
  const p = new URLSearchParams({ creation_id: containerId, access_token: ACCESS_TOKEN });
  return apiPost(`/${userId}/threads_publish`, p);
}

async function publishContainerWithRetry(containerId) {
  let lastError;
  for (let attempt = 1; attempt <= PUBLISH_RETRIES; attempt++) {
    try {
      return await publishContainer(containerId);
    } catch (error) {
      lastError = error;
      const retryable = error.status === 429 || (error.status >= 500 && error.status < 600) || error.name === 'AbortError';
      if (!retryable || attempt === PUBLISH_RETRIES) throw error;
      await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

async function publishItem(item, replyToId = null) {
  const created = await createContainer(item, replyToId);
  if (!created.id) throw new Error('API tidak mengembalikan creation container id');

  if (item.media?.image_url) await sleep(2000);
  if (item.media?.video_url) await sleep(8000);

  const result = await publishContainerWithRetry(created.id);
  if (!result.id) throw new Error('API tidak mengembalikan published media id');
  return result.id;
}

const post = await loadPost(fileArg);

if (!publish) {
  console.log(JSON.stringify({
    mode: 'dry-run',
    valid: true,
    main: { text_chars: [...post.main.text].length, media: post.main.media || null },
    replies: post.replies.map((r, i) => ({ index: i + 1, text_chars: [...r.text].length, media: r.media || null })),
    note: 'Tidak ada posting yang dikirim. Gunakan --publish hanya setelah credential dan payload diverifikasi.'
  }, null, 2));
  process.exit(0);
}

if (!ACCESS_TOKEN) {
  throw new Error('Live publish diblokir: THREADS_ACCESS_TOKEN belum tersedia.');
}

await resolveUserId();

const rootId = await publishItem(post.main);
const published = [{ type: 'main', id: rootId }];
let parentId = rootId;

for (let i = 0; i < post.replies.length; i++) {
  const id = await publishItem(post.replies[i], parentId);
  published.push({ type: 'reply', index: i + 1, id });
  parentId = id;
}

console.log(JSON.stringify({ mode: 'published', user_id: USER_ID, root_id: rootId, published }, null, 2));
