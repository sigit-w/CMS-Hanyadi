# Database — Bank Soal

## Penerapan

Skema ditujukan untuk database `bank_soal_db` dengan user `bank_soal_user` pada PostgreSQL 16 lokal.

Sumber kebenaran skema aktif adalah rangkaian `db/migrations/` yang dijalankan berurutan sampai `030`. `db/schema.sql` adalah arsip Fase 3 yang sudah stale dan **bukan** sumber kebenaran untuk struktur saat ini.

Inisialisasi baseline arsip Fase 3 (opsional, bukan langkah untuk mendapatkan skema aktif):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/schema.sql
```

Migrasi Fase 5 (tabel variasi penyajian — data historis nonaktif sejak Fase 6j/ADR-004, tetap dipertahankan untuk rollback):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/002_presentation_variants.sql
```

Backfill variasi historis untuk soal yang dulu ditandai ready (tidak dipakai kontrak Fase 6j):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/003_backfill_missing_variants.sql
```

Permission ubah password untuk RBAC (idempotent):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/005_user_password_permission.sql
```

Permission melihat laporan kondisi sistem (idempotent, default hanya role `admin`):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/006_system_report_permission.sql
```

Gambar soal dan penilaian tryout sisi server (idempotent):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
     -f /opt/virtual-office-bank-soal/db/migrations/007_question_images_and_server_grading.sql
```

Sesi tryout dan permission laporan hasil (idempotent):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/008_tryout_sessions_and_report_permission.sql
```

Manajemen tryout (mapel, soal, peserta, permission `tryouts.manage`; idempotent):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/009_tryout_management.sql
```

Peserta tryout terpisah dari user CMS, tidak memakai role `peserta` lagi (idempotent):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
   -f /opt/virtual-office-bank-soal/db/migrations/010_tryout_participants.sql
```

Tambahan data identitas peserta (`kelas` bilangan bulat 1–100, `sekolah` maksimal 255 karakter; baris lama memakai default `0` dan `''`) (idempotent):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/011_participant_class_school.sql
```

Ubah nama kategori menjadi mapel pada tabel dan field terkait (idempotent):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/012_rename_category_to_mapel.sql
```

Longgarkan kode mapel agar bisa ditambah lewat CRUD dan tambah permission `mapels.manage` (idempotent):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/013_mapel_crud.sql
```

Tambah dukungan soal pilihan ganda multi-jawaban pada variasi penyajian dan relaksasi CHECK tipe soal (idempotent):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
   -f /opt/virtual-office-bank-soal/db/migrations/014_multiple_answer.sql
```

Penyederhanaan status soal Fase 6j (ADR-004): `draft`/`review` menjadi `approved`, default kolom `approved`, CHECK menjadi `('approved','rejected','archived')`. Jalankan sebelum restart service:

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/015_simplify_question_status.sql
```

Lembar Soal Fase 6l (ADR-005): tabel `question_sheets`/`question_sheet_questions`, kode 12 karakter, waktu angka bebas, dan permission `question_sheets.manage` untuk `admin` dan `editor` (idempotent):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/016_lembar_soal.sql
```

Kode mapel 4 karakter (amendemen D6): ubah kode existing menjadi `MTKA/BIND/IPAS`, ganti constraint menjadi `^[A-Z0-9]{4}$` (idempotent):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/017_mapel_code_4_char.sql
```

Program belajar (tabel `program_belajar` dan `program_belajar_schedules`, permission `program_belajar.manage`, idempotent):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/018_program_belajar.sql
```

Field peserta/siswa: program belajar dan nomor WA orang tua (idempotent, dijalankan setelah `018`):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/019_participant_program_wa.sql
```

Peserta Umum dengan Nama + PIN (Fase 6o/ADR-007; idempotent, dijalankan setelah `019`):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/020_peserta_umum.sql
```

Jadwal mulai/selesai dan relasi tryout–lembar soal (Fase 6o/ADR-007; idempotent, dijalankan setelah `016` dan `020`):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/021_tryout_jadwal_lembar.sql
```

Perbaikan `password_hash` nullable untuk database yang sudah menjalankan `020` (Fase 6o/ADR-007; idempotent, dijalankan setelah `021`):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/022_participant_password_nullable.sql
```

Status Prospektus untuk Peserta Umum yang dikeluarkan dari tryout (Fase 6p/ADR-008; idempotent, dijalankan setelah `022`):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/023_prospektus_peserta_umum.sql
```

