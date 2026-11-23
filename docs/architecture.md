# Architecture — Virtual Office Bank Soal

## 1. Konteks dan Tujuan

Sistem CMS bank soal untuk software house virtual. Fase 2 menyiapkan struktur kerja, spesifikasi, dan skema awal. Fase 3 mengimplementasikan API dan UI. Fase 4 menyajikan soal dalam beberapa versi; desain multi-versi itu sudah disederhanakan oleh ADR-004 / Fase 6j (data lama tetap ada sebagai histori).

Tujuan:

- Memisahkan tanggung jawab PM, Backend, Frontend, dan QA secara tegas.
- Menjadikan PostgreSQL sebagai satu-satunya sumber kebenaran data soal.
- Mendukung tiga kanal masuk soal: input manual, upload file, pengumpulan eksternal.
- Menyediakan penanda kesiapan multi-versi sejak awal (desain lama; kini nonaktif mengikuti ADR-004).

## 2. Batasan Lingkungan

| Item | Nilai / Keputusan |
|---|---|
| Database | PostgreSQL 16.15, `127.0.0.1:5432`, DB `bank_soal_db`, user `bank_soal_user` |
| RAM | 2GB (sekitar 489Mi tersedia saat dokumen ini dibuat), swap 3.9Gi aktif |
| Disk | 40GB, 40% terpakai, 23GB tersedia |
| Service lain | `hanyadi-api`, `n8n`, `nginx`, Postgres untuk proyek lama — tidak boleh diganggu |
| Runtime Fase 3 | Node.js 20 LTS + Express, React 18 + Vite (belum diinstal di Fase 2) |

Konsekuensi desain:

- Tidak ada service, container, atau dependency baru yang dipasang di Fase 2.
- Pool koneksi database maksimal 5 per proses, dengan `statement_timeout` 5 detik.
- Batas upload awal 5MB per file dengan whitelist MIME.
- Tidak ada ORM berat; query via `pg` dengan parameterized statement.
- Semua kredensial disimpan di `.env` (mode 600), tidak di repository.

## 3. Diagram Komponen

```
 [PM Agent]
   | backlog, prioritas, status, handoff
   v
 [Frontend React] --HTTP/JSON--> [Backend Node.js] --SQL--> [PostgreSQL]
   CMS input soal                 REST API + validator         bank_soal_db
   upload & filter                ingestion & answer key       db/schema.sql
        \                              |
         \------- QA Agent <-----------/
                    | uji API, UI, integritas data
                    v
              Release Gate --> PM
```

## 4. Struktur Direktori

| Path | Isi |
|---|---|
| `docs/` | Spesifikasi arsitektur, workflow, backlog Fase 3 |
| `db/` | `schema.sql` dan petunjuk penerapan |
| `pm-agent/tasks/` | Backlog & template handoff |
| `pm-agent/progress/` | Status board progres antar agent |
| `pm-agent/decisions/` | Log keputusan arsitektur |
| `backend-agent/src/` | `config`, `routes`, `controllers`, `services`, `middlewares`, `validators`, `db` |
| `backend-agent/openapi/` | Kontrak API yang jadi acuan frontend & QA |
| `backend-agent/tests/` | Unit & integrasi test |
| `frontend-agent/src/` | `components`, `pages`, `hooks`, `services`, `stores`, `styles` |
| `frontend-agent/public/` | Aset statis |
| `frontend-agent/tests/` | Test komponen & alur UI |
| `qa-agent/checklists/` | Checklist fungsional, validasi data, API & UI |
| `qa-agent/test-cases/` | Test case Fase 3 |
| `qa-agent/reports/` | Laporan release gate |
| `scripts/` | Skrip operasional bersama |

## 5. Model Data

Skema kanonik ada di `db/schema.sql`. Ringkasan entitas:

| Entitas | Fungsi |
|---|---|
| `contributors` | Pembuat/editor/reviewer soal dan validator |
| `mapels` | Mapel wajib: `MTKA`, `BIND`, `IPAS` (kode unik 4 kapital, ADR-005/D6) |
| `source_types` | Jenis sumber: `manual`, `file_upload`, `external_collection` |
| `question_sources` | Detail sumber: nama file, path, MIME, referensi eksternal, metadata |
| `questions` | Batang soal, tipe, tingkat kesulitan, status (`approved`/`rejected`/`archived`); soal baru otomatis `approved` |
| `question_options` | Pilihan jawaban dengan `is_correct` dan urutan |
| `answer_keys` | Kunci jawaban (opsi benar atau teks) + pembahasan |
| `presentation_versions` | Daftar versi penyajian (`v1`, `v2`, `v3`) — data historis nonaktif (ADR-004) |
| `question_version_readiness` | Penanda kesiapan per soal per versi — data historis nonaktif (ADR-004) |
| `v_question_catalog` | View ringkas untuk daftar soal (frontend & QA) |

