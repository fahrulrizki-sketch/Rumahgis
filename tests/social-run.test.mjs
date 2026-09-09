import test from 'node:test';
import assert from 'node:assert/strict';
import { publishSocial } from '../scripts/social-run.mjs';

function fixture() {
  const calls = [];
  const snapshots = [];
  const state = { threads: { status: 'PENDING' }, instagram: { status: 'PENDING' } };
  return {
    calls, snapshots, state, plan: {},
    save: async () => snapshots.push(structuredClone(state)),
    threads: async () => { calls.push('threads'); return { root_id: 't1' }; },
    client: {
      verify: async () => calls.push('verify'),
      create: async () => { calls.push('create'); return 'c1'; },
      publish: async () => { calls.push('instagram'); return { id: 'i1' }; },
      permalink: async () => 'https://instagram.com/p/example',
    },
  };
}
test('Pengulangan payload selesai tidak menerbitkan ulang kedua platform', async () => {
  const f = fixture();
  await publishSocial(f); await publishSocial(f);
  assert.equal(f.calls.filter(x => x === 'threads').length, 1);
  assert.equal(f.calls.filter(x => x === 'instagram').length, 1);
  assert.equal(f.snapshots[0].threads.status, 'STARTED');
});
test('Kegagalan container Instagram dapat dilanjutkan tanpa mengulang Threads', async () => {
  const f = fixture(); const create = f.client.create;
  f.client.create = async () => { throw Error('media gagal'); };
  await assert.rejects(publishSocial(f), /media gagal/);
  assert.equal(f.state.threads.status, 'PUBLISHED');
  f.client.create = create;
  await publishSocial(f);
  assert.equal(f.calls.filter(x => x === 'threads').length, 1);
});
test('Respons publish tidak pasti memblokir semua upaya selanjutnya', async () => {
  for (const platform of ['threads', 'instagram']) {
    const f = fixture();
    if (platform === 'threads') f.threads = async () => { throw Error('timeout'); };
    else f.client.publish = async () => { throw Error('timeout'); };
    await assert.rejects(publishSocial(f), /timeout/);
    assert.equal(f.state[platform].status, 'STARTED');
    const count = f.calls.length;
    await assert.rejects(publishSocial(f), /belum pasti/);
    assert.equal(f.calls.length, count);
  }
});
test('Verifikasi akun gagal sebelum Threads; state rusak ditolak', async () => {
  const f = fixture();
  f.client.verify = async () => { throw Error('akun salah'); };
  await assert.rejects(publishSocial(f), /akun salah/);
  assert.equal(f.state.threads.status, 'PENDING');
  f.state.instagram.status = 'UNKNOWN';
  await assert.rejects(publishSocial(f), /tidak valid/);
});
