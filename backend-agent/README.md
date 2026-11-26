# Backend Agent — Node.js

## Fungsi

Merancang dan membangun REST API yang terhubung ke PostgreSQL `bank_soal_db`, termasuk validasi input/upload soal, pengelolaan pilihan dan kunci jawaban. Soal baru otomatis `approved`; tidak ada versi maupun readiness (ADR-004/Fase 6j).

## Peta Direktori

| Path | Fungsi |
|---|---|
| `src/config/` | Konfigurasi lingkungan, port, batas upload, pool DB |
| `src/db/` | Koneksi `pg` pool, migrasi, query helper |
| `src/routes/` | Definisi endpoint |
| `src/controllers/` | Orkestrasi request/response |
| `src/services/` | Logika bisnis soal dan sumber (tanpa readiness) |
| `src/validators/` | Validasi input, MIME, ukuran file, mapel |
| `src/middlewares/` | Error envelope, auth dasar, logging |
| `openapi/` | Kontrak API yang dipakai frontend & QA |
| `tests/` | Unit test dan integration test |

## Mapel yang Didukung

Seed awal: `MTKA`, `BIND`, `IPAS`. Kode mapel unik tepat 4 karakter `^[A-Z0-9]{4}$`; sejak Fase 6aa kode mapel dipakai bersama kode jenjang pada format lembar `LS-<KODE_MAPEL>-<SD|SMP|SMA>-<mmyy>` dengan `mmyy` UTC, contoh `LS-MTKA-SD-1126`. Endpoint CRUD memakai permission `mapels.manage` (default admin).

Fase 6t (ADR-016, histori): satu tryout dapat memuat 1–10 mapel aktif yang unik. `POST /api/v1/tryouts` menerima `mapel_codes: ["MTKA", "IPAS"]`; field lama `mapel_code` tetap diterima sebagai satu elemen dan harus sama bila keduanya dikirim. Relasi tersimpan di tabel `public.tryout_session_mapels(session_id, mapel_id)` (PK gabungan, FK cascade) yang di-backfill oleh migrasi `db/migrations/029_tryout_multi_mapel.sql`. Kolom lama `tryout_sessions.mapel_id` hanya untuk kompatibilitas pembacaan dan diisi mapel pertama. `GET /api/v1/tryouts` dan `GET /api/v1/tryouts/{id}` mengembalikan `mapels: [{ id, code, name }]` (urutan kode) beserta `mapel_id`, `mapel_code`, `mapel_name` legacy. `tryout_count` pada `GET /api/v1/mapels` dihitung dari junction. `sheet_ids` harus berasal dari mapel terpilih; soal yang dikirim langsung lewat `question_ids` harus `approved`. Untuk data baru aturan "satu tryout banyak mapel" digantikan ADR-017: payload flat tetap dipecah menjadi satu sesi per mapel.

## Kontrak Fase 6aa (ADR-023) — Jenjang Wajib

- Migrasi `034_jenjang_soal_lembar_tryout_program.sql` menambah `jenjang_id BIGINT NOT NULL` dengan FK ke `public.jenjang` pada `questions`, `question_sheets`, `tryout_events`, dan `program_belajar`. Baris lama di-backfill ke `SD` sebelum kolom menjadi wajib; `question_sheets.code` diperlebar menjadi `VARCHAR(16)` dan `v_question_catalog` menyertakan `jenjang_kode`/`jenjang_nama`.
- `POST /api/v1/questions` dan `PUT /api/v1/questions/{id}` mewajibkan `jenjang` (`SD`/`SMP`/`SMA`, alias `jenjang_kode`). `GET /api/v1/questions` menerima filter opsional `jenjang` yang memakai `j.kode`. Template CSV/XLSX memuat 19 header dengan `jenjang` tepat setelah `mapel`; header lain atau payload `content`/`questions[]` ditolak `400 VALIDATION_ERROR`.
- Kode lembar hanya `^LS-[A-Z0-9]{4}-(SD|SMP|SMA)-[0-9]{4}$`. `GET /api/v1/question-sheets/generate-code?mapel=<4 karakter>&jenjang=<SD|SMP|SMA>` memakai UTC `mmyy`; kode eksplisit pada create/update wajib cocok dan jenjangnya sama dengan `jenjang` payload. `GET /api/v1/question-sheets/question-picker` mewajibkan `jenjang`; `GET /api/v1/question-sheets` menerima filter `jenjang` opsional.
- `POST /api/v1/tryouts` mewajibkan `jenjang` dan mengabaikan field `slug` dari payload; slug induk dibangkitkan backend dari nama + ID. Setiap `sheet_ids` sesi harus berjenjang sama dengan induk; daftar/detail tryout mengembalikan `jenjang_kode`/`jenjang_nama`. CMS menampilkan kolom `Jenjang` dan tidak memakai dialog `Atur CBT` terpisah.
- `GET`/`POST`/`PUT /api/v1/program-belajar` memakai `jenjang` wajib dengan kode tiga nilai tersebut; daftar/detail mengembalikan `jenjang_kode`/`jenjang_nama`.