Relasi utama aktif: `mapels -> questions`, `question_sources -> questions`, `questions -> question_options`, `questions -> answer_keys`. Relasi `questions -> question_version_readiness -> presentation_versions` hanya histori dan tidak dipakai UI/API.

## 6. Kontrak REST API (Rancangan Fase 3, diselaraskan Fase 6j)

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/v1/mapels` | Daftar mapel aktif |
| GET | `/api/v1/questions` | Daftar soal + filter `mapel`, `status`, `source`, pagination |
| POST | `/api/v1/questions` | Buat soal manual |
| GET | `/api/v1/questions/:id` | Detail soal + opsi + kunci |
| PUT | `/api/v1/questions/:id` | Update soal |
| DELETE | `/api/v1/questions/:id` | Arsipkan soal |
| POST | `/api/v1/questions/:id/options` | Tambah/replace opsi jawaban |
| PUT | `/api/v1/questions/:id/answer-key` | Simpan kunci jawaban & pembahasan |
| GET | `/api/v1/sources` | Daftar sumber soal |
| POST | `/api/v1/sources/uploads` | Upload file soal |
| POST | `/api/v1/sources/external` | Catat pengumpulan eksternal |
| ~~PATCH~~ | ~~`/api/v1/questions/:id/readiness`~~ | **Deprecated (404)** — dihapus Fase 6j (ADR-004) |
| ~~GET~~ | ~~`/api/v1/presentation-versions`~~ | **Deprecated (404)** — dihapus Fase 6j (ADR-004) |
| ~~GET~~ | ~~`/api/v1/questions/:id/variants`~~ | **Deprecated (404)** — presentation service membaca tabel inti |
| GET | `/health` | Status API & koneksi DB |

Konvensi:

- Semua respons JSON dengan envelope `{ ok, data|error, meta }`.
- Error membawa `code`, `message`, dan `status` HTTP yang konsisten.
- Pagination memakai `page` dan `limit` (default 20, maks 100); respons menyertakan `pagination: { page, limit, total }`.
- Validasi input di `validators/` sebelum menyentuh database.
- Semua query memakai parameter binding.

## 7. Alur Ingestion Soal

```
manual / file / eksternal
        |
        v
question_sources (type + metadata)
        |
        v
questions (mapel wajib, otomatis approved)
        |
        v
question_options + answer_keys (sumber konten tunggal)
        |
        v
siap tampil di tryout (approved, bukan archived)
```

## 8. Kesiapan Multi-Versi (Data Historis, Nonaktif)

Desain multi-versi Fase 5 sudah disederhanakan ADR-004 / Fase 6j. Tabel `presentation_versions`, `question_version_readiness`, dan `question_presentation_variants` tidak dihapus (untuk rollback), tetapi tidak dipakai UI/API.

- Tidak ada pilihan versi, filter `ready_version`, query `version`, atau endpoint versi/readiness/varian; endpoint lama mengembalikan 404.
- Status soal langsung `approved` saat dibuat; `draft` dan `review` ditolak dan dimigrasikan oleh `015_simplify_question_status.sql`.
- Backend dan presentation service membaca `questions` + `question_options` + `answer_keys`. Gate tampil tryout: `questions.status='approved'` dan bukan `archived`.
- Stem soal dirender tanpa bold; daftar CMS memakai pagination `limit=20` dengan kontrol Prev/Next.

## 9. Non-Fungsional dan Keamanan

- Pool koneksi kecil dan `statement_timeout` untuk melindungi RAM 2GB.
- Upload: batas 5MB, whitelist MIME, nama file disanitasi, path disimpan relatif.
- Mapel, tipe soal, dan status dibatasi `CHECK` agar tidak ada nilai liar.
- Kunci jawaban harus konsisten dengan `question_options.is_correct` (divalidasi QA).
- Tidak ada secret di source code; gunakan `.env` dengan permission 600.
- Audit perubahan lewat `updated_at` dan `created_by`/`updated_by`.

## 10. Roadmap

| Fase | Fokus | Status |
|---|---|---|
| 2 | Struktur, dokumentasi, schema awal, backlog Fase 3 | Selesai |
| 3 | Implementasi backend Node.js, frontend React, pengujian QA | Siap jalan |
| 4 | Penyajian soal multi-versi & optimasi | Selesai (desain disederhanakan ADR-004) |
| 6j | Penyederhanaan status soal & pagination | Dokumen aktif diselaraskan dengan ADR-004 |
