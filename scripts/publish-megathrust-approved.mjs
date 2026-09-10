import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { contentKey, instagramPlan } from './instagram.mjs';

if (process.env.GITHUB_RUN_ATTEMPT !== '1') throw Error('Pengulangan publikasi diblokir; periksa hasil sebelumnya.');
const payload = 'content/drafts/megathrust-jawa-20260910.json';
const post = JSON.parse(await fs.readFile(payload, 'utf8'));
const expected = (await fs.readFile('content/drafts/megathrust-jawa-20260910.sha256', 'utf8')).trim();
if (contentKey(post) !== expected) throw Error('Konten tidak cocok dengan paket publikasi.');
instagramPlan(post);
const token = process.env.THREADS_ACCESS_TOKEN?.trim();
if (!token) throw Error('Token Threads belum tersedia.');
async function getThreads(path, fields) {
  const url = new URL(`https://graph.threads.net/v1.0/${path}`);
  url.searchParams.set('fields', fields);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw Error(`Verifikasi Threads gagal: HTTP ${r.status}`);
  return r.json();
}
const me = await getThreads('me', 'id,username');
if (String(me.username).toLowerCase() !== 'rumahgis' || !me.id) throw Error('Akun Threads tidak sesuai rumahgis.');
const result = spawnSync(process.execPath, ['scripts/social-publisher.mjs', payload, '--publish'], {
  encoding: 'utf8', timeout: 1500000,
  env: { ...process.env, THREADS_ACCESS_TOKEN: token, THREADS_USER_ID: String(me.id), THREADS_PUBLISH_RETRIES: '1' },
});
// Tidak meneruskan stderr mentah agar detail request eksternal tidak masuk log.
const file = `.social-state/${contentKey(post)}.json`;
let state;
try { state = JSON.parse(await fs.readFile(file, 'utf8')); }
catch { throw Error('Publikasi belum menghasilkan state. Tidak melakukan percobaan ulang.'); }
if (state.threads.status === 'PUBLISHED') {
  try {
    const info = await getThreads(state.threads.result.root_id, 'id,permalink');
    state.threads.permalink = info.permalink;
    await fs.writeFile(file, JSON.stringify(state, null, 2));
  } catch { console.log('Tautan Threads belum dapat diambil; lihat ID pada state.'); }
}
console.log(JSON.stringify({ threads: { status: state.threads.status, permalink: state.threads.permalink }, instagram: state.instagram }));
if (result.status !== 0) process.exitCode = 1;
