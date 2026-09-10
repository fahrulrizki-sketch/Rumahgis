import fs from 'node:fs/promises';
import { instagramClient, instagramPlan, contentKey } from './instagram.mjs';
const post = JSON.parse(await fs.readFile('content/drafts/instagram-kalimantan-20260910.json', 'utf8'));
if (contentKey(post) !== 'c818058efd07560d7510d25c503a543a878f45c82e0de29c9dabe5c21b37d142') throw Error('Konten berbeda dari preview yang disetujui.');
if (process.env.GITHUB_RUN_ATTEMPT !== '1') throw Error('Pengulangan publish diblokir.');
const client = instagramClient({ token: process.env.INSTAGRAM_ACCESS_TOKEN, userId: process.env.INSTAGRAM_USER_ID });
const state = { account: 'rumahgis', status: 'PENDING', key: contentKey(post) };
async function save() { await fs.writeFile('instagram-test-result.json', JSON.stringify(state, null, 2)); }
try {
  await client.verify();
  state.container = await client.create(instagramPlan(post));
  state.status = 'STARTED'; await save();
  const result = await client.publish(state.container);
  state.id = result.id; state.status = 'PUBLISHED'; await save();
  state.permalink = await client.permalink(result.id); await save();
  console.log(JSON.stringify(state));
} catch (error) {
  await save();
  console.error('Publikasi berhenti. Status:', state.status);
  if (/^Instagram API gagal:|^Akun Instagram|^Secret Instagram|^Pemrosesan media/.test(error.message)) console.error(error.message);
  process.exitCode = 1;
}
