import test from 'node:test';
import assert from 'node:assert/strict';
import { validateThread, THREADS_TEXT_LIMIT } from '../scripts/thread-schema.mjs';

test('valid text thread passes', () => {
  const errors = validateThread({ main: { text: 'Halo RumahGIS' }, replies: [{ text: 'Reply 1' }] });
  assert.deepEqual(errors, []);
});

test('rejects empty main text', () => {
  const errors = validateThread({ main: { text: '' }, replies: [] });
  assert.ok(errors.some((e) => e.includes('main.text')));
});

test('rejects over-limit text', () => {
  const errors = validateThread({ main: { text: 'a'.repeat(THREADS_TEXT_LIMIT + 1) }, replies: [] });
  assert.ok(errors.some((e) => e.includes('melebihi')));
});

test('rejects non-https media', () => {
  const errors = validateThread({ main: { text: 'x', media: { image_url: 'http://example.com/a.jpg' } }, replies: [] });
  assert.ok(errors.some((e) => e.includes('HTTPS')));
});

test('rejects image and video at once', () => {
  const errors = validateThread({
    main: { text: 'x', media: { image_url: 'https://example.com/a.jpg', video_url: 'https://example.com/a.mp4' } },
    replies: []
  });
  assert.ok(errors.some((e) => e.includes('bukan keduanya')));
});

test('validates affiliate control metadata', () => {
  assert.deepEqual(validateThread({
    main: { text: 'x' },
    replies: [],
    affiliate: { mode: 'auto', product_id: 'produk-1' },
  }), []);
  const errors = validateThread({
    main: { text: 'x' },
    replies: [],
    affiliate: { mode: 'sometimes' },
  });
  assert.ok(errors.some((error) => error.includes('affiliate.mode')));
});
