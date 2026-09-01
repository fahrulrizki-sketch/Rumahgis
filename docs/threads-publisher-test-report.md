# Threads Publisher Test Report

Tanggal: 2026-09-01
Status: PRE-PRODUCTION PASS / LIVE AUTH PENDING

## Yang sudah diverifikasi

- Source code publisher lolos syntax check Node.js.
- Dry-run menerima payload valid dan tidak melakukan network write.
- Live-flow diuji terhadap mock Threads API lokal.
- Publisher berhasil mengambil user ID melalui `/me` ketika `THREADS_USER_ID` tidak disediakan.
- Publisher membuat container untuk post utama.
- Publisher memanggil endpoint `threads_publish` untuk container utama.
- Reply pertama dibuat dengan `reply_to_id` menunjuk post utama.
- Reply kedua dibuat dengan `reply_to_id` menunjuk reply pertama.
- Hasil mock menghasilkan urutan published ID: root → reply 1 → reply 2.
- Payload validator membatasi teks 500 karakter dan menolak URL media non-HTTPS.
- Live publish fail-closed jika `THREADS_ACCESS_TOKEN` tidak tersedia.
- Bank produk affiliate divalidasi tanpa credential dan link harus memakai `https://s.shopee.co.id/...`.
- Keputusan affiliate fail-closed untuk tragedi/korban/bencana aktif/kematian/konflik.
- Relevansi produk wajib cocok secara eksplisit; produk yang dipaksakan ditolak.
- Link percobaan `904rirq1Xk` tidak dapat diaktifkan untuk auto-publish.
- Link affiliate yang lolos ditempatkan pada reply terakhir; reply baru dibuat bila batas 500 karakter terlampaui.

## Pengujian live yang belum boleh dilakukan

Belum ada Threads User Access Token milik @rumahgis di environment pengujian. Karena itu tidak ada post nyata yang dibuat sebagai bagian dari test ini.

Live verification baru boleh dilakukan setelah pemilik akun mengotorisasi Meta Threads App dan memberikan token melalui environment/secret store, bukan melalui commit GitHub.

## Kriteria milestone live selesai

1. Token lolos `threads-healthcheck.mjs` dan username cocok dengan @rumahgis.
2. Permission minimum untuk create/publish dan reply tersedia.
3. Satu smoke test terkontrol berhasil dipublish.
4. ID hasil publish diverifikasi melalui API/account.
5. Payload konten produksi lolos validator dan dry-run.

Sampai kelima poin di atas terpenuhi, status milestone tetap `LIVE AUTH PENDING`.
