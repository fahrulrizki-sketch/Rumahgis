import fs from 'node:fs/promises';
import { unlinkSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { instagramPlan, instagramClient, contentKey } from './instagram.mjs';
import { publishSocial } from './social-run.mjs';

const args = process.argv.slice(2);
const file = args.find(x => !x.startsWith('--'));
if (!file) throw new Error('Gunakan social-publisher.mjs payload.json [--publish]');
const post = JSON.parse(await fs.readFile(file, 'utf8'));
const plan = instagramPlan(post);
const key = contentKey(post);
const live = args.includes('--publish');
const stateDir = process.env.SOCIAL_STATE_DIR || '.social-state';
const stateFile = path.join(stateDir, `${key}.json`);
// Satu publisher lokal pada satu waktu; lock tertinggal setelah crash memerlukan pemeriksaan.
if (live) {
  await fs.mkdir(stateDir, { recursive: true });
  const lock = await fs.open(path.join(stateDir, 'publish.lock'), 'wx');
  await lock.close();
  process.on('exit', () => {
    // Penghapusan sinkron diperlukan saat proses keluar.
    try { unlinkSync(path.join(stateDir, 'publish.lock')); } catch {}
  });
}
let state = { key, threads: { status: 'PENDING' }, instagram: { status: 'PENDING' } };
try { state = JSON.parse(await fs.readFile(stateFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
if (state.key !== key) throw new Error('State tidak cocok dengan konten.');
async function save() {
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(`${stateFile}.tmp`, JSON.stringify(state, null, 2));
  await fs.rename(`${stateFile}.tmp`, stateFile);
}
function runThreads(publish) {
  const r = spawnSync(process.execPath, ['scripts/threads-publisher.mjs', file, ...(publish ? ['--publish'] : [])], { encoding: 'utf8', timeout: 900000 });
  if (r.status !== 0) throw new Error('Proses Threads gagal. Jika sudah mulai publish, periksa akun sebelum mencoba kembali.');
  return JSON.parse(r.stdout);
}
runThreads(false);
if (!live) {
  console.log(JSON.stringify({ mode: 'dry-run', key, instagram: plan, state }, null, 2));
} else {
  const client = instagramClient({ token: process.env.INSTAGRAM_ACCESS_TOKEN, userId: process.env.INSTAGRAM_USER_ID, version: process.env.INSTAGRAM_API_VERSION || 'v25.0' });
  await publishSocial({ state, save, client, plan, threads: () => runThreads(true) });
  console.log(JSON.stringify(state, null, 2));
}
