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

Seed awal: `MTKA`, `BIND`, `IPAS`. Kode mapel unik tepat 4 karakter `^[A-Z0-9]{4}$` dan langsung dipakai sebagai prefix kode lembar soal `LS-<KODE_MAPEL>-mmyy`. Endpoint CRUD memakai permission `mapels.manage` (default admin).

Fase 6t (ADR-016, histori): satu tryout dapat memuat 1–10 mapel aktif yang unik. `POST /api/v1/tryouts` menerima `mapel_codes: ["MTKA", "IPAS"]`; field lama `mapel_code` tetap diterima sebagai satu elemen dan harus sama bila keduanya dikirim. Relasi tersimpan di tabel `public.tryout_session_mapels(session_id, mapel_id)` (PK gabungan, FK cascade) yang di-backfill oleh migrasi `db/migrations/029_tryout_multi_mapel.sql`. Kolom lama `tryout_sessions.mapel_id` hanya untuk kompatibilitas pembacaan dan diisi mapel pertama. `GET /api/v1/tryouts` dan `GET /api/v1/tryouts/{id}` mengembalikan `mapels: [{ id, code, name }]` (urutan kode) beserta `mapel_id`, `mapel_code`, `mapel_name` legacy. `tryout_count` pada `GET /api/v1/mapels` dihitung dari junction. `sheet_ids` harus berasal dari mapel terpilih; soal yang dikirim langsung lewat `question_ids` harus `approved`. Untuk data baru aturan "satu tryout banyak mapel" digantikan ADR-017: payload flat tetap dipecah menjadi satu sesi per mapel.

## Hak Akses

`GET /api/v1/permissions` mengembalikan 46 permission aktif dari tabel `permissions`. Permission `*.manage` lama tetap menjadi guard endpoint existing; permission CRUD baru (`questions.*`, `question_sheets.*`, `tryouts.*`, `participants.*`, `mapels.*`, `roles.*`, `users.*`, `program_belajar.*`) dipakai UI Kelola Role dan tidak mengubah kontrak guard lama. `admin` memiliki seluruh permission; `editor` memiliki CRUD soal, lembar soal, dan program belajar; `validator`, `viewer`, dan `peserta` tidak berubah.

## Peserta Tryout

Saat membuat peserta Siswa (`jenis='siswa'`), `password` opsional. Jika kosong, sistem memakai default `nama depan@mmyy` (misalnya `Budi@1126`). Password dapat diganti saat pendaftaran maupun lewat reset; minimal 6 karakter.

Peserta Umum (`jenis='umum'`) dibuat dengan `nama`, `sekolah`, `wa_orang_tua`, dan `pin` 9 digit. Login memakai `username = nama` dan `password = pin` dengan verifikasi `pin_hash` scrypt; PIN plaintext juga tersimpan di `pin_plain` untuk ditampilkan di endpoint detail. Nama Umum unik tanpa memperhatikan huruf besar/kecil. Payload lama Siswa dan endpoint lama `/tryout-sessions` tetap diterima.

Fase 6p (ADR-008) menambahkan `DELETE /api/v1/tryouts/{id}/participants/{participantId}` untuk mengeluarkan peserta dari sebuah tryout. Peserta Siswa hanya kehilangan relasi `tryout_session_participants`; data siswa tidak diubah. Peserta Umum yang dikeluarkan mengalami hal yang sama dan ditandai `prospek=true`, `prospek_at` terisi, `is_active=false`, serta sesinya dicabut. Data tersebut muncul di `GET /api/v1/prospektus`. Untuk daftar peserta pada form tryout yang belum disimpan, `POST /api/v1/participants/{id}/prospek` melakukan hal yang sama tanpa memerlukan ID tryout; Siswa ditolak dengan `400`. Endpoint lama `DELETE /participants/{id}` tetap berarti nonaktifkan peserta secara global dan tidak dipakai untuk aksi tryout.

Fase 6q (ADR-009) menambahkan `POST /api/v1/tryouts/{id}/participants` dengan payload `{ "participant_ids": [1, 2] }` untuk melampirkan peserta yang sudah ada ke tryout tersimpan dari popup **Kelola Peserta**. Endpoint memakai `tryouts.manage`, menolak peserta nonaktif/prospek, dan melewati relasi yang sudah ada sehingga aman dipanggil ulang. Respons memuat `added_ids` serta daftar `participant_ids` terbaru. Tidak ada perubahan skema pada Fase 6q.

Fase 6r (ADR-010) memindahkan seluruh Peserta Umum ke `public.prospektus` dan mengganti nama tabel lama menjadi `public.siswa`; view `tryout_participants` tetap tersedia untuk kompatibilitas. Endpoint `GET /api/v1/participants/{id}/detail` menampilkan `password_plain`/`pin_plain`, `GET /api/v1/prospektus/{id}` menampilkan detail prospektus, dan `POST /api/v1/prospektus/{id}/daftar` menyalin prospektus ke `siswa` lalu menandai `bergabung=true`. Password user CMS di `contributors.password_hash` tetap scrypt dan tidak pernah dikembalikan oleh API.

Fase 6s (ADR-011): `POST /api/v1/auth/login` untuk Siswa/Peserta Umum wajib mengirim `tryout_slug` dari URL `/{slug}` dan akun harus terdaftar di tryout tersebut. Sesi dan JWT participant menyimpan `tryout_session_id`/`tryout_slug`; daftar soal serta submission dibatasi pada tryout yang terikat. `GET /api/v1/siswa` hanya mengembalikan `public.siswa`, `GET /api/v1/tryouts/{id}/participants` hanya peserta tryout, dan konversi prospektus tetap lewat `POST /api/v1/prospektus/{id}/daftar` yang dipicu eksplisit dari halaman Prospektus.

