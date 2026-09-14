import assert from 'node:assert/strict';
import test from 'node:test';
import { bufferClient } from '../scripts/buffer.mjs';

test('bufferClient menolak token kosong', () => {
  assert.throws(() => bufferClient({ token: '  ' }), /BUFFER_ACCESS_TOKEN/);
});

test('accountAndChannels menggabungkan kanal tanpa membocorkan token', async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    calls.push(options);
    const { query } = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => query.includes('account')
        ? { data: { account: { id: 'a1', organizations: [{ id: 'o1', name: 'RumahGIS' }] } } }
        : { data: { channels: [{ id: 'c1', name: 'rumahgis', service: 'threads' }] } },
    };
  };
  const result = await bufferClient({ token: 'secret-value', fetchImpl }).accountAndChannels();
  assert.equal(result.channels[0].organizationId, 'o1');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].headers.authorization, 'Bearer secret-value');
});
