import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAffiliate,
  decideAffiliate,
  validateProductBank,
  validateShopeeShortLink,
} from '../scripts/affiliate.mjs';

const approvedProduct = {
  id: 'jas-hujan-01',
  title: 'Jas hujan perjalanan',
  category: 'cuaca',
  relevance_keywords: ['jas hujan', 'musim hujan'],
  short_url: 'https://s.shopee.co.id/abc123',
  status: 'active',
  approved_for_auto_publish: true,
  tags: ['RumahGIS', 'Threads', 'Cuaca', '20260901', 'JasHujan'],
};

const bank = { version: 1, products: [approvedProduct] };

test('accepts only canonical HTTPS Shopee short links', () => {
  assert.deepEqual(validateShopeeShortLink('https://s.shopee.co.id/abc123'), []);
  assert.ok(validateShopeeShortLink('http://s.shopee.co.id/abc123').length > 0);
  assert.ok(validateShopeeShortLink('https://shopee.co.id/abc123').length > 0);
  assert.ok(validateShopeeShortLink('https://evil.example/s.shopee.co.id/abc123').length > 0);
});

test('trial link can never be approved for automatic publishing', () => {
  const errors = validateProductBank({ products: [{
    ...approvedProduct,
    short_url: 'https://s.shopee.co.id/904rirq1Xk',
  }] });
  assert.ok(errors.some((error) => error.includes('link percobaan')));
});

test('sensitive content overrides explicit affiliate yes', () => {
  const result = decideAffiliate({
    main: { text: 'Korban bencana masih dalam proses evakuasi.' },
    replies: [],
    affiliate: { mode: 'yes', product_id: approvedProduct.id },
  }, bank);
  assert.equal(result.decision, 'NO');
  assert.equal(result.reason, 'sensitive_content');
});

test('rejects a product when relevance would be forced', () => {
  const result = decideAffiliate({
    main: { text: 'Cara membaca koordinat pada peta.' },
    replies: [],
    affiliate: { mode: 'yes', product_id: approvedProduct.id },
  }, bank);
  assert.equal(result.decision, 'NO');
  assert.equal(result.reason, 'no_natural_relevance');
});

test('auto mode appends an approved relevant link to the last reply', () => {
  const result = applyAffiliate({
    main: { text: 'Persiapan perjalanan saat musim hujan.' },
    replies: [{ text: 'Selalu cek prakiraan cuaca.' }],
    affiliate: { mode: 'auto' },
  }, bank);
  assert.equal(result.affiliate.decision, 'YES');
  assert.match(result.post.replies[0].text, /Tautan affiliate/);
  assert.match(result.post.replies[0].text, /https:\/\/s\.shopee\.co\.id\/abc123/);
});

test('creates a new final reply when disclosure would exceed Threads limit', () => {
  const result = applyAffiliate({
    main: { text: 'Panduan musim hujan.' },
    replies: [{ text: 'x'.repeat(480) }],
    affiliate: { mode: 'auto' },
  }, bank);
  assert.equal(result.post.replies.length, 2);
  assert.match(result.post.replies[1].text, /abc123/);
});

test('explicit product_ids append several relevant products in final affiliate replies', () => {
  const secondProduct = {
    ...approvedProduct,
    id: 'payung-uv-01',
    title: 'Payung UV UPF50+',
    relevance_keywords: ['paparan UV'],
    short_url: 'https://s.shopee.co.id/uv123',
  };
  const result = applyAffiliate({
    main: { text: 'Musim hujan dan paparan UV perlu persiapan.' },
    replies: [{ text: 'Tips selesai.' }],
    affiliate: { mode: 'yes', product_ids: [approvedProduct.id, secondProduct.id] },
  }, { version: 1, products: [approvedProduct, secondProduct] });
  assert.equal(result.affiliate.decision, 'YES');
  assert.deepEqual(result.affiliate.products.map((product) => product.id), [approvedProduct.id, secondProduct.id]);
  assert.equal(result.post.replies.length, 2);
  assert.match(result.post.replies[1].text, /abc123/);
  assert.match(result.post.replies[1].text, /uv123/);
});

test('explicit product_ids fail closed when one product is not naturally relevant', () => {
  const unrelated = {
    ...approvedProduct,
    id: 'kompas-01',
    relevance_keywords: ['kompas'],
    short_url: 'https://s.shopee.co.id/kompas123',
  };
  const result = decideAffiliate({
    main: { text: 'Persiapan perjalanan saat musim hujan.' },
    replies: [],
    affiliate: { mode: 'yes', product_ids: [approvedProduct.id, unrelated.id] },
  }, { version: 1, products: [approvedProduct, unrelated] });
  assert.equal(result.decision, 'NO');
  assert.equal(result.reason, 'no_natural_relevance');
});
