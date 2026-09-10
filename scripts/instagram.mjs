import { createHash } from 'node:crypto';

export function instagramPlan(post) {
  const cfg = post.instagram || {};
  // Caption berasal dari konten asli, sebelum reply affiliate ditambahkan.
  const clean = (text) => String(text || '').replace(/https?:\/\/\S+/gi, '').trim();
  const caption = clean(cfg.caption ?? [post.main?.text, ...(post.replies || []).map(x => x.text)].join('\n\n'));
  if (!caption || [...caption].length > 2200) throw new Error('Caption Instagram wajib 1–2200 karakter; siapkan ringkasan instagram.caption.');
  const media = cfg.media || [post.main?.media, ...(post.replies || []).map(x => x.media)].filter(Boolean);
  if (!Array.isArray(media) || !media.length || media.length > 10) throw new Error('Instagram memerlukan 1–10 media siap publikasi. Kartu tautan artikel bukan media.');
  const items = media.map(m => {
    if (Boolean(m.image_url) === Boolean(m.video_url)) throw new Error('Setiap media harus memiliki satu image_url atau video_url.');
    const url = new URL(m.image_url || m.video_url);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Media harus berupa URL HTTPS publik tanpa credential.');
    return m.image_url ? { image_url: url.href } : { video_url: url.href };
  });
  const format = cfg.format && cfg.format !== 'auto' ? cfg.format : items.length > 1 ? 'CAROUSEL' : items[0].video_url ? 'REELS' : 'IMAGE';
  if (!['IMAGE', 'CAROUSEL', 'REELS'].includes(format)) throw new Error('Format Instagram tidak dikenal.');
  if (format === 'IMAGE' && (items.length !== 1 || !items[0].image_url)) throw new Error('IMAGE memerlukan satu gambar.');
  if (format === 'REELS' && (items.length !== 1 || !items[0].video_url)) throw new Error('REELS memerlukan satu video; gambar harus diolah menjadi video terlebih dahulu.');
  if (format === 'CAROUSEL' && items.length < 2) throw new Error('CAROUSEL memerlukan minimal dua media.');
  return { format, caption, media: items };
}

export function contentKey(post) {
  return createHash('sha256').update(JSON.stringify(post)).digest('hex');
}

export function instagramClient({ token, userId, version = 'v25.0', fetcher = fetch, wait = ms => new Promise(r => setTimeout(r, ms)) }) {
  token = String(token || '').trim();
  userId = String(userId || '').trim();
  if (!token) throw new Error('Secret Instagram token belum tersedia.');
  if (!/^\d+$/.test(userId)) throw new Error('Secret Instagram user ID harus berisi angka ID akun saja.');
  if (!/^v\d+\.\d+$/.test(version)) throw new Error('Versi Instagram API tidak valid.');
  const base = `https://graph.instagram.com/${version}`;
  async function api(path, params, method = 'GET') {
    const url = new URL(`${base}/${path}`);
    const init = { method, headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) };
    if (method === 'POST') init.body = new URLSearchParams(params);
    else for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
    const res = await fetcher(url, init);
    const body = await res.json();
    // Jangan mencetak respons API mentah: dapat mengandung URL/token.
    if (!res.ok) throw new Error(`Instagram API gagal: HTTP ${res.status}, kode ${Number(body.error?.code) || 'unknown'}`);
    return body;
  }
  async function ready(id) {
    for (let i = 0; i < 60; i++) {
      const result = await api(id, { fields: 'status_code' });
      if (result.status_code === 'FINISHED') return;
      if (['ERROR', 'EXPIRED'].includes(result.status_code)) throw new Error('Pemrosesan media Instagram gagal.');
      await wait(5000);
    }
    throw new Error('Pemrosesan media Instagram belum selesai.');
  }
  return {
    async verify() {
      const me = await api(userId, { fields: 'id,username' });
      if (String(me.username).toLowerCase() !== 'rumahgis') throw new Error('Akun Instagram tidak cocok dengan rumahgis.');
    },
    async create(plan) {
      async function container(params) {
        const c = await api(`${userId}/media`, params, 'POST');
        if (!c.id) throw new Error('Instagram tidak mengembalikan container ID.');
        await ready(c.id);
        return c.id;
      }
      if (plan.format === 'CAROUSEL') {
        const children = [];
        for (const m of plan.media) children.push(await container({ ...m, ...(m.video_url ? { media_type: 'VIDEO' } : {}), is_carousel_item: 'true' }));
        return container({ media_type: 'CAROUSEL', children: children.join(','), caption: plan.caption });
      }
      return container({ ...plan.media[0], caption: plan.caption, ...(plan.format === 'REELS' ? { media_type: 'REELS', share_to_feed: 'true' } : {}) });
    },
    async publish(id) {
      const result = await api(`${userId}/media_publish`, { creation_id: id }, 'POST');
      if (!result.id) throw new Error('Hasil publikasi Instagram belum pasti; perlu pemeriksaan manual.');
      return { id: result.id };
    },
    async permalink(id) { return (await api(id, { fields: 'permalink' })).permalink; },
  };
}