Tabel fisik `siswa`, `prospektus`, kredensial peserta, dan view kompatibilitas (Fase 6r/ADR-010; idempotent, dijalankan setelah `023`; backup wajib lebih dulu):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
   -f /opt/virtual-office-bank-soal/db/migrations/024_siswa_prospektus_kredensial.sql
```

Marker URL tryout unik, binding login participant, dan rollback konversi Fase 6r (Fase 6s/ADR-011; idempotent, backup wajib lebih dulu):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/025_tryout_slug_login_scope.sql
```

Pernyataan Benar/Salah ganda pada satu soal (ADR-012; idempotent, backup wajib lebih dulu):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/026_true_false_statements.sql
```

Mode CBT lengkap per tryout (ADR-013; idempotent, backup wajib lebih dulu):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/027_cbt_exam_mode.sql
```

Opsi CRUD RBAC (ADR-014; idempotent, dijalankan setelah `027`):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -1 -f /opt/virtual-office-bank-soal/db/migrations/028_crud_permissions.sql
```

Tryout multi-mapel (ADR-016; idempotent, dijalankan setelah `028`, backup wajib lebih dulu):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
   -f /opt/virtual-office-bank-soal/db/migrations/029_tryout_multi_mapel.sql
```

Induk tryout, satu sesi satu mapel, dan gate batas akhir (Fase 6u/ADR-017; idempotent, dijalankan setelah `029`, backup wajib lebih dulu):

```bash
PGPASSWORD='<password>' psql -h 127.0.0.1 -p 5432 \
  -U bank_soal_user -d bank_soal_db \
  -f /opt/virtual-office-bank-soal/db/migrations/030_tryout_events_and_sessions.sql
```

`030` membuat tabel induk `public.tryout_events` (`id`, `name`, `slug` unik, `starts_at`, `ends_at`, timestamp) dan menambah kolom `tryout_sessions.event_id` NOT NULL dengan FK `ON DELETE CASCADE` plus index. Backfill awal bersifat **1 induk : 1 sesi** memakai `slug` sesi existing (dengan fallback slug unik berbasis ID) agar slug login, JWT, dan seluruh FK `session_id` lama tetap valid. `auth_sessions.tryout_event_id` juga di-backfill dari sesi yang terikat.

Sesi lama multi-mapel hasil ADR-016 dipecah menjadi beberapa sesi anak: satu mapel dipertahankan di sesi asal, mapel lainnya dipindah ke sesi baru. Lembar, soal, peserta, submission, attempt, draft, flag, dan log pelanggaran dipindah/diduplikasi sesuai mapel; baris `tryout_submissions` tidak dihapus. Setelah tidak ada sesi multi-mapel, diterapkan `UNIQUE(session_id)` pada `tryout_session_mapels` (`uq_tryout_session_mapels_session`), menggantikan aturan many-to-many ADR-016 untuk data baru.

`status` tryout tidak disimpan sebagai kolom fisik. Migrasi membuat helper `tryout_event_status(bigint)` (`terjadwal`/`berlangsung`/`selesai` dari `starts_at`/`ends_at`), `tryout_event_is_open(bigint)` (`now() <= ends_at`), dan view `v_tryout_events` yang menambahkan `status` pada baris induk. `is_active` tidak diubah oleh fungsi tersebut. Deadline efektif attempt dihitung aplikasi sebagai `min(start_at sesi + cbt_duration_minutes, ends_at induk)`.

Backup pra-migrasi wajib dibuat sebelum `030`; rollback ke keadaan `REL-26` memakai dump tersebut, misalnya `pg_restore --clean --if-exists -h 127.0.0.1 -U bank_soal_user -d bank_soal_db /tmp/opencode/bank_soal_db-pre030-2026-11-24.dump`. Setelah restore, jalankan ulang `029` bila dump diambil sebelum migrasi itu. `REL-01…REL-26` tidak dibuka ulang; gate berikutnya adalah `REL-27`.

Kredensial tersimpan di

 `/etc/postgresql/bank_soal_db.credentials` (mode 600). Gunakan variabel lingkungan, jangan menuliskan password di perintah yang terekam di history.

Verifikasi cepat:

```bash
psql -h 127.0.0.1 -U bank_soal_user -d bank_soal_db \
  -tAc "SELECT code FROM mapels ORDER BY id;"
psql -h 127.0.0.1 -U bank_soal_user -d bank_soal_db \
  -tAc "SELECT count(*) FROM v_question_catalog;"
```

## Isi Awal

