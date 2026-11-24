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

Fase 6t (ADR-016): satu tryout dapat memuat 1–10 mapel aktif yang unik. `POST /api/v1/tryouts` menerima `mapel_codes: ["MTKA", "IPAS"]`; field lama `mapel_code` tetap diterima sebagai satu elemen dan harus sama bila keduanya dikirim. Relasi tersimpan di tabel `public.tryout_session_mapels(session_id, mapel_id)` (PK gabungan, FK cascade) yang di-backfill oleh migrasi `db/migrations/029_tryout_multi_mapel.sql`. Kolom lama `tryout_sessions.mapel_id` hanya untuk kompatibilitas pembacaan dan diisi mapel pertama. `GET /api/v1/tryouts` dan `GET /api/v1/tryouts/{id}` mengembalikan `mapels: [{ id, code, name }]` (urutan kode) beserta `mapel_id`, `mapel_code`, `mapel_name` legacy. `tryout_count` pada `GET /api/v1/mapels` dihitung dari junction. `sheet_ids` harus berasal dari mapel terpilih; soal yang dikirim langsung lewat `question_ids` harus `approved`.

## Hak Akses

`GET /api/v1/permissions` mengembalikan 46 permission aktif dari tabel `permissions`. Permission `*.manage` lama tetap menjadi guard endpoint existing; permission CRUD baru (`questions.*`, `question_sheets.*`, `tryouts.*`, `participants.*`, `mapels.*`, `roles.*`, `users.*`, `program_belajar.*`) dipakai UI Kelola Role dan tidak mengubah kontrak guard lama. `admin` memiliki seluruh permission; `editor` memiliki CRUD soal, lembar soal, dan program belajar; `validator`, `viewer`, dan `peserta` tidak berubah.

## Peserta Tryout

Saat membuat peserta Siswa (`jenis='siswa'`), `password` opsional. Jika kosong, sistem memakai default `nama depan@mmyy` (misalnya `Budi@1126`). Password dapat diganti saat pendaftaran maupun lewat reset; minimal 6 karakter.

Peserta Umum (`jenis='umum'`) dibuat dengan `nama`, `sekolah`, `wa_orang_tua`, dan `pin` 9 digit. Login memakai `username = nama` dan `password = pin` dengan verifikasi `pin_hash` scrypt; PIN plaintext juga tersimpan di `pin_plain` untuk ditampilkan di endpoint detail. Nama Umum unik tanpa memperhatikan huruf besar/kecil. Payload lama Siswa dan endpoint lama `/tryout-sessions` tetap diterima.

Fase 6p (ADR-008) menambahkan `DELETE /api/v1/tryouts/{id}/participants/{participantId}` untuk mengeluarkan peserta dari sebuah tryout. Peserta Siswa hanya kehilangan relasi `tryout_session_participants`; data siswa tidak diubah. Peserta Umum yang dikeluarkan mengalami hal yang sama dan ditandai `prospek=true`, `prospek_at` terisi, `is_active=false`, serta sesinya dicabut. Data tersebut muncul di `GET /api/v1/prospektus`. Untuk daftar peserta pada form tryout yang belum disimpan, `POST /api/v1/participants/{id}/prospek` melakukan hal yang sama tanpa memerlukan ID tryout; Siswa ditolak dengan `400`. Endpoint lama `DELETE /participants/{id}` tetap berarti nonaktifkan peserta secara global dan tidak dipakai untuk aksi tryout.

Fase 6q (ADR-009) menambahkan `POST /api/v1/tryouts/{id}/participants` dengan payload `{ "participant_ids": [1, 2] }` untuk melampirkan peserta yang sudah ada ke tryout tersimpan dari popup **Kelola Peserta**. Endpoint memakai `tryouts.manage`, menolak peserta nonaktif/prospek, dan melewati relasi yang sudah ada sehingga aman dipanggil ulang. Respons memuat `added_ids` serta daftar `participant_ids` terbaru. Tidak ada perubahan skema pada Fase 6q.

Fase 6r (ADR-010) memindahkan seluruh Peserta Umum ke `public.prospektus` dan mengganti nama tabel lama menjadi `public.siswa`; view `tryout_participants` tetap tersedia untuk kompatibilitas. Endpoint `GET /api/v1/participants/{id}/detail` menampilkan `password_plain`/`pin_plain`, `GET /api/v1/prospektus/{id}` menampilkan detail prospektus, dan `POST /api/v1/prospektus/{id}/daftar` menyalin prospektus ke `siswa` lalu menandai `bergabung=true`. Password user CMS di `contributors.password_hash` tetap scrypt dan tidak pernah dikembalikan oleh API.

Fase 6s (ADR-011): `POST /api/v1/auth/login` untuk Siswa/Peserta Umum wajib mengirim `tryout_slug` dari URL `/{slug}` dan akun harus terdaftar di tryout tersebut. Sesi dan JWT participant menyimpan `tryout_session_id`/`tryout_slug`; daftar soal serta submission dibatasi pada tryout yang terikat. `GET /api/v1/siswa` hanya mengembalikan `public.siswa`, `GET /api/v1/tryouts/{id}/participants` hanya peserta tryout, dan konversi prospektus tetap lewat `POST /api/v1/prospektus/{id}/daftar` yang dipicu eksplisit dari halaman Prospektus.

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
