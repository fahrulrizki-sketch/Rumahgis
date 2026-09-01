# RumahGIS Threads Automation

Fondasi automation konten untuk akun Threads **@rumahgis**.

## Tujuan
- Menyiapkan draft konten secara terstruktur.
- Memvalidasi konten sebelum publikasi.
- Menyiapkan integrasi resmi Threads API.
- Memisahkan credential/secret dari source code.
- Mendukung alur draft → review → publish → log.

## Struktur awal
- `content/drafts/` — draft yang belum dipublikasikan.
- `content/published/` — arsip metadata konten yang sudah dipublikasikan.
- `scripts/` — script validasi dan, nantinya, publisher Threads API.
- `config/` — konfigurasi non-rahasia.

## Keamanan
Jangan pernah commit access token, app secret, password, atau credential Meta/Threads ke repository. Gunakan environment variables atau secret manager.

## Status
Tahap 1: fondasi repository. Publisher Threads API belum diaktifkan sampai credential dan endpoint diverifikasi.