## Kontrak Fase 6u (ADR-017)

`tryout_events` adalah induk dari banyak `tryout_sessions` lewat `tryout_sessions.event_id` (FK cascade, migrasi `030`). Satu sesi tepat satu mapel karena `tryout_session_mapels` dibatasi `UNIQUE(session_id)`; kolom `tryout_sessions.mapel_id` hanya mirror legacy. `status` (`terjadwal`/`berlangsung`/`selesai`) adalah field turunan server dari `starts_at`/`ends_at`, **bukan kolom fisik**, dan tidak mengubah `is_active`.

**`POST /api/v1/tryouts`** membuat induk plus banyak sesi:

```json
{
  "name": "Tryout Contoh",
  "slug": "tryout-contoh",
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

- Tiap elemen `sessions[]` memuat tepat satu `mapel_code` (wajib), `sheet_ids` opsional atau `question_ids` untuk kompatibilitas, `name?`, `start_at?`/`end_at?` dalam rentang induk, serta `cbt_enabled`, `cbt_duration_minutes` (1–600 saat CBT), `cbt_shuffle_questions`, `cbt_shuffle_options`, `cbt_require_fullscreen`, dan `cbt_max_violations` (0–100) **per sesi**. `mapel_codes[]` di dalam sesi ditolak; mapel duplikat antarsesi ditolak; maksimal 20 sesi; `sheet_ids` harus ber-mapel sama dengan sesinya.
- Payload flat legacy tetap diterima dan dipecah per mapel: `{ "name", "slug?", "starts_at", "ends_at" | "session_date", "mapel_codes" | "mapel_code", "sheet_ids" | "question_ids", "participant_ids?", "cbt_*" }`. `mapel_code` yang berbeda dari `mapel_codes` ditolak. Respons `201` memuat `data.tryout` dengan `event_id` dan `sessions[]`.

**`GET /api/v1/tryouts`** mengembalikan satu baris per induk: `event_id`, `name`, `slug`, `starts_at`, `ends_at`, `status`, dan `sessions[]`. Field kompatibilitas `mapels[]` (agregat mapel sesi), `mapel_code`/`mapel_id`/`mapel_name` (mapel pertama), `start_at`/`end_at`, `session_id`, dan `submission_count` tetap ada. `submission_count` hanya untuk kebutuhan API/laporan/internal. **`GET /api/v1/tryouts/:id`** menerima `event_id` maupun `session_id` lama dan mengembalikan bentuk yang sama; **`GET /api/v1/tryouts/:id/sessions`** mengembalikan `{ tryout_event_id, sessions[] }`. Slug induk dipakai untuk URL undangan/login; slug sesi lama tetap diterima fallback, dan JWT/sesi menyimpan `tryout_event_id`.

**Picker peserta:** `GET /api/v1/participants?search=`, `GET /api/v1/siswa?search=`, dan `GET /api/v1/prospektus?search=` mencari nama, email, kelas, dan sekolah (case-insensitive). Dialog Peserta Umum menampilkan siswa aktif dan prospektus aktif; ID prospektus aktif boleh dilampirkan langsung, sedangkan yang `bergabung=true` dipetakan ke ID `siswa` hasil konversi agar tidak duplikat. Guard hanya menolak peserta `is_active=false`.

**Ekspor:** `GET /api/v1/reports/tryout/export.xlsx?session_id=...` memakai permission `tryout_reports.read` dan `exceljs`. File `.xlsx` berisi `Jenis | Nama | Sekolah | Kelas | Mapel | Jumlah Soal | Benar | Salah | Nilai | Status`, termasuk peserta yang belum submit, tanpa kunci jawaban/pembahasan, dan tanpa pemotongan `LIMIT 500` (paginasi 500 per batch).

**Presentation-service (`:8083`):** `GET /api/v1/presentation/sessions` mengembalikan daftar sesi milik peserta (`id`, `tryout_event_id`, `name`, `slug`, `mapel_code`, `status`, jadwal, pengaturan CBT, `completed`/`submitted`). Endpoint soal, submit-all, dan CBT menerima `session_id`; hanya soal sesi itu yang dimuat. Deadline attempt = `min(start_at sesi + cbt_duration_minutes, ends_at induk)` dan dikirim sebagai `effective_deadline_at`. Setelah `ends_at` induk, login/refresh ditolak 401 netral dan akses sesi aktif ditolak 410; sebelum itu peserta boleh keluar dan login lagi serta melanjutkan sesi berikutnya. Sesi `submitted` terkunci.

**Batasan UI CMS:** tidak ada kolom `Submission` pada tabel daftar tryout (tidak ada pengganti), tidak ada opsi `jadikan sesi aktif`, dan tidak ada kolom `Lembar` pada daftar. Fieldset pemilih lembar soal di form tetap dipertahankan untuk menyusun soal sesi. Log pelanggaran di laporan tersembunyi sampai `Lihat detail` diklik.

## Jenis Soal

`question_type` yang didukung: `multiple_choice`, `true_false`, `multiple_answer`, `short_answer`, `essay`. Untuk `multiple_answer`, kirim `correct_keys` berisi minimal satu kunci opsi (boleh lebih dari satu), misalnya `["B"]` atau `["B", "D"]`; `correct_key` tetap diisi otomatis dengan kunci pertama untuk kompatibilitas lama. Kunci yang sama tidak boleh duplikat dan harus cocok dengan opsi yang tersedia. Importer CSV/TXT juga menerima `Jawaban: B,D`.

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
