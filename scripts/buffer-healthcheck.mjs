import { bufferClient } from './buffer.mjs';

try {
  const { organizations, channels } = await bufferClient({
    token: process.env.BUFFER_ACCESS_TOKEN,
  }).accountAndChannels();
  const rumahgis = channels.filter((channel) =>
    channel.name?.toLowerCase() === 'rumahgis' && ['instagram', 'threads'].includes(channel.service));
  const services = [...new Set(rumahgis.map((channel) => channel.service))].sort();
  if (!services.includes('instagram') || !services.includes('threads')) {
    throw new Error('Kanal Buffer @rumahgis untuk Instagram dan Threads belum lengkap.');
  }
  console.log(JSON.stringify({
    status: 'PASS',
    organizations: organizations.length,
    account: 'rumahgis',
    services,
    publishing: 'NOT_TESTED',
    posts_created: 0,
  }));
} catch (error) {
  const safe = String(error?.message || 'Pemeriksaan Buffer gagal.')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');
  console.error(safe.startsWith('Buffer API gagal') || safe.startsWith('BUFFER_ACCESS_TOKEN') || safe.startsWith('Kanal Buffer')
    ? safe : 'Pemeriksaan Buffer gagal; periksa koneksi atau konfigurasi API.');
  process.exitCode = 1;
}