## Hak Akses

`GET /api/v1/permissions` mengembalikan 47 permission aktif dari tabel `permissions` (46 setelah migrasi `028` + `tryout_questions.key_export` dari migrasi `032`). Permission `*.manage` lama tetap menjadi guard endpoint existing; permission CRUD baru (`questions.*`, `question_sheets.*`, `tryouts.*`, `participants.*`, `mapels.*`, `roles.*`, `users.*`, `program_belajar.*`) dipakai UI Kelola Role dan tidak mengubah kontrak guard lama. `admin` memiliki seluruh permission lama; `editor` memiliki CRUD soal, lembar soal, dan program belajar; `validator`, `viewer`, dan `peserta` tidak berubah. `tryout_questions.key_export` tidak otomatis diberikan ke role mana pun, termasuk `admin`, dan harus di-assign lewat Kelola Role.

## Peserta Tryout

Saat membuat peserta Siswa (`jenis='siswa'`), `password` opsional. Jika kosong dan `wa_orang_tua` berisi 8–15 digit setelah formatted, sistem memakai digit WA sebagai password; jika tidak, sistem memakai default `nama depan@mmyy` (misalnya `Budi@1126`). Password dapat diganti saat pendaftaran maupun lewat reset; minimal 6 karakter.

Peserta Umum (`jenis='umum'`) dibuat dengan `nama`, `sekolah`, `wa_orang_tua`, dan `pin` opsional 8–15 digit; bila kosong, PIN = digit WA. Login memakai `username` yang dibangkitkan sistem dan `password = pin` dengan verifikasi `pin_hash` scrypt; PIN plaintext juga tersimpan di `pin_plain` untuk ditampilkan di endpoint detail. `username = [SD|SMP|SMA][4 digit (Hari_ke_dalam_tahun - 1) * 24 + Jam Asia/Jakarta][4 digit WA]`, dengan jam Asia/Jakarta dan empat digit terakhir WA. Endpoint login menerima `username` dan tetap menerima fallback `email`/`nama` untuk klien lama. Nama Umum unik tanpa memperhatikan huruf besar/kecil. Payload lama Siswa dan endpoint lama `/tryout-sessions` tetap diterima.

Fase 6p (ADR-008) menambahkan `DELETE /api/v1/tryouts/{id}/participants/{participantId}` untuk mengeluarkan peserta dari sebuah tryout. Peserta Siswa hanya kehilangan relasi `tryout_session_participants`; data siswa tidak diubah. Peserta Umum yang dikeluarkan mengalami hal yang sama dan ditandai `prospek=true`, `prospek_at` terisi, `is_active=false`, serta sesinya dicabut. Data tersebut muncul di `GET /api/v1/prospektus`. Untuk daftar peserta pada form tryout yang belum disimpan, `POST /api/v1/participants/{id}/prospek` melakukan hal yang sama tanpa memerlukan ID tryout; Siswa ditolak dengan `400`. Endpoint lama `DELETE /participants/{id}` tetap berarti nonaktifkan peserta secara global dan tidak dipakai untuk aksi tryout.

