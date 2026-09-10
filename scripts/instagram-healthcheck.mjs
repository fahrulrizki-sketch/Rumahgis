import { instagramClient } from './instagram.mjs';
// Client menormalkan spasi luar dan memvalidasi format ID sebelum menghubungi Meta.

try {
  const client = instagramClient({
    token: process.env.INSTAGRAM_ACCESS_TOKEN,
    userId: process.env.INSTAGRAM_USER_ID,
    version: process.env.INSTAGRAM_API_VERSION || 'v25.0',
  });
  await client.verify();
  console.log(JSON.stringify({ status: 'PASS', account: 'rumahgis', account_access: 'VERIFIED', publishing: 'NOT_TESTED', posts_created: 0 }));
} catch (error) {
  // Pesan client terkendali; tidak menampilkan token, URL request, atau respons mentah.
  console.error(error.message.startsWith('Instagram API gagal:') || error.message.startsWith('Akun Instagram') || error.message.startsWith('Secret Instagram')
    ? error.message : 'Pemeriksaan Instagram gagal; periksa koneksi atau konfigurasi API.');
  process.exitCode = 1;
}
