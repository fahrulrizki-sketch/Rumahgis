# Instagram RumahGIS

Integrasi memakai Instagram Login, terpisah dari token Threads. Akun target wajib `rumahgis`.

## Koneksi akun

1. Pada aplikasi Meta yang dikelola pemilik, tambahkan Instagram API dengan Instagram Login.
2. Hubungkan akun Professional RumahGIS dan setujui `instagram_business_basic` serta `instagram_business_content_publish`.
3. Simpan token sebagai GitHub Actions secret `TOKEN_INSTAGRAM_RUMAHGIS` dan ID akun sebagai `INSTAGRAM_USER_ID`. Jangan masukkan token ke payload, commit, atau chat. Token Threads tetap `TOKEN_THREADS_RUMAHGIS`.
4. Jalankan workflow **RumahGIS Threads dan Instagram** dengan path payload; pertama gunakan `publish=false`.
5. Setelah preview sesuai dan media siap, gunakan `publish=true`. Pemanggil otomatis juga dapat memicu workflow yang sama.

## Payload

Payload Threads tetap didukung. Media diambil dari main/replies asli, sebelum penambahan affiliate. Semua URL dihapus dari caption Instagram. Gunakan `instagram.caption` untuk ringkasan maksimal 2200 karakter, dan `instagram.media` untuk mengganti media khusus Instagram:

```json
{
  "main": { "text": "Penjelasan peta", "media": { "image_url": "https://host-publik.example/peta.jpg" } },
  "replies": [],
  "affiliate": { "mode": "auto" },
  "instagram": { "format": "auto", "caption": "Penjelasan visual peta untuk Instagram." }
}
```

Satu gambar dipilih sebagai IMAGE; beberapa media menjadi CAROUSEL; satu video menjadi REELS. Pemilihan ini berdasarkan ketersediaan media, belum menggunakan analitik performa atau prediksi viral.

Instagram memerlukan gambar JPEG yang memenuhi ketentuan platform dan dapat diambil lewat URL publik. Artikel/link preview bukan image_url. Foto artikel harus dipilih dengan izin penggunaan yang jelas, lalu disiapkan sebagai media. Gambar untuk Reels harus terlebih dahulu dirender sebagai video MP4 dan disediakan di URL publik. Pengambilan foto artikel, konversi gambar, rendering Reels, dan hosting media belum diimplementasikan oleh modul ini; payload tanpa media diblokir sebelum Threads terbit.

## Pemulihan

Hasil per platform disimpan di `.social-state` dan artifact GitHub. Pada pengulangan payload yang sama, Threads yang sudah berhasil dilewati. Jika publikasi sempat dimulai tetapi respons tidak pasti, status STARTED memblokir pengulangan otomatis. Periksa akun dan rekonsiliasi state sebelum melanjutkan; jangan menghapus state untuk mencoba lagi.

Artifact disimpan 90 hari. Jika artifact kedaluwarsa, unduhan gagal dan workflow berhenti. Jika artifact dihapus secara manual atau payload diubah, deduplikasi lintas histori tidak terjamin. Jangan menghapus artifact atau mengubah payload untuk mengulang publikasi yang sama. Pemicu lain yang memakai publisher Threads lama tidak berbagi state ini.

Sumber: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