Fase 6q (ADR-009) menambahkan `POST /api/v1/tryouts/{id}/participants` dengan payload `{ "participant_ids": [1, 2] }` untuk melampirkan peserta yang sudah ada ke tryout tersimpan dari popup **Kelola Peserta**. Endpoint memakai `tryouts.manage`, menolak peserta nonaktif/prospek, dan melewati relasi yang sudah ada sehingga aman dipanggil ulang. Respons memuat `added_ids` serta daftar `participant_ids` terbaru. Tidak ada perubahan skema pada Fase 6q.

Fase 6r (ADR-010) memindahkan seluruh Peserta Umum ke `public.prospektus` dan mengganti nama tabel lama menjadi `public.siswa`; view `tryout_participants` tetap tersedia untuk kompatibilitas. Endpoint `GET /api/v1/participants/{id}/detail` menampilkan `password_plain`/`pin_plain`, `GET /api/v1/prospektus/{id}` menampilkan detail prospektus, dan `POST /api/v1/prospektus/{id}/daftar` menyalin prospektus ke `siswa` lalu menandai `bergabung=true`. Password user CMS di `contributors.password_hash` tetap scrypt dan tidak pernah dikembalikan oleh API.

Fase 6s (ADR-011), diperbarui Fase 6y (ADR-021): `POST /api/v1/auth/login` untuk Siswa/Peserta Umum wajib mengirim `tryout_slug` berupa **slug sesi** dari URL `/{slug}`; akun harus terdaftar pada sesi tersebut. Slug induk tryout ditolak dengan `401 TRYOUT_EVENT_SLUG` dan pesan meminta tautan sesi terbaru. Sesi dan JWT participant menyimpan `tryout_session_id`/`tryout_session_slug` (field `tryout_slug` lama tetap berisi slug grup untuk kompatibilitas); daftar soal serta submission dibatasi pada sesi yang terikat. `GET /api/v1/siswa` hanya mengembalikan `public.siswa`, `GET /api/v1/tryouts/{id}/participants` hanya peserta tryout, dan konversi prospektus tetap lewat `POST /api/v1/prospektus/{id}/daftar` yang dipicu eksplisit dari halaman Prospektus.

## Kontrak Fase 6u (ADR-017)

`tryout_events` adalah induk dari banyak `tryout_sessions` lewat `tryout_sessions.event_id` (FK cascade, migrasi `030`). Satu sesi tepat satu mapel karena `tryout_session_mapels` dibatasi `UNIQUE(session_id)`; kolom `tryout_sessions.mapel_id` hanya mirror legacy. `status` (`terjadwal`/`berlangsung`/`selesai`) adalah field turunan server dari `starts_at`/`ends_at`, **bukan kolom fisik**, dan tidak mengubah `is_active`.

**`POST /api/v1/tryouts`** membuat induk plus banyak sesi:

```json
{
  "jenjang": "SD",
  "name": "Tryout Contoh",
  "starts_at": "2026-11-25T08:00:00+07:00",
  "ends_at": "2026-11-25T10:00:00+07:00",
  "participant_ids": [11, 12],
  "sessions": [
    {
      "name": "Sesi MTKA",
      "mapel_code": "MTKA",
      "sheet_ids": [21],
      "cbt_enabled": true,
      "cbt_duration_minutes": 30
    },
    {
      "name": "Sesi IPAS",
      "mapel_code": "IPAS",
      "sheet_ids": [22],
      "cbt_enabled": true,
      "cbt_duration_minutes": 15,
      "cbt_max_violations": 3
    }
  ]
}
```

- Tiap elemen `sessions[]` memuat tepat satu `mapel_code` (wajib), minimal satu `sheet_ids` aktif (wajib), `name?`, `start_at?`/`end_at?` dalam rentang induk, serta `cbt_enabled`, `cbt_duration_minutes` (1–600 saat CBT), `cbt_shuffle_questions`, `cbt_shuffle_options`, `cbt_require_fullscreen`, dan `cbt_max_violations` (0–100) **per sesi**. `question_ids` dan `mapel_codes[]` di dalam sesi ditolak; mapel duplikat antarsesi ditolak; maksimal 20 sesi; `sheet_ids` harus ber-mapel sama dengan sesinya.
- Fase 6y menghapus dukungan payload flat legacy: `sessions[]` wajib berisi minimal satu sesi, dan field top-level `sheet_ids`/`question_ids`/`mapel_codes`/`session_date` ditolak. Respons `201` memuat `data.tryout` dengan `event_id` dan `sessions[]`; setiap `sessions[].slug` adalah URL peserta.
- Fase 6aa/ADR-023 menambahkan `jenjang` wajib di luar contoh historis di atas; field `slug` pada payload diabaikan karena slug induk dibangkitkan backend, dan lembar pada tiap sesi harus berjenjang sama.

