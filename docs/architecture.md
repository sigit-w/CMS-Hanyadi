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
    upload & filter                ingestion & answer key       db/migrations/030_*
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
| `db/` | `migrations/` (sumber kebenaran aktif), arsip `schema.sql`, dan petunjuk penerapan |
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

Sumber kebenaran skema aktif adalah rangkaian migrasi `db/migrations/` hingga `030_tryout_events_and_sessions.sql`, bukan `db/schema.sql` yang merupakan arsip Fase 3 dan sudah stale. Ringkasan entitas:

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
| `tryout_events` | Induk tryout: `id`, `name`, `slug` unik, `starts_at`, `ends_at`; satu induk memiliki banyak `tryout_sessions` (ADR-017) |
| `tryout_sessions` | Anak induk lewat `event_id` FK `ON DELETE CASCADE`; satu sesi tepat satu mapel, pengaturan CBT (termasuk `cbt_duration_minutes`) berlaku per sesi |
| `tryout_session_mapels` | Relasi sesi–mapel dengan `UNIQUE(session_id)` sejak migrasi `030`; menjamin tepat satu mapel per sesi. PK `(session_id, mapel_id)` warisan ADR-016 tetap ada |
| `v_tryout_events` | View induk yang menambahkan `status` turunan dari `tryout_event_status(bigint)` |

Relasi utama aktif: `mapels -> questions`, `question_sources -> questions`, `questions -> question_options`, `questions -> answer_keys`, `tryout_events -> tryout_sessions -> tryout_session_mapels -> mapels`. Kolom `tryout_sessions.mapel_id` tetap ada sebagai mirror legacy; sumber kebenaran mapel sesi adalah junction yang dibatasi `UNIQUE(session_id)`. Relasi `questions -> question_version_readiness -> presentation_versions` hanya histori dan tidak dipakai UI/API.

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
| POST | `/api/v1/tryouts` | Buat induk `tryout_events` + banyak sesi lewat `sessions[]` (masing-masing satu `mapel_code`); payload flat legacy `mapel_codes[]`/`mapel_code`, `sheet_ids`, `participant_ids`, dan CBT tetap dipecah per mapel |
| GET | `/api/v1/tryouts` / `/api/v1/tryouts/:id` | Daftar/detail induk dengan `event_id`, `name`, `slug`, `starts_at`, `ends_at`, `status`, `sessions[]`, kompatibilitas `mapels[]`/`mapel_code`, dan `submission_count` (API only) |
| GET | `/api/v1/tryouts/:id/sessions` | Daftar sesi dari satu induk; `:id` boleh `event_id` atau `session_id` lama |
| GET | `/api/v1/participants?search=` / `/api/v1/prospektus?search=` | Picker peserta: cari nama, email, kelas, dan sekolah |
| GET | `/api/v1/reports/tryout/export.xlsx?session_id=` | Ekspor XLSX roster peserta/siswa (permission `tryout_reports.read`); tanpa kunci jawaban |
| GET | `/api/v1/presentation/sessions` | Daftar sesi yang tersedia untuk peserta (presentation-service `:8083`) |
| POST | `/api/v1/presentation/attempts/submit-all` | Submit seluruh jawaban non-CBT dalam satu transaksi per sesi; tanpa skor ke peserta |
| POST | `/api/v1/presentation/cbt/attempt/violation` | Catat pelanggaran; response menyertakan `type`, `violation_count`, `max_violations` |
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

## 8a. Fase 6t — Tryout Multi-Mapel & Alur Peserta (ADR-016)

