# Skenario Uji MVP — Fase 3

Dasar pengujian: `pm-agent/tasks/mvp-breakdown.md`, `docs/phase3-tasks.md`, `qa-agent/checklists/*`.
Base URL: `http://127.0.0.1:8082`. Kontrak aktif mengikuti ADR-004 / Fase 6j; skenario lama tentang versi/readiness diganti.

| ID | Skenario | Expected |
|---|---|---|
| S-01 | `GET /health` | 200, `ok: true`, database `up` |
| S-02 | `GET /api/v1/mapels` | 3 mapel wajib |
| S-03 | `GET /api/v1/presentation-versions` (deprecated) | 404 `NOT_FOUND` |
| S-04 | Buat soal pilihan ganda valid | 201, soal + opsi + kunci tersimpan |
| S-05 | Detail soal | Opsi & answer key tampil |
| S-06 | Upsert kunci jawaban | Flag `is_correct` sinks dengan kunci |
| S-07 | Upsert kunci esai (tanpa opsi) | 200, `answer_text` tersimpan |
| S-08 | Buat soal dengan `status: draft`/`review` | 400 `VALIDATION_ERROR`; hanya `approved` diterima |
| S-09 | Filter mapel & pencarian | Hanya soal sesuai filter |
| S-10 | Impor JSON | `created` sesuai jumlah soal |
| S-11 | Impor CSV | Opsi & kunci terbaca dari kolom |
| S-12 | Impor TXT terstruktur | Block soal terbaca |
| S-13 | Mapel invalid | 400 `VALIDATION_ERROR` |
| S-14 | Pilihan ganda tanpa opsi benar | 400 `VALIDATION_ERROR` |
| S-15 | File upload > 5MB | 413 `FILE_TOO_LARGE` |
| S-16 | Endpoint tidak ada | 404 `NOT_FOUND` |
| S-17 | Static UI | HTML memuat `#root` dan bundle JS |
| S-18 | Konsistensi DB | Jumlah baris bertambah sesuai operasi |
| S-19 | `GET /api/v1/questions?page=1&limit=20` | 200, `limit` default 20, `pagination: { page, limit, total }` |
| S-20 | Stem di daftar CMS dan daftar/detail tryout | Non-bold (`font-weight: 400`), tanpa `<strong>` |
| S-21 | Endpoint `/presentation-versions`, `/questions/:id/readiness`, `/questions/:id/variants` | 404 `NOT_FOUND` |
| S-22 | Payload `version`/`ready_version` | Tidak dipakai; respons tanpa field `readiness`/`is_multi_version_ready` |

Eksekusi: `node --test /opt/virtual-office-bank-soal/qa-agent/tests/mvp-smoke.mjs`
