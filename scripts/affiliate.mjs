import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TRIAL_LINK = 'https://s.shopee.co.id/904rirq1Xk';
export const DEFAULT_BANK_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../config/affiliate-products.json',
);

const SENSITIVE_PATTERNS = [
  /\bkorban\b/i,
  /\bmeninggal\b/i,
  /\bkematian\b/i,
  /\btewas\b/i,
  /\btragedi\b/i,
  /\bkonflik\b/i,
  /\bperang\b/i,
  /\bbencana\b/i,
  /\bgempa\b/i,
  /\blongsor\b/i,
  /\bkarhutla\b/i,
  /\bkebakaran\b/i,
  /\bevakuasi\b/i,
  /\bdarurat\b/i,
];

function normalizedUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function validateShopeeShortLink(value) {
  const errors = [];
  let url;
  try {
    url = new URL(value);
  } catch {
    return ['short_url bukan URL valid'];
  }
  if (url.protocol !== 'https:') errors.push('short_url harus menggunakan HTTPS');
  if (url.hostname.toLowerCase() !== 's.shopee.co.id') errors.push('short_url harus menggunakan host s.shopee.co.id');
  if (!url.pathname || url.pathname === '/') errors.push('short_url harus memiliki kode link');
  if (url.username || url.password || url.port) errors.push('short_url tidak boleh memuat credential atau port');
  return errors;
}

export function validateProductBank(bank) {
  const errors = [];
  if (!bank || typeof bank !== 'object') return ['bank produk wajib berupa object'];
  if (!Array.isArray(bank.products)) return ['products wajib berupa array'];
  const ids = new Set();
  const shortUrls = new Set();
  bank.products.forEach((product, index) => {
    const label = `products[${index}]`;
    if (!product || typeof product !== 'object') {
      errors.push(`${label} wajib berupa object`);
      return;
    }
    if (typeof product.id !== 'string' || !product.id.trim()) errors.push(`${label}.id wajib diisi`);
    else if (ids.has(product.id)) errors.push(`${label}.id duplikat: ${product.id}`);
    else ids.add(product.id);
    if (typeof product.title !== 'string' || !product.title.trim()) errors.push(`${label}.title wajib diisi`);
    if (product.affiliate_intro != null && (
      typeof product.affiliate_intro !== 'string'
      || !product.affiliate_intro.trim()
      || [...product.affiliate_intro].length > 350
    )) {
      errors.push(`${label}.affiliate_intro harus berupa teks tidak kosong maksimal 350 karakter`);
    }
    if (!Array.isArray(product.relevance_keywords) || product.relevance_keywords.length === 0) {
      errors.push(`${label}.relevance_keywords wajib berupa array yang tidak kosong`);
    }
    errors.push(...validateShopeeShortLink(product.short_url).map((error) => `${label}.${error}`));
    const shortUrl = normalizedUrl(product.short_url);
    if (shortUrl && shortUrls.has(shortUrl)) errors.push(`${label}.short_url duplikat: ${product.short_url}`);
    else if (shortUrl) shortUrls.add(shortUrl);
    if (!['active', 'paused', 'expired', 'test'].includes(product.status)) {
      errors.push(`${label}.status harus active, paused, expired, atau test`);
    }
    if (typeof product.approved_for_auto_publish !== 'boolean') {
      errors.push(`${label}.approved_for_auto_publish wajib boolean`);
    }
    if (normalizedUrl(product.short_url) === normalizedUrl(TRIAL_LINK) && product.approved_for_auto_publish) {
      errors.push(`${label} memakai link percobaan dan tidak boleh disetujui untuk auto-publish`);
    }
  });
  return errors;
}

export async function loadProductBank(bankPath = DEFAULT_BANK_PATH) {
  const bank = JSON.parse(await fs.readFile(bankPath, 'utf8'));
  const errors = validateProductBank(bank);
  if (errors.length) throw new Error(`Bank affiliate tidak valid:\n- ${errors.join('\n- ')}`);
  return bank;
}

function threadText(post) {
  return [post.main?.text, ...(post.replies || []).map((reply) => reply.text)]
    .filter(Boolean)
    .join('\n');
}

function matchingKeywords(text, product) {
  const lower = text.toLocaleLowerCase('id');
  return product.relevance_keywords.filter((keyword) => lower.includes(String(keyword).toLocaleLowerCase('id')));
}

export function decideAffiliate(post, bank) {
  const config = post.affiliate || { mode: 'no' };
  const text = threadText(post);
  const sensitive = SENSITIVE_PATTERNS.find((pattern) => pattern.test(text));
  if (sensitive) return { decision: 'NO', reason: 'sensitive_content', product: null, matched_keywords: [] };
  if (config.mode === 'no') return { decision: 'NO', reason: 'disabled_by_content', product: null, matched_keywords: [] };

  const requestedIds = config.product_ids || (config.product_id ? [config.product_id] : []);
  const candidates = bank.products
    .filter((product) => product.status === 'active' && product.approved_for_auto_publish)
    .filter((product) => requestedIds.length === 0 || requestedIds.includes(product.id))
    .map((product) => ({ product, matches: matchingKeywords(text, product) }))
    .filter((candidate) => candidate.matches.length > 0)
    .sort((a, b) => b.matches.length - a.matches.length || a.product.id.localeCompare(b.product.id));

  if (requestedIds.length > 0) {
    const candidatesById = new Map(candidates.map((candidate) => [candidate.product.id, candidate]));
    for (const requestedId of requestedIds) {
      const requested = bank.products.find((product) => product.id === requestedId);
      const reason = !requested
        ? 'product_not_found'
        : normalizedUrl(requested.short_url) === normalizedUrl(TRIAL_LINK)
          ? 'trial_link_blocked'
          : requested.status !== 'active' || !requested.approved_for_auto_publish
            ? 'product_not_approved'
            : !candidatesById.has(requestedId)
              ? 'no_natural_relevance'
              : null;
      if (reason) return { decision: 'NO', reason, product: null, products: [], matched_keywords: [] };
    }
    candidates.splice(0, candidates.length, ...requestedIds.map((id) => candidatesById.get(id)));
  }

  if (!candidates.length) {
    return { decision: 'NO', reason: 'no_natural_relevance', product: null, products: [], matched_keywords: [] };
  }

  const selected = requestedIds.length > 0 ? candidates : candidates.slice(0, 1);
  return {
    decision: 'YES',
    reason: 'relevant_approved_product',
    product: selected[0].product,
    products: selected.map((candidate) => candidate.product),
    matched_keywords: [...new Set(selected.flatMap((candidate) => candidate.matches))],
  };
}

function affiliateReplies(products) {
  return products.map((product, index) => ({
    text: `Rekomendasi ${index + 1}/${products.length}\n${product.affiliate_intro || 'Pilihan produk yang relevan dengan topik ini:'}\n\n${product.title}\n${product.short_url}`,
  }));
}

export function applyAffiliate(post, bank) {
  const prepared = structuredClone(post);
  if (!Array.isArray(prepared.replies)) prepared.replies = [];
  const result = decideAffiliate(prepared, bank);
  if (result.decision !== 'YES') return { post: prepared, affiliate: result };

  const products = result.products || [result.product];
  prepared.replies.push(...affiliateReplies(products));
  return { post: prepared, affiliate: result };
}
