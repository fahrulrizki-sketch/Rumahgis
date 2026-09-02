# RumahGIS Threads Automation

Automation konten untuk akun Threads **@rumahgis**.

## Tujuan
- Menyiapkan draft konten secara terstruktur.
- Memvalidasi isi sebelum publikasi.
- Mempublikasikan post utama dan reply berantai melalui Threads API resmi.
- Memisahkan credential/secret dari source code.
- Menyediakan dry-run, healthcheck, test, dan utilitas pemeliharaan token.
- Menilai kelayakan Shopee Affiliate dan menempatkan link relevan pada reply terakhir.

## Struktur
- `content/drafts/` — draft yang belum dipublikasikan.
- `content/published/` — arsip metadata konten yang sudah dipublikasikan.
- `scripts/thread-schema.mjs` — validasi payload dan batas teks.
- `scripts/validate-thread.mjs` — validasi file draft.
- `scripts/threads-healthcheck.mjs` — cek token/account tanpa melakukan write.
- `scripts/threads-publisher.mjs` — publisher post utama + reply berantai.
- `scripts/affiliate.mjs` — kebijakan AFFILIATE YES/NO, pemilihan produk, dan validasi short-link.
- `config/affiliate-products.json` — bank produk/link/tag non-secret.
- `scripts/threads-exchange-token.mjs` — tukar short-lived token menjadi long-lived token.
- `scripts/threads-refresh-token.mjs` — refresh long-lived token yang masih valid.
- `tests/` — unit test dan integration test dengan mock Threads API.
- `.github/workflows/threads-publisher-ci.yml` — CI untuk test, validasi, dan dry-run.

## Keamanan
Jangan pernah commit access token, app secret, password, atau credential Meta/Threads ke repository. Credential dibaca melalui environment variable. Live publish juga diblokir secara default dan hanya berjalan ketika `--publish` diberikan.

## Permission Threads yang diperlukan
Untuk pipeline RumahGIS, token minimal perlu izin `threads_basic` dan `threads_content_publish`. Karena publisher membuat reply berantai, aplikasi juga harus memiliki izin reply yang dibutuhkan oleh Threads API untuk membuat reply, saat ini `threads_manage_replies`.

## Alur aman
1. `npm test`
2. `node scripts/validate-thread.mjs <payload.json>`
3. `node scripts/threads-publisher.mjs <payload.json>` untuk dry-run.
4. `node scripts/threads-healthcheck.mjs` setelah token tersedia.
5. Baru jalankan `node scripts/threads-publisher.mjs <payload.json> --publish` untuk publikasi nyata.

Smoke publish produksi menggunakan workflow manual `Threads Controlled Smoke Publish`. Workflow tersebut hanya menerima payload tetap `content/smoke/threads-publisher-smoke.json`, mewajibkan frasa konfirmasi `PUBLISH_RUMAHGIS_SMOKE`, dan menjalankan test, validasi bank, dry-run, serta healthcheck sebelum melakukan satu write ke Threads.

## Shopee Affiliate semi-otomatis

Open API Shopee tidak digunakan. Owner membuat Custom Link secara manual, lalu memasukkan produk yang sudah diperiksa ke `config/affiliate-products.json`. Sebuah produk hanya dapat dipilih ketika `status` bernilai `active`, `approved_for_auto_publish` bernilai `true`, short-link memakai host resmi `s.shopee.co.id`, dan isi utas cocok dengan minimal satu `relevance_keywords`.

Bank berisi produk aktif yang dibuat melalui dashboard Shopee Affiliate: perlengkapan hujan, navigasi, daya dan pelindung peralatan lapangan, serta perlindungan debu/UV dan hidrasi untuk musim kemarau. Kelompok produk dapat dijeda sewaktu-waktu dengan mengubah `status` menjadi `paused` atau `approved_for_auto_publish` menjadi `false`.

Pada payload, gunakan `affiliate.mode`:

- `no`: tidak memakai affiliate.
- `auto`: memilih produk relevan yang sudah disetujui dari bank.
- `yes`: meminta affiliate; tetap gagal menjadi YES bila konten sensitif, produk tidak disetujui, atau relevansinya tidak alami. `product_id` memilih satu produk, sedangkan `product_ids` memilih beberapa produk dalam urutan yang ditentukan. Beberapa produk otomatis dibagi menjadi reply akhir yang masing-masing tetap di bawah 500 karakter.

Konten tragedi, korban, bencana aktif, kematian, konflik, serta istilah darurat terkait selalu menghasilkan keputusan `NO`. Link percobaan `s.shopee.co.id/904rirq1Xk` tersimpan sebagai test fixture dan tidak dapat disetujui untuk publikasi otomatis. Dry-run menampilkan keputusan dan alasannya sebelum ada write ke Threads.

## Status
Implementasi publisher, validation, dry-run, healthcheck, token maintenance, reply chaining, retry, timeout, unit test, integration test, dan CI sudah tersedia.

Tahap live masih membutuhkan satu dependency eksternal yang tidak boleh diotomatisasi tanpa otorisasi pemilik akun: **Threads User Access Token untuk @rumahgis** dengan permission yang benar. Setelah token tersedia, `THREADS_USER_ID` dapat diambil otomatis dari endpoint `/me` sehingga tidak wajib diisi manual.
