# Laporan — Halaman Peserta Tryout

| Field | Isi |
|---|---|
| Tanggal | 2026-11-21 |
| Subdomain | `tryout.hanyadi.web.id` |
| Keputusan | **GO** |

## 1. Estimasi vs Realisasi

| Item | Estimasi | Realisasi |
|---|---|---|
| Halaman statis peserta | 8–12 mnt | ~3 mnt |
| Nginx + proxy API/presentation | 3–5 mnt | ~1 mnt |
| QA + smoke origin/publik | 5 mnt | ~2 mnt |
| **Total** | **16–22 mnt** | **~6 mnt** |

## 2. Implementasi

- Folder: `/opt/virtual-office-bank-soal/tryout-agent/` (`index.html`, `app.js`, `styles.css`).
- Tanpa dependency npm dan tanpa proses Node baru — static file langsung disajikan Nginx, sehingga tidak menambah beban RAM 2GB.
- Fitur peserta:
  - Pilih versi `v1`/`v2`/`v3`.
  - Daftar soal hanya yang `is_ready = true` untuk versi tersebut (`GET /api/v1/questions?ready_version=`).
  - Tombol "Muat lebih banyak" untuk pagination.
  - Buka soal via `GET /api/v1/presentation/questions/{id}?version=`.
  - Jawaban pilihan ganda/benar-salah lewat radio; esai/jawaban singkat lewat textarea.
  - Kirim jawaban → penilaian langsung, kunci, dan pembahasan tampil setelah submit.
  - Skor `benar/total`, navigasi Sebelumnya/Berikutnya, empty/error state, dan toast.
- Semua konten soal dirender dengan `textContent` (tidak `innerHTML`) agar aman dari XSS.

## 3. Nginx & Akses

- Site: `/etc/nginx/sites-available/tryout.hanyadi.web.id`, symlink aktif di `sites-enabled`.
- Root: `/opt/virtual-office-bank-soal/tryout-agent`; `try_files $uri $uri/ /index.html`.
- `location /api/v1/presentation/` → `127.0.0.1:8083`; `location /api/` → `127.0.0.1:8082`; `/health` → API utama.
- Proxy same-origin menghindari masalah CORS di browser.
- SSL memakai `/etc/ssl/cloudflare/hanyadi.web.id.pem` (SAN wildcard `*.hanyadi.web.id`), HTTP `301 → HTTPS`.
- Aset `.css`/`.js` di-cache 1 jam; gzip diwariskan dari `nginx.conf`.
- `nginx -t` OK, reload aman. DNS `tryout.hanyadi.web.id` sudah resolve ke Cloudflare; origin publik `43.173.8.163`.

## 4. QA & Smoke

- `npm test`: **52 tests, 52 pass, 0 fail** (6 test khusus tryout/regresi).
- Origin via Host header: HTML `200`, `app.js` `200`, `styles.css` `200`, `/health` `200`, list API `200`, presentation API `200`, HTTP `301`.
- Publik Cloudflare: `https://tryout.hanyadi.web.id/` `200`, `/app.js` `200`, `/api/v1/questions?ready_version=v1&limit=1` `200`.

## 4a. Bug Ditemukan & Diperbaiki

- Gejala: sebagian soal di daftar `ready v1` gagal dibuka dengan pesan "Soal tidak dapat ditampilkan".
- Penyebab: `7` soal memiliki `question_version_readiness.is_ready = true` tetapi tidak punya baris di `question_presentation_variants`, sehingga endpoint mengembalikan `404 VARIANT_NOT_FOUND`.
- Perbaikan:
  - Backfill idempoten: `db/migrations/003_backfill_missing_variants.sql` (`+232` variasi).
  - `PATCH /api/v1/questions/:id/readiness` kini otomatis membuat variasi ketika `is_ready = true` melalui `ensurePresentationVariant()`.
  - UI tryout menampilkan pesan error asli dari API, bukan pesan generik.
- Verifikasi: `21` soal `ready v1`, `0` gagal; regresi test mengecek semua soal ready dapat disajikan.

## 5. Kondisi Akhir & Catatan

- Memori: available `333Mi`, swap bebas `3.0Gi`; disk `23G/40%`.
- Layanan aktif: `nginx`, `bank-soal-api.service`, `bank-soal-presentation.service`.
- Halaman ini bersifat **tryout/latihan**: kunci jawaban ikut dikirim ke browser dan ditampilkan setelah submit. Untuk ujian resmi, penilaian harus dipindah ke server dan kunci jangan dikirim ke klien.
