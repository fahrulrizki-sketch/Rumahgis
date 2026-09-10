import test from 'node:test';
import assert from 'node:assert/strict';
import { instagramPlan, instagramClient } from '../scripts/instagram.mjs';

const post = { main: { text: 'Peta hujan Indonesia https://s.shopee.co.id/abc', media: { image_url: 'https://example.org/map.jpg' } }, affiliate: { mode: 'auto' } };
test('Secret menerima spasi luar tetapi menolak username sebagai ID', () => {
  assert.doesNotThrow(() => instagramClient({ token: ' fake\n', userId: ' 123\n' }));
  assert.throws(() => instagramClient({ token: 'fake', userId: '@rumahgis' }), /angka ID akun/);
});
test('Instagram menggunakan visual Threads dan membuang URL dari caption', () => {
  const p = instagramPlan(post);
  assert.equal(p.format, 'IMAGE');
  assert.equal(p.caption, 'Peta hujan Indonesia');
  assert.deepEqual(p.media, [post.main.media]);
  assert.ok(post.main.text.includes('shopee'));
});
test('Pemilihan format dan batas media', () => {
  assert.equal(instagramPlan({ ...post, replies: [{ text: 'Peta kedua', media: { image_url: 'https://example.org/two.jpg' } }] }).format, 'CAROUSEL');
  assert.equal(instagramPlan({ main: { text: 'Video', media: { video_url: 'https://example.org/video.mp4' } } }).format, 'REELS');
  assert.throws(() => instagramPlan({ main: { text: 'Hanya link https://example.org' } }), /media/);
  assert.throws(() => instagramPlan({ ...post, instagram: { format: 'REELS' } }), /video/);
  assert.throws(() => instagramPlan({ ...post, instagram: { caption: 'x'.repeat(2201) } }), /2200/);
});
test('API menunggu media siap, memverifikasi akun, dan publish sekali', async () => {
  const calls = [];
  let checks = 0;
  const client = instagramClient({ token: 'fake-token', userId: '123', wait: async () => {}, fetcher: async (url, init) => {
    calls.push({ path: url.pathname, method: init.method, body: init.body });
    assert.equal(url.searchParams.has('access_token'), false);
    const body = url.pathname.endsWith('/123') ? { username: 'rumahgis' }
      : url.pathname.endsWith('/media') ? { id: 'container' }
      : url.pathname.endsWith('/media_publish') ? { id: 'published' }
      : { status_code: ++checks === 1 ? 'IN_PROGRESS' : 'FINISHED' };
    return { ok: true, json: async () => body };
  } });
  await client.verify();
  const id = await client.create(instagramPlan(post));
  assert.equal(checks, 2);
  assert.deepEqual(await client.publish(id), { id: 'published' });
  assert.equal(calls.filter(x => x.path.endsWith('/media_publish')).length, 1);
});
test('Akun salah dan error API tidak membocorkan respons', async () => {
  const wrong = instagramClient({ token: 'secret', userId: '123', fetcher: async () => ({ ok: true, json: async () => ({ username: 'other' }) }) });
  await assert.rejects(wrong.verify(), /tidak cocok/);
  const broken = instagramClient({ token: 'secret', userId: '123', fetcher: async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'secret', code: 190 } }) }) });
  await assert.rejects(broken.verify(), e => !e.message.includes('secret') && e.message.includes('190'));
});