- `mapels`: `MTKA`, `BIND`, `IPAS` (wajib; kode unik tepat 4 karakter `^[A-Z0-9]{4}$`).
- `source_types`: `manual`, `file_upload`, `external_collection`.
- `presentation_versions`: `v1`, `v2`, `v3` (data historis, nonaktif di UI/API sejak Fase 6j).
- `question_presentation_variants`: satu baris per `(question_id, version_id)` dari migrasi awal Fase 5; kini nonaktif — konten dibaca dari `questions`, `question_options`, dan `answer_keys`.

Seluruh `INSERT` memakai `ON CONFLICT DO NOTHING`, sehingga aman dijalankan ulang.

## Catatan Integritas

- `question_options.is_correct` menandai semua opsi benar; `answer_keys.correct_option_id` menunjuk opsi benar pertama agar tetap kompatibel dengan kunci tunggal. QA memeriksa konsistensi ini di task `QA-04`.
- Soal berstatus `approved` wajib memiliki kunci jawaban: `correct_option_id` terisi untuk pilihan ganda/multi-jawaban, atau `answer_text` untuk esai/short answer. Soal `multiple_answer` wajib memiliki minimal satu opsi benar.
- Untuk `question_type='true_false'`, sumber konten/kunci adalah `question_statements`, bukan `question_options`/`answer_keys`. Satu soal wajib memiliki 1–5 pernyataan dengan `position` unik; semua pernyataan benar membuat soal bernilai benar (all-or-nothing). `questions.stem`/`image_url` tetap menjadi cerita atau konteks bersama.
- `submission_statement_answers` menyimpan jawaban dan status benar/salah per pernyataan untuk audit laporan; skor rekap tetap satu baris `tryout_submissions` = satu soal.
- Status kanonik soal adalah `approved`; `draft` dan `review` dihapus oleh migrasi `015`. Soal baru (manual/import) otomatis `approved`, dengan `rejected` dan `archived` sebagai status penunjang.
- `question_version_readiness`, `questions.is_multi_version_ready`, `presentation_versions`, dan `question_presentation_variants` adalah data historis nonaktif (ADR-004). Endpoint readiness, versi, dan varian tidak lagi diekspos (404).
- Endpoint penyajian (`bank-soal-presentation.service` `:8083`) membaca `questions` + `question_options` + `answer_keys`, atau `questions` + `question_statements` untuk `true_false`; hanya soal `approved` dan bukan `archived` yang tampil di tryout. `is_correct` pernyataan tidak pernah dikirim ke peserta.
- `question_sources.storage_path` disimpan relatif terhadap direktori upload aplikasi, bukan path absolut.
- `questions.image_url` dan `question_presentation_variants.image_url` menyimpan URL relatif `/api/v1/uploads/<nama_file>`; file fisik berada di `UPLOAD_DIR` (default direktori `uploads/` backend).
- `tryout_submissions` menyimpan satu baris per `(user_id, question_id, version)` dan memiliki `session_id` ke `tryout_sessions`; kolom `version` tetap diisi konstan `'v1'` secara internal untuk kompatibilitas histori (ADR-004). Skor rekap dihitung dari tabel ini, bukan dari state browser. Endpoint penyajian tidak mengirim `correct_key`, `correct_keys`, `answer_text`, `is_correct`, `correct`, atau `explanation` ke peserta.
- `tryout_sessions` menyimpan `name`, `slug`, `session_date`, `start_at`, `end_at`, dan `mapel_id`; `slug` unik maksimal 32 karakter menjadi penanda URL `https://tryout.hanyadi.web.id/{slug}`. `start_at`/`end_at` memakai `TIMESTAMPTZ` zona `Asia/Jakarta`, `end_at > start_at`, dan `session_date` tetap diturunkan dari `start_at` untuk kompatibilitas laporan. Hanya satu sesi yang boleh aktif. Submission participant memakai `tryout_session_id` dari sesi login, bukan sesi aktif global. Permission `tryout_reports.read` mengontrol halaman laporan yang menampilkan perbandingan jawaban dan kunci.
- `tryout_session_sheets` menyimpan lembar soal yang dipakai sebuah TO; `tryout_session_questions` tetap diisi dengan turunan soal lembar tersebut agar presentation service tidak berubah. `tryout_session_participants` boleh kosong. Bila sesi aktif memiliki baris soal, daftar soal dan submission dibatasi sesuai daftar; sesi lama tanpa baris tetap memakai perilaku sebelumnya. Permission `tryouts.manage` mengontrol pembuatan TO dan CRUD peserta di CMS.
- Fase 6t (ADR-016, histori): `tryout_session_mapels` menyimpan relasi sesi–mapel dengan PK `(session_id, mapel_id)`, sehingga satu tryout boleh memuat misalnya MTKA + IPAS tetapi tidak dua mapel sama. Kolom lama `tryout_sessions.mapel_id` tetap ada untuk kompatibilitas pembacaan dan diisi mapel pertama; penulisan/validasi memakai junction. Untuk data baru aturan ini digantikan ADR-017 oleh `030`. `POST /api/v1/tryouts` masih menerima payload flat `mapel_codes[]` legacy dan memecahnya per sesi; response menyertakan `mapels[]` plus field legacy `mapel_code`. Endpoint presentasi `POST /api/v1/presentation/attempts/submit-all` menulis seluruh jawaban non-CBT dalam satu transaksi per sesi tanpa mengembalikan skor.
- Fase 6u (ADR-017): `tryout_events` adalah induk dari banyak `tryout_sessions`; `tryout_sessions.event_id` wajib terisi dan FK cascade. `tryout_session_mapels` memiliki `UNIQUE(session_id)` sehingga satu sesi tepat satu mapel; `tryout_sessions.mapel_id` hanya mirror legacy. `cbt_duration_minutes` berlaku per sesi dan deadline attempt dipotong oleh `ends_at` induk. `status` hanya turunan API/helper/view, bukan kolom fisik, dan `is_active` tidak berubah karena waktu. `GET /api/v1/tryouts` mengembalikan `event_id`, `status`, dan `sessions[]`; `submission_count` tetap ada di API walaupun kolom `Submission` dihapus dari daftar CMS. `GET /api/v1/reports/tryout/export.xlsx` memakai permission `tryout_reports.read`, menyertakan peserta tanpa submission, dan tidak memuat kunci jawaban.
- `siswa` menyimpan peserta dengan `jenis='siswa'`, `email` + `password_hash` + `password_plain` + `kelas`, login dengan email/password. `prospektus` menyimpan Peserta Umum dengan struktur kolom identik ditambah `bergabung`/`bergabung_at`; login dengan Nama + PIN (`pin_hash` scrypt, `pin_plain`), `email NULL`, `kelas=0`, WA wajib. Nama Umum unik case-insensitive. `tryout_participants` kini view `UNION ALL` kedua tabel untuk kompatibilitas query lama; seluruh penulisan langsung ke tabel fisik. Role `peserta` dinonaktifkan dan tidak tersedia lagi di halaman Buat User.
- Fase 6r (ADR-010): kredensial peserta boleh disimpan plaintext di `password_plain`/`pin_plain` dan hanya dikembalikan lewat endpoint detail; password user CMS tetap scrypt di `contributors.password_hash` dan tidak pernah ditampilkan. `POST /prospektus/{id}/daftar` menyalin data ke `siswa` dan menandai `bergabung=true` tanpa mencabut akun Umum. FK `participant_id` diganti trigger validasi/cascade karena satu kolom mereferensi dua tabel.
- Fase 6s (ADR-011): login participant wajib `tryout_slug` dan akun harus terdaftar di `tryout_session_participants`. `auth_sessions.tryout_session_id` mengikat access token/refresh token ke satu tryout; JWT memuat `tryout_session_id` dan `tryout_slug`. Endpoint `/api/v1/siswa` hanya membaca `public.siswa`, sedangkan `/api/v1/tryouts/{id}/participants` hanya peserta yang terlampir. Konversi `prospektus -> siswa` tetap eksplisit lewat tombol **Daftarkan Siswa** di Prospektus, bukan otomatis dari tryout.
- Fase 6p (ADR-008) menambahkan `prospek` dan `prospek_at`.
 Hanya Peserta Umum yang boleh ber-`prospek=true`. Mengeluarkan Umum dari tryout menandai barisnya sebagai prospek, menonaktifkannya, dan mencabut sesinya; data tetap dipakai halaman Prospektus dan histori submission. Mengeluarkan Siswa hanya menghapus baris `tryout_session_participants`, bukan data siswa.
