# Threads Publisher Test Report

Tanggal: 2026-09-01
Status: LIVE SMOKE PASS

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
- Dua puluh Custom Link produksi telah dibuat manual melalui dashboard Shopee Affiliate dan lolos validasi bank lokal; link percobaan tetap terpisah dan nonaktif.

## Status live

GitHub Actions `Threads Live Healthcheck` berhasil menggunakan secret repository. Workflow smoke publish terkontrol kemudian dijalankan dengan payload tetap tanpa affiliate setelah konfirmasi eksplisit owner.

## Hasil smoke publish live

- Waktu: 2026-09-01.
- Workflow: `Threads Controlled Smoke Publish` run `33529373081` — sukses.
- Payload tetap tanpa affiliate dan tanpa reply.
- Threads API mengembalikan root media ID `18126014761805746`.
- Post terverifikasi tampil pada profil @rumahgis: `https://www.threads.com/@rumahgis/post/DcwC3M3mmR_`.
- Tidak dilakukan retry atau publikasi kedua.

Catatan hardening setelah smoke test: respons sementara Threads `Media Not Found` (code 24/subcode 4279009) kini diperlakukan sebagai kondisi container belum siap. Publisher mengulang endpoint publish pada creation ID yang sama dan tidak membuat container/post baru.

Live verification baru boleh dilakukan setelah pemilik akun mengotorisasi Meta Threads App dan memberikan token melalui environment/secret store, bukan melalui commit GitHub.

## Kriteria milestone live selesai

1. Token lolos `threads-healthcheck.mjs` dan username cocok dengan @rumahgis.
2. Permission minimum untuk create/publish dan reply tersedia.
3. Satu smoke test terkontrol berhasil dipublish.
4. ID hasil publish diverifikasi melalui API/account.
5. Payload konten produksi lolos validator dan dry-run.

Kelima kriteria tersebut telah terpenuhi untuk milestone smoke publish. Publikasi konten reguler tetap harus memakai review payload, dry-run, dan kebijakan affiliate sebelum write.

## Publikasi reguler pertama

- Tema: cara membaca Zona Musim dan puncak kemarau September 2026.
- Hasil review: 1 post utama + 5 reply, seluruhnya di bawah 500 karakter.
- Affiliate: NO, karena produk tidak relevan secara alami.
- Run awal `33563721657` gagal sebelum post utama terbit karena container belum siap (`Media Not Found`, code 24/subcode 4279009); profil diverifikasi tidak memuat post parsial.
- Publisher diperkuat pada commit `1e3f9b0` dan CI `33563963472` lulus 15/15 test.
- Run final `33564053875` sukses menerbitkan 1 post utama dan 5 reply.
- Permalink: `https://www.threads.com/@rumahgis/post/Dcwr3SNkukH`.
- Smoke post sebelumnya telah dihapus sesuai persetujuan owner.

## Publikasi utas kemarau dengan affiliate

- Tema: El Niño kuat, debu, perlindungan pernapasan, paparan UV, dan hidrasi saat musim kemarau.
- Main post memuat hook dan kartu tautan resmi BMKG Indonesia.
- Hasil review: 1 main post + 5 reply edukasi + 8 reply produk; setiap link affiliate berada pada reply terpisah dengan pengantar yang relevan.
- Affiliate: YES untuk 8 produk yang relevan; link percobaan tetap diblokir.
- Workflow run `33599763134` sukses dalam 2 menit 34 detik setelah test, validasi bank, dry-run, dan healthcheck lulus.
- Profil memverifikasi rangkaian 1/14 dengan 13 reply tanpa duplikasi.
- Permalink: `https://www.threads.com/@rumahgis/post/DcxnLUXFdAM`.