**`GET /api/v1/tryouts`** mengembalikan satu baris per induk: `event_id`, `name`, `slug`, `jenjang_kode`/`jenjang_nama` (ADR-023), `starts_at`, `ends_at`, `status`, dan `sessions[]`. Field kompatibilitas `mapels[]` (agregat mapel sesi), `mapel_code`/`mapel_id`/`mapel_name` (mapel pertama), `start_at`/`end_at`, `session_id`, dan `submission_count` tetap ada. `submission_count` hanya untuk kebutuhan API/laporan/internal. **`GET /api/v1/tryouts/:id`** menerima `event_id` maupun `session_id` lama dan mengembalikan bentuk yang sama; **`GET /api/v1/tryouts/:id/sessions`** mengembalikan `{ tryout_event_id, sessions[] }`. Slug induk hanya groupings admin; URL undangan/login memakai `sessions[].slug`, slug induk ditolak jelas, dan JWT/sesi menyimpan `tryout_session_id` sebagai scope utama.

**Picker peserta:** `GET /api/v1/participants?search=`, `GET /api/v1/siswa?search=`, dan `GET /api/v1/prospektus?search=` mencari nama, email, kelas, dan sekolah (case-insensitive). Dialog Peserta Umum menampilkan siswa aktif dan prospektus aktif; ID prospektus aktif boleh dilampirkan langsung, sedangkan yang `bergabung=true` dipetakan ke ID `siswa` hasil konversi agar tidak duplikat. Guard hanya menolak peserta `is_active=false`.

**Ekspor:** `GET /api/v1/reports/tryout/export.xlsx?session_id=...&tryout_name=...` memakai permission `tryout_reports.read` dan `exceljs`. Format `.xlsx` mengikuti Fase 6v / ADR-018 (sheet `Laporan Tryout`, header dua level, grup `B|S|NILAI` per mapel); rincian ada di bagian berikutnya. Termasuk peserta yang belum submit, tanpa kunci jawaban/pembahasan, dan tanpa pemotongan `LIMIT 500`; seluruh sesi yang cocok diambil tanpa paginasi 500.

**Presentation-service (`:8083`):** `GET /api/v1/presentation/sessions` mengembalikan hanya sesi yang terikat pada URL/JWT peserta (`id`, `tryout_event_id`, `name`, `slug`, `mapel_code`, `status`, jadwal, pengaturan CBT, `completed`/`submitted`). Endpoint soal, submit-all, dan CBT menolak `session_id` selain sesi yang terikat dengan `403 Tautan tryout hanya membuka sesi yang dituju`; hanya soal sesi itu yang dimuat. Deadline attempt = `min(start_at sesi + cbt_duration_minutes, ends_at induk)` dan dikirim sebagai `effective_deadline_at`. Setelah `ends_at` induk, login/refresh ditolak 401 netral dan akses sesi aktif ditolak 410; sebelum itu peserta boleh keluar dan login lagi lewat tautan sesinya. Sesi `submitted` terkunci.

**Batasan UI CMS:** tidak ada kolom `Submission` pada tabel daftar tryout (tidak ada pengganti), tidak ada opsi `jadikan sesi aktif`, dan tidak ada kolom `Lembar` pada daftar. Fieldset pemilih lembar soal di form tetap dipertahankan untuk menyusun soal sesi. Log pelanggaran di laporan tersembunyi sampai `Lihat detail` diklik.

## Kontrak Fase 6v (ADR-018) — Filter dan Format Laporan Tryout

