# MVP Breakdown — CMS Bank Soal (Fase 3)

Requirement dipecah menjadi task kecil yang dapat diverifikasi satu per satu.
Status mengikuti `docs/agent-workflow.md`: `backlog`, `ready`, `in_progress`, `review`, `done`, `blocked`.

## PM

| ID | Task kecil | Status |
|---|---|---|
| PM-M1 | Turunkan requirement menjadi task MVP per agent | done |
| PM-M2 | Pastikan scope MVP: mapel wajib, CRUD soal + kunci, import, daftar soal + readiness, QA awal | done |
| PM-M3 | Catat progres harian dan serah terima antar agent | done |
| PM-M4 | Verifikasi acceptance criteria MVP bersama QA sebelum ditutup | done |

## Backend

| ID | Task kecil | Status |
|---|---|---|
| BE-M1 | Terapkan `db/schema.sql` ke `bank_soal_db` | done |
| BE-M2 | Init proyek Node.js (Express, pg pool, dotenv, multer) | done |
| BE-M3 | Endpoint `GET /health` + koneksi DB | done |
| BE-M4 | Endpoint `GET /api/v1/mapels` (3 mapel wajib) | done |
| BE-M5 | CRUD soal: list/filter, create, detail, update, archive | done |
| BE-M6 | Upsert kunci jawaban + validasi konsistensi opsi | done |
| BE-M7 | Import soal JSON/CSV/TXT + payload sumber → `question_sources` | done |
| BE-M8 | Endpoint versi & readiness + penyajian static frontend | done |
| BE-M9 | Test otomatis dasar API | done |

## Frontend

| ID | Task kecil | Status |
|---|---|---|
| FE-M1 | Init Vite + React (dependency minimal) | done |
| FE-M2 | Layout dashboard + filter mapel wajib | done |
| FE-M3 | Form input soal + opsi + kunci jawaban | done |
| FE-M4 | Upload/import dari file & payload sumber | done |
| FE-M5 | Daftar soal + indikator kesiapan multi-versi | done |
| FE-M6 | State loading, empty, error | done |
| FE-M7 | Build produksi ringan | done |

## QA

| ID | Task kecil | Status |
|---|---|---|
| QA-M1 | Susun skenario uji MVP | done |
| QA-M2 | Cek syntax backend & build frontend | done |
| QA-M3 | Uji koneksi PostgreSQL & seed mapel | done |
| QA-M4 | Uji endpoint API (positif & negatif) | done |
| QA-M5 | Uji alur form/import lewat API + aset UI | done |
| QA-M6 | Catat bug & status perbaikan | done |

## Definition of Done MVP

- `/health` 200 dengan database `up`.
- Tiga mapel tampil di API dan UI.
- Soal bisa dibuat, dibaca, diubah, diarsipkan, dan memiliki kunci jawaban.
- Import JSON/CSV/TXT berhasil menyimpan sumber + soal.
- Daftar soal menampilkan indikator readiness `v1`/`v2`/`v3`.
- Tidak ada bug P0/P1 pada alur utama.