- `tryout_submissions` dan `auth_sessions` memakai `participant_id` untuk akun peserta dan `user_id` untuk akun CMS; tepat salah satu yang terisi. Baris lama milik user ber-role `peserta` sudah dipindahkan ke `participant_id` oleh migrasi `010`.
- Daftar soal CMS memakai pagination server-side dengan `page` dan `limit` default 20; respons menyertakan `pagination: { page, limit, total }` (ADR-004).
- `question_sheets` menyimpan satu lembar soal dengan tepat satu `mapel_id`, kode unik 12 karakter termasuk tanda hubung, `duration_minutes` positif, dan flag `archived` untuk soft delete. Kode generator = `LS-<KODE_MAPEL>-mmyy`, misalnya `LS-MTKA-mmyy`; kode mapel berasal langsung dari `mapels.code` tanpa pemetaan nama/fallback. Kode hasil edit hanya wajib memenuhi panjang 12 dan karakter `A-Z0-9-`.
- `question_sheet_questions` adalah relasi banyak-ke-banyak soal–lembar; satu soal boleh dipakai banyak lembar. Semua soal dalam satu lembar wajib ber-mapel sama. Flag kode lembar aktif dikirim pada field `sheets` di `GET /api/v1/questions`; lembar terarsip tidak muncul.
- Permission `question_sheets.manage` mengontrol create/edit/archive lembar soal dan picker soal. Sejak Fase 6o (ADR-007), field `used_by_tryout` pada `GET /question-sheets` dihitung dari tabel `tryout_session_sheets`; lembar yang sudah dipakai tryout ditandai `true` (menggantikan pengecekan sementara `false` di ADR-005).
- `program_belajar` menyimpan nama program, kelas 1–12, deskripsi, dan biaya; `program_belajar_schedules` menyimpan satu atau lebih jadwal per program (hari, jam mulai, jam selesai) dengan jam selesai wajib setelah jam mulai. Permission `program_belajar.manage` mengontrol CRUD halaman Kelola Program Belajar.
- `siswa.program_belajar_id` dan `prospektus.program_belajar_id` menghubungkan peserta ke program belajar (`ON DELETE SET NULL`). `wa_orang_tua` maksimal 20 karakter dengan format opsional `+`, angka, spasi, atau tanda hubung; baris lama boleh NULL sampai diubah lewat UI.
- View `v_question_catalog` dipakai frontend untuk daftar soal dan QA untuk audit cepat; sejak `026` menyertakan `statement_count` dan `correct_statement_count`.
- Semua sesi `tryout_sessions` kini memiliki pengaturan CBT: `cbt_enabled`, `cbt_duration_minutes` (1–600 saat aktif), `cbt_shuffle_questions`, `cbt_shuffle_options`, `cbt_require_fullscreen`, dan `cbt_max_violations` (0 = tanpa batas, maksimal 100). Sesi lama tetap `cbt_enabled=false` dan memakai alur tryout sebelumnya.
- `tryout_attempts` menyimpan satu attempt per `(session_id, participant_id)` dengan `seed` deterministik, `started_at`, `deadline_at`, `status` (`in_progress`/`submitted`/`expired`), dan `violation_count`. `tryout_cbt_drafts` menyimpan autosave jawaban, `tryout_cbt_flags` menyimpan tanda ragu-ragu, dan `tryout_cbt_violations` menyimpan log pelanggaran fullscreen/tab.
- Acak soal dan opsi memakai `seed` attempt. Opsi tetap menyimpan `key` asli di database dan dikirim bersama `label` tampilan yang sudah diacak; peserta mengirim `key` asli sehingga penilaian tidak berubah. Skor tidak pernah dikembalikan ke peserta; `v_cbt_attempt_report` dipakai laporan admin.
- Migrasi `028` menambah 30 permission CRUD untuk `questions`, `question_sheets`, `tryouts`, `participants`, `mapels`, `roles`, `users`, dan `program_belajar`. Total permission 46 dengan 76 pemetaan role-permission. Permission `*.manage` lama tetap dipakai guard backend; `admin` mendapat semua permission baru, `editor` mendapat CRUD soal/lembar soal/program belajar, role lain tidak berubah.
- Purge operasional 2026-11-24 menghapus soal, opsi, kunci, pernyataan, varian, sumber soal, lembar soal, sesi/relasi/submission/draft/flag/violation tryout, `siswa`, `prospektus`, dan sesi peserta. User admin, 5 role, 46 permission, 3 mapel, 3 `source_types`, dan 3 `presentation_versions` dipertahankan. Backup: `/tmp/opencode/bank_soal_db-pre-purge-20261124-140728.dump` dan `/tmp/opencode/uploads-pre-purge-20261124-140728.tar.gz`.

## Perubahan Schema

Semua perubahan wajib diperbarui di file ini, dicatat di `pm-agent/decisions/` (Fase 6j: ADR-004), dan diuji oleh QA (Fase 6j: `QA-22`) sebelum dipakai. Kontrak Fase 3 tetap menjadi arsip.
