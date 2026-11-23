# Release Gate Report — Fase 3

| Field | Isi |
|---|---|
| Tanggal | 2026-11-21 |
| QA Lead | qa-agent |
| PM | pm-agent |
| Versi rilis | 0.1.0-mvp |

## Ringkasan Hasil

| Area | Total | Pass | Fail |
|---|---|---|---|
| Fungsional | 10 | 10 | 0 |
| Validasi data | 3 | 3 | 0 |
| API | 5 | 5 | 0 |
| UI | 1 | 1 | 0 |

Eksekusi: `node --test /opt/virtual-office-bank-soal/qa-agent/tests/mvp-smoke.mjs` atau `npm test` dari `backend-agent/` → `19 pass`, `0 fail`, `0 error` di `/tmp/vo-api.log`.

## Bug Tersisa

| Bug ID | Severity | Owner | Status | Dapat Ditunda? |
|---|---|---|---|---|
| - | - | - | Tidak ada | - |

## Bug Ditemukan & Diperbaiki

| Bug ID | Severity | Owner | Status | Perbaikan |
|---|---|---|---|---|
| BUG-01 | P1 | Backend | fixed | `POST /api/v1/import` dengan `{questions:[...]}` kini diterima; konten di-stringify dan format dipaksa `json` |
| BUG-02 | P1 | Backend | fixed | Upsert kunci jawaban hanya `answer_text` pada soal pilihan kini 200; `COALESCE(id = $2, false)` mencegah NOT NULL violation |
| BUG-03 | P2 | Backend | fixed | `multer` 1.x diganti `2.5.0` setelah peringatan kerentanan `npm audit` |

## Pemenuhan Kriteria Bug-Free

- [x] Tidak ada bug P0
- [x] Tidak ada bug P1
- [x] Semua acceptance criteria Fase 3 `done`
- [x] `/health` API 200 dan DB stabil
- [x] Kategori wajib lengkap
- [x] Kunci jawaban konsisten
- [x] Readiness multi-versi berfungsi

## Keputusan

- [x] **GO** — rilis disetujui
- [ ] **NO GO** — kembali ke agent pemilik

## Catatan PM & QA

- API aktif di `http://127.0.0.1:8082`; PID `/tmp/vo-api.pid`, log `/tmp/vo-api.log`.
- UI produksi disajikan langsung oleh backend dari `frontend-agent/dist` (`index.html` + bundle 151.57 kB).
- Data uji tersimpan di PostgreSQL: `questions=24`, `options=66`, `answer_keys=24`, `sources=16`, `readiness=3`.
- Resource akhir: Mem tersedia `484Mi`, Swap `3.0Gi` bebas, disk `/dev/vda2` `40%` (23G bebas).
- Layanan `nginx`, `n8n`, `hanyadi-api`, `postgresql@16-main` tetap `active`.
