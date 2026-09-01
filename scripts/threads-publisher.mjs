#!/usr/bin/env node

/**
 * RumahGIS Threads publisher
 *
 * Safe by default: dry-run unless --publish is supplied.
 * Credentials are read only from environment variables.
 *
 * Required for live publishing:
 *   THREADS_USER_ID
 *   THREADS_ACCESS_TOKEN
 * Optional:
 *   THREADS_API_BASE (default https://graph.threads.net/v1.0)
 */

import fs from 'node:fs/promises';

const args = process.argv.slice(2);
const publish = args.includes('--publish');
const fileArg = args.find((a) => !a.startsWith('--'));

if (!fileArg) {
  console.error('Usage: node scripts/threads-publisher.mjs <post.json> [--publish]');
  process.exit(2);
}

const API_BASE = process.env.THREADS_API_BASE || 'https://graph.threads.net/v1.0';
const USER_ID = process.env.THREADS_USER_ID;
const ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadPost(path) {
  const raw = await fs.readFile(path, 'utf8');
  const data = JSON.parse(raw);
  if (!data.main?.text) throw new Error('main.text wajib diisi');
  if (!Array.isArray(data.replies)) data.replies = [];
  return data;
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
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: params });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Threads API ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function createContainer(item, replyToId) {
  return apiPost(`/${USER_ID}/threads`, paramsFor(item, replyToId));
}

async function publishContainer(containerId) {
  const p = new URLSearchParams({ creation_id: containerId, access_token: ACCESS_TOKEN });
  return apiPost(`/${USER_ID}/threads_publish`, p);
}

async function publishItem(item, replyToId = null) {
  const created = await createContainer(item, replyToId);
  if (!created.id) throw new Error('API tidak mengembalikan creation container id');
  if (item.media?.video_url) await sleep(8000);
  const result = await publishContainer(created.id);
  if (!result.id) throw new Error('API tidak mengembalikan published media id');
  return result.id;
}

const post = await loadPost(fileArg);

if (!publish) {
  console.log(JSON.stringify({
    mode: 'dry-run',
    valid: true,
    main: { text_chars: post.main.text.length, media: post.main.media || null },
    replies: post.replies.map((r, i) => ({ index: i + 1, text_chars: r.text?.length || 0, media: r.media || null })),
    note: 'Tidak ada posting yang dikirim. Gunakan --publish hanya setelah credential dan payload diverifikasi.'
  }, null, 2));
  process.exit(0);
}

if (!USER_ID || !ACCESS_TOKEN) {
  throw new Error('Live publish diblokir: THREADS_USER_ID dan THREADS_ACCESS_TOKEN belum tersedia.');
}

const rootId = await publishItem(post.main);
const published = [{ type: 'main', id: rootId }];
let parentId = rootId;

for (let i = 0; i < post.replies.length; i++) {
  const id = await publishItem(post.replies[i], parentId);
  published.push({ type: 'reply', index: i + 1, id });
  parentId = id;
}

console.log(JSON.stringify({ mode: 'published', root_id: rootId, published }, null, 2));
