# Laporan Task — Fase 4: QA Bug-Free & Integrasi Subdomain

| Field | Isi |
|---|---|
| Tanggal | 2026-11-21 |
| Role | QA Lead & Release Engineer |
| Versi | 0.2.0-phase4 |
| Keputusan | **GO** |

## 1. Estimasi vs Realisasi

| Item | Estimasi | Realisasi | Catatan |
|---|---|---|---|
| QA pass menyeluruh | 15–20 mnt | ~5 mnt | 34 skenario otomatis (19 smoke + 15 edge) |
| Perbaikan bug | 10–15 mnt | ~3 mnt | 1 bug backend (id non-numeric), 2 perbaikan UX frontend |
| Service + Nginx | 10–15 mnt | ~4 mnt | systemd unit + 2 server block + `nginx -t` + reload |
| Smoke test akhir | 5–8 mnt | ~2 mnt | Origin + publik Cloudflare + batas upload |
| **Total** | **40–58 mnt** | **~14 mnt** | Lebih cepat karena artifact Fase 3 sudah reusable |

## 2. Hasil Pengujian QA

- `npm test` (backend-agent): **34 tests, 34 pass, 0 fail**, durasi `~673 ms`.
- Skenario inti: input soal manual, import JSON/CSV/TXT, sumber eksternal, upsert kunci jawaban, readiness v1/v2/v3, update status, arsip, filter 3 kategori wajib, dan persistence PostgreSQL.
- Skenario edge: body kosong, stem whitespace, konten import kosong, format `xml`/biner acak, JSON malformed, CSV header-only, id non-numeric, `correct_key` di luar opsi, dan sumber impor tercatat.
- Error handling terverifikasi: `400 VALIDATION_ERROR`, `400 INVALID_JSON`, `400 INVALID_IMPORT`, `400 UNSUPPORTED_FORMAT`, `404 NOT_FOUND`, `413 FILE_TOO_LARGE`.
- Upload lewat Nginx: file `4MB` lolos ke backend dan ditolak sebagai `400 INVALID_IMPORT`; file `6MB` ditolak backend `413 FILE_TOO_LARGE` (bukan 413 HTML Nginx).
- Data akhir PostgreSQL: `questions=63`, `answer_keys=63`, `sources=46`.
- Kriteria bug-free Fase 4 terpenuhi: tidak ada bug P0/P1 tersisa.

### Bug Diperbaiki

| ID | Severity | Area | Masalah | Perbaikan |
|---|---|---|---|---|
| BUG-04 | P1 | Backend | `GET/PUT/PATCH /api/v1/questions/abc/...` menghasilkan `500 INTERNAL_ERROR` karena `NaN` dikirim ke PostgreSQL | `parseId()` di `backend-agent/src/validate.js`; dipakai di 5 route |
| BUG-05 | P2 | Frontend | Tombol "Impor Soal" tanpa file/konten mengirim request ke API | Guard client-side: "Pilih file terlebih dahulu" / "Konten impor wajib diisi" |
| BUG-06 | P2 | Frontend | Kunci jawaban default `A` bisa tidak cocok jika opsi A kosong | Kunci otomatis jatuh ke opsi pertama yang terisi |

## 3. Konfigurasi Service & Nginx Aktif

### Service
- `bank-soal-api.service`: `active`, `enabled`, `Restart=always`, `MemoryMax=192M`, `CPUQuota=50%`, `NODE_OPTIONS=--max-old-space-size=128`, `ExecStart=/usr/bin/node src/server.js`, `WorkingDirectory=/opt/virtual-office-bank-soal/backend-agent`.
- Backend tidak lagi dijalankan via `nohup`; proses manual lama dihentikan.
- Layanan lain tetap aktif: `nginx`, `hanyadi-api` (internal `:8081`), `n8n`, `postgresql@16-main`.

### Nginx
- `api.hanyadi.web.id`
  - Config: `/opt/hanyadi-vo/config/nginx-api.hanyadi.conf` (backup: `.bak-fase4`).
  - HTTP `301 → https://$host$request_uri`; HTTPS `:443` memakai `/etc/ssl/cloudflare/hanyadi.web.id.pem` (SAN wildcard `*.hanyadi.web.id`).
  - `client_max_body_size 8m`; `location /` dan `/health` → `http://127.0.0.1:8082`.
- `cms.hanyadi.web.id`
  - Config baru: `/etc/nginx/sites-available/cms.hanyadi.web.id`, symlink aktif di `sites-enabled`.
  - Root: `/opt/virtual-office-bank-soal/frontend-agent/dist`; SPA fallback `try_files $uri $uri/ /index.html`.
  - `/api/` dan `/health` → `http://127.0.0.1:8082`; `client_max_body_size 8m`.
- `nginx -t`: syntax OK & test successful; `systemctl reload nginx` berhasil tanpa outage.
- Smoke status: `api/health 200`, `api/api/v1/categories 200`, `cms/ 200 text/html`, `cms/api/v1/categories 200`, `cms/health 200`, HTTP `301` pada kedua domain. Akses publik via Cloudflare: `api 200`, `cms 200`.

## 4. Kondisi Akhir & Rekomendasi

- Memori: total `1.9Gi`, used `1.5Gi`, available `442Mi`; swap `3.9Gi` dengan `3.0Gi` bebas.
- Disk: `/dev/vda2` `40G`, used `15G`, available `23G`, `40%`.
- Konsumsi teratas: `opencode` ~`805MB` + ~`163MB` (tooling sesi, bukan layanan produksi), backend Node ~`83MB`, n8n ~`75MB`, PostgreSQL ~`38MB` + koneksi ~`25MB`.
- Rekomendasi Fase 5 (penyajian soal multi-versi):
  1. Tambah endpoint `GET /api/v1/questions/:id/presentation?version=v1|v2|v3` dan filter `?ready_version=`; hanya sajikan versi dengan `is_ready=true` dari `question_version_readiness`.
  2. Simpan variasi konten per versi di tabel presentation baru, jangan menimpa `questions`/`answer_keys` agar audit trail tetap bersih.
  3. Aktifkan gzip/brotli + cache header untuk aset Vite di Nginx sebelum traffic naik.
  4. Tambah virtualisasi daftar soal di frontend (data sudah 63 soal) agar DOM tidak tumbuh linear.
  5. Jika menambah service rendering, beri `MemoryMax<=128M` atau integrasikan ke API yang sudah ada; jangan jalankan Node process baru tanpa limit.
  6. Monitor swap; jika pemakaian >`1.5Gi`, evaluasi memory n8n/tooling atau tambah swap sebelum fase traffic nyata.