- Satu tryout dapat memuat 1–10 mapel aktif yang unik. Pilihan admin dikirim sebagai `mapel_codes[]`; duplikat dan mapel tidak aktif ditolak `400`.
- Lembar soal dipilih per mapel; backend memastikan setiap `sheet_id` termasuk mapel terpilih dan mengexpand soal aktif dari seluruh lembar.
- Peserta non-CBT mengirim seluruh jawaban sekali lewat `POST /api/v1/presentation/attempts/submit-all`; UI tidak lagi menyediakan submit per soal. Peserta CBT tetap memakai `finalize` attempt.
- Setiap pelanggaran CBT memunculkan toast berisi jenis dan `n/m`. Debounce 750 ms dan batas pelanggaran tidak diubah.
- ADR-016 tetap menjadi sejarah untuk data Fase 6t; untuk data baru aturan "satu tryout banyak mapel" digantikan ADR-017: induk memuat banyak sesi dan tiap sesi tepat satu mapel.

## 8b. Fase 6u — Model Induk–Sesi, Status, dan Alur Tryout-Agent (ADR-017)

- **Induk–sesi.** `tryout_events` adalah induk dengan `slug` unik dipakai URL undangan/login; `tryout_sessions.event_id` adalah FK `ON DELETE CASCADE`. Backfill awal 1:1 mempertahankan slug login, JWT, dan seluruh FK `session_id` existing. Slug sesi lama tetap diterima sebagai fallback; `auth_sessions` dan JWT menyimpan `tryout_event_id` di samping `tryout_session_id`.
- **Satu sesi = satu mapel.** `tryout_session_mapels` dibatasi `UNIQUE(session_id)` oleh migrasi `030`. Sesi lama multi-mapel hasil ADR-016 dipecah menjadi sesi anak; lembar, soal, peserta, attempt, draft, flag, dan pelanggaran dipindah/diduplikasi sesuai mapelnya tanpa menghapus baris `tryout_submissions`. `tryout_sessions.mapel_id` tetap sebagai mirror legacy.
- **Status turunan.** `terjadwal` bila `now() < starts_at`, `berlangsung` di dalam rentang, `selesai` bila `now() > ends_at`. Nilai dihitung server oleh `tryout_event_status(bigint)`/`v_tryout_events` dan dikembalikan di response API; **tidak ada kolom fisik `status`**. `is_active` tidak diubah otomatis agar constraint unik lama tetap aman.
- **Gate `ends_at`.** Batas akhir induk mengunci login/refresh dan seluruh akses soal/attempt (termasuk autosave dan submit); presentation-service memeriksa `tryout_event_is_open(bigint)`. Setelah batas terlampaui, login ditolak 401 netral dan permintaan sesi aktif ditolak 410 dengan pesan batas akhir. Sesi yang sudah `submitted` tetap terkunci.
- **Deadline efektif.** `cbt_duration_minutes` berlaku per sesi. Deadline attempt = `min(start_at sesi + durasi sesi, ends_at induk)` dan dikirim sebagai `effective_deadline_at` di samping `deadline_at`; autosave, flag, violation, dan finalize memakai deadline efektif yang sama.
- **Alur tryout-agent per sesi.** Peserta login memakai slug induk, lalu `GET /api/v1/presentation/sessions` memberi daftar sesi yang terdaftar untuknya. Agen menampilkan tab sesi dan hanya memuat soal sesi yang dipilih (`session_id` dikirim ke `/tryout/questions`, `/presentation/questions`, dan endpoint CBT/submit-all). Setelah sesi selesai muncul `Lanjut sesi berikutnya` dan `Keluar`; peserta boleh login ulang dan melanjutkan sesi lain selama `now() <= ends_at` induk. Aset dimuat sebagai `app.js?v=19`.
- **UI CMS.** Tidak ada opsi `jadikan sesi aktif`, tidak ada kolom `Lembar`, dan tidak ada kolom `Submission` pada tabel daftar tryout. Fieldset pemilih lembar soal di form tetap ada karena dipakai menyusun soal sesi; `submission_count` tetap dikembalikan API untuk laporan/internal saja.

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
| 6t | Tryout multi-mapel & submit global per sesi | histori (ADR-016) |
| 6u | Induk–sesi, status turunan, ekspor, dan lanjut sesi | Dokumen aktif diselaraskan dengan ADR-017; gate `REL-27` |
