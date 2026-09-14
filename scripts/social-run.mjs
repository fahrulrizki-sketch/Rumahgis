export async function publishSocial({ state, save, client, plan, threads }) {
  for (const platform of ['threads', 'instagram']) {
    if (!['PENDING', 'STARTED', 'PUBLISHED'].includes(state[platform]?.status)) throw new Error('State publikasi tidak valid.');
    if (state[platform].status === 'STARTED') throw new Error('Hasil publish sebelumnya belum pasti. Periksa posting dan state; pengulangan otomatis diblokir.');
  }
  await client.verify();
  if (state.threads.status !== 'PUBLISHED') {
    state.threads = { status: 'STARTED' }; await save();
    const result = await threads();
    state.threads = { status: 'PUBLISHED', result }; await save();
  }
  if (state.instagram.status !== 'PUBLISHED') {
    const container = await client.create(plan);
    state.instagram = { status: 'STARTED', container }; await save();
    const result = await client.publish(container);
    state.instagram = { status: 'PUBLISHED', ...result }; await save();
  }
  if (!state.instagram.permalink) {
    try { state.instagram.permalink = await client.permalink(state.instagram.id); await save(); }
    catch { /* Publikasi sudah tersimpan; pengambilan tautan dapat diulang. */ }
  }
  return state;
}
