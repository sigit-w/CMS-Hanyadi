# Laporan Fase 5 — Penyajian Soal Multi-Versi

| Field | Isi |
|---|---|
| Tanggal | 2026-11-21 |
| Versi | 0.3.0-phase5 |
| Keputusan | **GO** |

## 1. Estimasi vs Realisasi

| Item | Estimasi | Realisasi |
|---|---|---|
| Migrasi tabel variasi + seed | 12–18 mnt | ~3 mnt |
| Service presentation + limit memori | 8–10 mnt | ~3 mnt |
| Virtualisasi UI + filter versi | 10–15 mnt | ~2 mnt |
| Nginx gzip/cache/proxy + QA | 15 mnt | ~3 mnt |
| **Total** | **~35–50 mnt** | **~9–11 mnt** |

## 2. Implementasi Rekomendasi

### 2.1 Endpoint penyajian per v1/v2/v3 (gate `is_ready=true`)

- Service baru `bank-soal-presentation.service` aktif di `127.0.0.1:8083`.
- Endpoint:
  - `GET /health`
  - `GET /api/v1/presentation/questions/:id?version=v1|v2|v3` → `200` hanya jika `question_version_readiness.is_ready = true`; jika tidak → `403 VERSION_NOT_READY`; jika variasi belum ada → `404 VARIANT_NOT_FOUND`.
  - `GET /api/v1/presentation/questions/:id/variants` → daftar v1/v2/v3 + status readiness.
  - `PUT /api/v1/presentation/questions/:id/:version` → upsert variasi untuk authoring, wajib header `X-Presentation-Key`; tanpa kunci → `401 UNAUTHORIZED`. Kunci disimpan di `/etc/postgresql/bank_soal_db.credentials` (mode 600), tidak pernah dicetak atau disimpan di kode.
- API utama mendapat filter `GET /api/v1/questions?ready_version=v1|v2|v3`; nilai invalid → `400 VALIDATION_ERROR`.
- Akses publik: `https://api.hanyadi.web.id/api/v1/presentation/questions/110?version=v1` → `200`; `?version=v3` pada soal yang belum ready → `403`.

### 2.2 Tabel variasi terpisah

- File: `/opt/virtual-office-bank-soal/db/migrations/002_presentation_variants.sql`.
- Tabel `question_presentation_variants`: unik `(question_id, version_id)`, FK ke `questions` dan `presentation_versions`, kolom `stem`, `question_type`, `difficulty`, `options` (jsonb), `correct_key`, `answer_text`, `explanation`, `metadata`, `created_at`, `updated_at`, trigger `set_updated_at`, 2 index.
- Seed awal: `78 soal × 3 versi = 234` variasi. Data saat ini: `239` variasi, `110` soal, `11` soal ready di v1.
- Dokumentasi diperbarui: `db/README.md`, `backend-agent/openapi/openapi.yaml` (versi `0.2.0`, 2 server).

### 2.3 Gzip & cache aset Vite

- `/etc/nginx/nginx.conf`: `gzip_vary on`, `gzip_proxied any`, `gzip_comp_level 5`, `gzip_min_length 1024`, `gzip_types` untuk CSS/JS/JSON/XML.
- `cms.hanyadi.web.id`: `location /assets/` → `expires 1y`, `Cache-Control: public, immutable`; `index.html` → `no-cache`.
- Header terverifikasi: `content-encoding: gzip`, `cache-control: public, immutable`, `expires +1 tahun`, `vary: Accept-Encoding`.

### 2.4 Virtualisasi daftar soal

- Di `frontend-agent/src/App.jsx`: windowing manual tanpa dependency baru.
  - `ROW_HEIGHT = 132`, `VIEWPORT_HEIGHT = 520`, `OVERSCAN = 3`.
  - Hanya `questions.slice(startIndex, endIndex)` yang dirender; spacer div sebelum/sesudah list menjaga tinggi scroll.
  - `scrollTop` direset saat filter/refresh berubah.
- Filter baru "Siap versi" memakai `ready_version`.
- Bundle produksi: `index-WabKMkiC.js` `152.53 kB` (gzip `49.08 kB`).

### 2.5 Limit memori service baru

- `bank-soal-presentation.service`: `MemoryMax=134217728` (128 MiB), `CPUQuota=20%`, `NODE_OPTIONS=--max-old-space-size=96`, pool PostgreSQL `max: 2`.
- `bank-soal-api.service` tetap dibatasi `MemoryMax=201326592` (192 MiB).
- Keduanya `active`, `enabled`, `Restart=always`.

## 3. Hasil QA & Smoke

- `npm test` dari `backend-agent/`: **46 tests, 46 pass, 0 fail** (`19` smoke + `15` edge + `12` Fase 5).
- Skenario Fase 5 mencakup: health service, pembuatan soal, upsert variasi v1/v2/v3, gate `403` untuk versi belum ready, transisi readiness `v2`, daftar variasi, filter `ready_version`, validasi versi/id, dan marker UI virtualisasi.
- `nginx -t`: OK; `systemctl reload nginx`: berhasil.
- Akses publik Cloudflare: `cms 200`, `api/health 200`, `presentation 200`.
- Semua layanan aktif: `nginx`, `bank-soal-api`, `bank-soal-presentation`, `hanyadi-api`, `n8n`, `postgresql@16-main`.

## 4. Kondisi Akhir & Rekomendasi

- Memori: total `1.9Gi`, used `1.6Gi`, available `272Mi`; swap `3.9Gi` dengan `3.1Gi` bebas. Penurunan available terutama dari proses tooling sesi (`opencode`) dan build, bukan layanan produksi yang sudah dibatasi cgroup.
- Disk: `/dev/vda2` `40G`, used `15G`, available `23G`, `40%`.
- Rekomendasi berikutnya:
1. Tambah UI authoring variasi (editor per v1/v2/v3) di CMS agar tidak perlu memanggil API manual dengan `X-Presentation-Key`.
2. Tambah endpoint bulk readiness dan audit trail `validated_by` (kolom sudah ada) sebelum rilis konten produksi.
3. Rotasi `PRESENTATION_WRITE_KEY` berkala dan simpan di secrets manager ketika infrastructure tersedia.
4. Pantau `available memory`; jika `<150Mi` setelah traffic nyata, turunkan `worker_connections` Nginx atau batasi memory n8n/tooling sebelum menambah service lagi.