Fase 6v melanjutkan `REL-27`, gate `REL-28`, tanpa migrasi database dan tanpa Fase 7. Halaman `#/reports/tryout` difokuskan pada baca, filter, dan ekspor; pembuatan/aktivasi sesi tetap di halaman manajemen tryout.

### Daftar sesi untuk filter laporan

`GET /api/v1/tryout-sessions?search=<teks>&limit=<n>` — permission `tryout_reports.read`.

- `search` opsional, maksimal 128 karakter setelah trim. Pencarian memakai `ILIKE` partial (`%<teks>%`, case-insensitive) pada `tryout_events.name` (nama induk), `tryout_sessions.name` (nama sesi), `mapels.name`, dan `mapels.code`. Karakter backslash (`\`), `%`, dan `_` di-escape dengan backslash sebelum disusun menjadi pola. Kosong/null berarti tanpa filter.
- `limit` opsional, bilangan bulat positif, default `100`, maksimal `200`. Nilai bukan angka atau di luar rentang ditolak `400 VALIDATION_ERROR`.
- Sumber data: `tryout_sessions` di-join dengan `tryout_events`, `tryout_session_mapels`, dan `mapels`. Hasil diurutkan menurut `event_name`, lalu `id` sesi.
- `data.sessions[]` memuat `id`, `name`, `slug`, `session_date`, `is_active`, `submission_count`, `event_id`, `event_name`, `mapel_code`, dan `mapel_name`. `event_id` adalah `NOT NULL` dan `event_name` selalu terisi lewat join dengan induk `tryout_events`; `mapel_code`/`mapel_name` tetap boleh null bila mapel tidak tersedia. `submission_count` adalah jumlah baris `tryout_submissions`, bukan jumlah peserta.

### Ekspor XLSX dengan filter

`GET /api/v1/reports/tryout/export.xlsx?session_id=<id>&tryout_name=<teks>` — permission `tryout_reports.read` tidak diubah.

- `session_id` opsional (integer): membatasi ekspor pada satu sesi.
- `tryout_name` opsional, maksimal 128 karakter: `ILIKE` case-insensitive/partial terhadap `coalesce(tryout_events.name, tryout_sessions.name)`, dengan escape backslash/`%`/`_` yang sama seperti pada `search`. Bila `session_id` dan `tryout_name` keduanya diisi, keduanya digabung dengan `AND`.
- Kesalahan validasi mengembalikan `400 VALIDATION_ERROR`; tanpa keduanya, seluruh sesi diekspor.
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. `Content-Disposition: attachment; filename="laporan-tryout-<event_slug>-<session_slug>.xlsx"` bila salah satu filter dipakai dan slug tersedia, jika tidak `laporan-tryout-semua.xlsx`. Nama file dengan demikian mencerminkan filter aktif.

### Format file XLSX

Satu worksheet bernama `Laporan Tryout`:

- Baris 1: `HASIL TRYOUT <NAMA TRYOUT>` (huruf besar). Sejak ADR-019/Fase 6w, baris 2–3 tidak lagi memuat `NEW PRIMAGAMA YOGYAKARTA` atau tanggal berformat `id-ID` dari `event_starts_at`/`session_date`.
- Baris 6–7: header dua level. Kolom A–E digabung vertikal menjadi `NO`, `NAMA SISWA`, `USER`, `ASAL SEKOLAH`, `WAKTU`. Setiap mapel membentuk grup tiga kolom: baris 6 berisi nama mapel dinamis (huruf besar; dari `mapel_name` atau `mapel_code`, bukan hardcode), baris 7 berisi `B`, `S`, `NILAI`. Grup ditutup kolom gabungan `TOTAL`, `RATA-RATA`, dan `RANKING`.
- Data mulai baris 8, satu baris per peserta. `WAKTU` = `YYYY-MM-DD HH:mm:ss` zona Asia/Jakarta dari `max(submitted_at)` submission peserta dalam filter, atau `-` bila belum submit. Urutan: `TOTAL` menurun, lalu `NILAI` tiap mapel menurun sesuai urutan grup, lalu `WAKTU` menaik, lalu nama menurut locale `id-ID`. `NILAI = 100 × B / (B + S)` (2 desimal, `0` bila tanpa jawaban), `TOTAL` adalah jumlah `NILAI`, `RATA-RATA = TOTAL / jumlah grup mapel`, dan `RANKING` adalah posisi setelah pengurutan.
- Setelah satu baris kosong, catatan kaki: `KETERANGAN :`, `1. Nilai di atas adalah nilai MURNI HASIL TRYOUT`, `2. B = Jumlah benar, S = jumlah salah`, `3. Nilai diurutkan berdasar :`, `- Jumlah nilai`, `- Nilai <mapel>` untuk setiap grup, dan `- Waktu`. Statistik `MAKSIMAL`, `MINIMAL`, `RATA-RATA` per mapel ditulis pada kolom `NILAI` masing-masing. Baris tanda tangan `Yogyakarta, <tanggal id-ID>` dan `New Primagama Yogyakarta` sudah dihapus oleh ADR-019.
- File tidak memuat kunci jawaban atau pembahasan. Tabel di layar CMS tetap 7 kolom Fase 6u (`Nama`, `Sekolah`, `Mapel`, `Jumlah Soal`, `Benar`, `Salah`, `Nilai`); format XLSX ini belum dipakai untuk tampilan layar.

### Kompatibilitas

`POST /api/v1/tryout-sessions` dan `PATCH /api/v1/tryout-sessions/{id}/activate` tetap dipertahankan untuk klien lama. Payload `POST /api/v1/tryout-sessions` wajib membawa `event_id` yang valid (alias `eventId` diterima). Section **Buat Sesi Tryout** dan **Sesi Tersedia** beserta checkbox `Jadikan sesi aktif` dan tombol `Aktifkan` sudah dihapus dari halaman laporan; operasi tulis pindah ke manajemen tryout. Gate regresi `REL-24`–`REL-27` (401 netral, debounce violation, submit global per sesi, laporan 7 kolom, log tersembunyi) tidak boleh berubah.

## Kontrak Fase 6w (ADR-019) — Jenjang dan Kredensial Peserta

- Migrasi `031` menambah tabel `public.jenjang` dengan seed `SD`, `SMP`, `SMA` serta kolom `jenjang_id`/`username` pada `siswa` dan `prospektus` (view `tryout_participants` mengikuti). Jenjang dikelola lewat `GET`/`POST /api/v1/jenjangs`, `PUT`/`DELETE /api/v1/jenjangs/{id}` dengan permission `mapels.manage`; jenjang yang masih dipakai peserta tidak bisa dihapus.
- `jenjang_id` wajib saat membuat Siswa maupun Peserta Umum. `GET /api/v1/siswa`, `/participants`, dan `/prospektus` menerima filter opsional `jenjang_id`. `username` dibangkitkan otomatis dari kode jenjang, jam Asia/Jakarta, dan empat digit WA, lalu tampil di detail peserta/prospektus.
- PIN/WA divalidasi 8–15 digit setelah pembersihan karakter. Login participant memakai `username` dan `password`, dengan fallback `email`/`nama` untuk payload lama; menu CMS `tryout-agent` setelah login mengarah ke `#/mapels`.
- Ekspor XLSX laporan hanya membatasi tryout yang dipilih lewat dropdown/popup dan tidak memuat `NEW PRIMAGAMA YOGYAKARTA`, tanggal identitas, maupun baris tanda tangan. `WAKTU` memakai `YYYY-MM-DD HH:mm:ss` Asia/Jakarta dari submission terakhir.

## Kontrak Fase 6x (ADR-020) — Edit Tryout dan Ekspor Soal PDF

- `PATCH /api/v1/tryouts/{id}` dengan permission `tryouts.manage` hanya menerima `name`, `starts_at`, dan `ends_at`; `slug`/URL tidak berubah, sesi/mapel/peserta tidak diubah, lembar soal hanya dibaca, dan JWT peserta lama tetap valid. Endpoint tersedia untuk semua status turunan (`terjadwal`, `berlangsung`, `selesai`).
- `GET /api/v1/tryouts/{id}/questions.zip` memakai permission `tryouts.manage`; `GET /api/v1/tryouts/{id}/questions-with-keys.zip` memakai permission baru `tryout_questions.key_export` dari migrasi `032`. Keduanya mengembalikan satu `application/zip` per klik, berisi satu PDF per sesi tryout.
- PDF dibangkitkan internal oleh `backend-agent/src/tryoutExport.js` tanpa dependency baru. Setiap PDF memuat `nama lembar soal`, `kode lembar soal`, `mapel`, dan `keterangan`; varian kunci juga menyertakan kunci jawaban dari `question_options.is_correct`. File tidak pernah membocorkan kunci pada varian `questions.zip`.

## Kontrak Fase 6z (ADR-022) — Daftar Soal, Impor CSV/XLSX, dan Peserta Umum

- `GET /api/v1/questions` dan `GET /api/v1/questions/{id}` mengembalikan `usage_count` berupa jumlah lembar soal aktif yang memuat soal tersebut. Lembar terarsip atau dihapus tidak dihitung.
- `POST /api/v1/import` hanya menerima multipart `file` dengan ekstensi/MIME `.csv` atau `.xlsx`. Payload `content`, `questions[]`, JSON, TXT, dan MIME lain ditolak `400 VALIDATION_ERROR`. Parser memakai `exceljs` untuk XLSX dan normalisasi header yang sama untuk kedua format.
- Template unduhan tersedia dalam dua file valid: `templates/template-soal.csv` dan `templates/template-soal.xlsx`; keduanya berisi contoh `multiple_choice`, `multiple_answer`, `true_false`, dan `short_answer`.
- Endpoint daftar/detail `siswa`, `participants`, `prospektus`, dan `/tryouts/{id}/participants` yang dilindungi `tryouts.manage` menyertakan `username` berdampingan dengan `password_plain` atau `pin_plain`; UI menyediakan satu tombol copy yang ikut menyalin `nama`. Hash tidak pernah dikirim, kredensial tidak muncul di endpoint peserta/publik, dan user CMS tidak terpengaruh.
- Menu dan halaman CMS memakai label `Peserta Umum` pada `#/tryouts/peserta-umum`; rute lama `#/tryouts/prospektus` tetap menjadi alias redirect. Tidak ada migrasi database pada Fase 6z.

## Kontrak Fase 6ab — Antrean Review Soal Riset Agent

- `POST /api/v1/research-submissions` memakai permission `research_submissions.create` dan menyimpan draft berstatus `need_review` di `public.research_submissions`. Body mengikuti validasi soal yang sama dengan `POST /questions`, plus `external_ref`, `source_url`, dan `metadata` opsional. `external_ref` unik per `source_system='n8n'` sehingga pengiriman ulang ditolak `409`.
- `GET /research-submissions`, `GET /research-submissions/{id}`, `POST /{id}/approve`, dan `POST /{id}/reject` memakai permission `questions.review`. Approve membuat soal `approved` lewat `insertQuestion()` dalam satu transaksi lalu mengisi `question_id`; reject hanya mencatat keputusan dan tidak membuat soal.
- Draft tidak pernah ditulis ke `questions` sebelum approve, sehingga picker lembar soal dan presentation-service tidak perlu diubah.

## Kontrak Fase 6c — Konfigurasi Query Research Agent

- `GET /api/v1/research-query-config` memakai permission `research_queries.read` dan mengembalikan `queries` sebagai array, `mapel`, `jenjang`, `max_questions`, serta jejak `updated_by`/`updated_at`. Endpoint ini dipakai n8n dengan akun service `research_agent` yang sudah ada.
- `PUT /api/v1/research-query-config` memakai permission `research_queries.manage` (admin CMS). `queries` boleh array atau string yang dipisah `|`/baris baru; maksimal 10 query unik @300 karakter, total 4000 karakter. `mapel` dan `jenjang` divalidasi terhadap data aktif, `max_questions` 1–10.
- Konfigurasi disimpan sebagai baris singleton `research_query_config.id = 1`. Nilai `RESEARCH_QUERY`, `DEFAULT_MAPEL`, `DEFAULT_JENJANG`, dan `MAX_QUESTIONS` di `/etc/n8n.env` tetap dipakai hanya sebagai fallback bila endpoint CMS gagal dihubungi.

## Kontrak Fase 6d — Soft Limit Research Agent

- `POST /api/v1/research-agent-usage/start` memesan satu siklus bulan berjalan dan mengembalikan konfigurasi aktif. Permintaan ditolak lewat `allowed=false` bila `is_enabled=false` atau `runs >= max_runs_per_month`; permission yang dipakai `research_submissions.create`.
- `POST /api/v1/research-agent-usage/finish` menambah `searches` dan `questions` yang benar-benar terjadi ke ledger bulanan. `GET /api/v1/research-agent-usage` dipakai admin (`research_queries.manage`) untuk menampilkan sisa kuota di CMS.
- Batas efektif per siklus: `max_searches` (1–5), `max_results_per_query` (1–10), `max_questions` (1–10), dan `max_output_tokens` (300–4000) untuk request OpenAI. Ini melengkapi hard limit yang diatur di dashboard Tavily dan OpenAI.

## Jenis Soal

`question_type` yang didukung: `multiple_choice`, `true_false`, `multiple_answer`, `short_answer`, `essay`. Untuk `multiple_answer`, kirim `correct_keys` berisi minimal satu kunci opsi (boleh lebih dari satu), misalnya `["B"]` atau `["B", "D"]`; `correct_key` tetap diisi otomatis dengan kunci pertama untuk kompatibilitas lama. Kunci yang sama tidak boleh duplikat dan harus cocok dengan opsi yang tersedia. Importer CSV/XLSX juga menerima `Jawaban: B,D`.

Untuk `true_false`, kirim `statements: [{ "text": "...", "is_correct": true|false, "explanation": "..." }]` dengan 1–5 pernyataan; `stem`/`image_url` adalah cerita bersama. Tidak pakai `options`/`correct_keys`. Semua pernyataan benar membuat soal bernilai benar. Endpoint peserta tidak mengirim `is_correct`; submit memakai `answers: [{ "statement_id": 123, "value": true|false }]`. Laporan tryout menyertakan `statement_details` per submission.

Mode CBT (ADR-013) diaktifkan per tryout lewat `POST /api/v1/tryouts` atau `PATCH /api/v1/tryouts/{id}/cbt` dengan `cbt_enabled`, `cbt_duration_minutes` (1–600, wajib saat aktif), `cbt_shuffle_questions`, `cbt_shuffle_options`, `cbt_require_fullscreen`, dan `cbt_max_violations` (0–100). `GET /api/v1/tryouts` dan `GET /api/v1/tryouts/{id}` mengembalikan pengaturan tersebut. `GET /api/v1/reports/tryout` kini juga mengembalikan `attempts` (dari `v_cbt_attempt_report`) dan `violations`; keduanya hanya untuk admin. Endpoint penyajian peserta tidak pernah mengembalikan skor atau kunci.

## Aturan Implementasi

- Kontrak API ditulis di `openapi/` sebelum endpoint diimplementasikan.
- Semua query memakai parameterized statement; dilarang concat SQL.
- Pool koneksi maksimal 5, `statement_timeout` 5 detik.
- Upload maksimal 5MB, whitelist MIME, nama file disanitasi, path relatif.
- Error envelope: `{ ok: false, error: { code, message, status } }`.
- Kunci jawaban harus konsisten dengan `question_options.is_correct`; untuk multi-jawaban, semua `correct_keys` ditandai benar.
- Simpan kredensial di `.env` mode 600; jangan commit secret.

## Kontrak Fase 6j (ADR-004)

- Soal baru manual/import langsung `approved`; `draft` dan `review` ditolak, migrasi `015` merapikan data lama.
- Tanpa parameter `version`/`ready_version` dan tanpa field `readiness` pada respons; endpoint versi/readiness/varian mengembalikan 404.
- Daftar soal memakai `page`/`limit=20` dengan `pagination: { page, limit, total }`; stem tidak ditebalkan.
- Sumber konten penyajian: `questions` + `question_options` + `answer_keys`, bukan varian/readiness.

## Task Fase 3

Lihat `docs/phase3-tasks.md` rentang `BE-01` sampai `BE-09` (arsip Fase 3).
