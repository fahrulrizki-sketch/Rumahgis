# Threads Publisher

Publisher untuk @rumahgis dibuat aman secara default.

## Mode aman (dry-run)

```bash
node scripts/threads-publisher.mjs content/drafts/contoh.json
```

Mode ini hanya membaca dan memvalidasi payload. Tidak mengirim apa pun ke Threads.

## Live publish

Live publish hanya berjalan jika dua environment variable tersedia:

- `THREADS_USER_ID`
- `THREADS_ACCESS_TOKEN`

Lalu jalankan:

```bash
node scripts/threads-publisher.mjs content/drafts/contoh.json --publish
```

Credential jangan pernah dimasukkan ke source code atau commit GitHub.

## Format payload

```json
{
  "main": {
    "text": "Teks post utama",
    "media": { "image_url": "https://..." }
  },
  "affiliate": {
    "mode": "auto",
    "product_ids": ["masker-sensi-kn95-individual", "sunscreen-wardah-airy-smooth-spf50"]
  },
  "replies": [
    { "text": "Komentar pertama" },
    { "text": "Komentar kedua", "media": { "image_url": "https://..." } }
  ]
}
```

`product_id` dan `product_ids` bersifat opsional serta tidak boleh dipakai bersamaan. Publisher membaca bank dari `config/affiliate-products.json`, atau dari path `AFFILIATE_PRODUCT_BANK` untuk pengujian/operasional. Setiap link affiliate ditambahkan sebagai satu reply tersendiri, berurutan setelah reply konten terakhir. Jalankan `npm run validate:affiliate` setiap kali bank diubah.

Media URL untuk live API harus dapat diakses oleh server Threads/Meta. File lokal tidak cukup.

## Pengaman

- Default = dry-run.
- `--publish` wajib untuk posting nyata.
- Live publish gagal tertutup (fail closed) jika credential tidak tersedia.
- Konten sensitif, link percobaan, produk nonaktif, short-link palsu, dan relevansi yang dipaksakan menghasilkan AFFILIATE NO.
- Secret hanya dibaca dari environment variable.
- Reply dibuat berurutan agar membentuk satu utas.

## Status milestone

Fondasi publisher: IMPLEMENTED.
Live integration: BLOCKED sampai akun Threads memberikan user ID/access token yang valid dan pengujian API dilakukan.
