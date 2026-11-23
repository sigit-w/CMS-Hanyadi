# Database — Bank Soal

## Penerapan

Skema ditujukan untuk database `bank_soal_db` dengan user `bank_soal_user` pada PostgreSQL 16 lokal.

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
- Status kanonik soal adalah `approved`; `draft` dan `review` dihapus oleh migrasi `015`. Soal baru (manual/import) otomatis `approved`, dengan `rejected` dan `archived` sebagai status penunjang.
- `question_version_readiness`, `questions.is_multi_version_ready`, `presentation_versions`, dan `question_presentation_variants` adalah data historis nonaktif (ADR-004). Endpoint readiness, versi, dan varian tidak lagi diekspos (404).
- Endpoint penyajian (`bank-soal-presentation.service` `:8083`) membaca `questions` + `question_options` + `answer_keys`; hanya soal `approved` dan bukan `archived` yang tampil di tryout.
- `question_sources.storage_path` disimpan relatif terhadap direktori upload aplikasi, bukan path absolut.
- `questions.image_url` dan `question_presentation_variants.image_url` menyimpan URL relatif `/api/v1/uploads/<nama_file>`; file fisik berada di `UPLOAD_DIR` (default direktori `uploads/` backend).
- `tryout_submissions` menyimpan satu baris per `(user_id, question_id, version)` dan memiliki `session_id` ke `tryout_sessions`; kolom `version` tetap diisi konstan `'v1'` secara internal untuk kompatibilitas histori (ADR-004). Skor rekap dihitung dari tabel ini, bukan dari state browser. Endpoint penyajian tidak mengirim `correct_key`, `correct_keys`, `answer_text`, `is_correct`, `correct`, atau `explanation` ke peserta.
- `tryout_sessions` menyimpan `name`, `session_date`, dan `mapel_id`; hanya satu sesi yang boleh aktif. Submission baru otomatis memakai sesi aktif. Permission `tryout_reports.read` mengontrol halaman laporan yang menampilkan perbandingan jawaban dan kunci.
- `tryout_session_questions` dan `tryout_session_participants` menentukan soal serta peserta sebuah TO. Bila sesi aktif memiliki baris pada tabel tersebut, daftar soal dan submission dibatasi sesuai daftar; sesi lama tanpa baris tetap memakai perilaku sebelumnya. Permission `tryouts.manage` mengontrol pembuatan TO dan CRUD peserta di CMS.
- `tryout_participants` menyimpan `nama`, `email`, `kelas`, `sekolah`, dan `password_hash` peserta tryout. Peserta dibuat hanya lewat halaman CRUD Peserta, login memakai email, dan admin dapat mengubah passwordnya. Role `peserta` dinonaktifkan dan tidak tersedia lagi di halaman Buat User.
- `tryout_submissions` dan `auth_sessions` memakai `participant_id` untuk akun peserta dan `user_id` untuk akun CMS; tepat salah satu yang terisi. Baris lama milik user ber-role `peserta` sudah dipindahkan ke `participant_id` oleh migrasi `010`.
- Daftar soal CMS memakai pagination server-side dengan `page` dan `limit` default 20; respons menyertakan `pagination: { page, limit, total }` (ADR-004).
- `question_sheets` menyimpan satu lembar soal dengan tepat satu `mapel_id`, kode unik 12 karakter termasuk tanda hubung, `duration_minutes` positif, dan flag `archived` untuk soft delete. Kode generator = `LS-<KODE_MAPEL>-mmyy`, misalnya `LS-MTKA-mmyy`; kode mapel berasal langsung dari `mapels.code` tanpa pemetaan nama/fallback. Kode hasil edit hanya wajib memenuhi panjang 12 dan karakter `A-Z0-9-`.
- `question_sheet_questions` adalah relasi banyak-ke-banyak soal–lembar; satu soal boleh dipakai banyak lembar. Semua soal dalam satu lembar wajib ber-mapel sama. Flag kode lembar aktif dikirim pada field `sheets` di `GET /api/v1/questions`; lembar terarsip tidak muncul.
- Permission `question_sheets.manage` mengontrol create/edit/archive lembar soal dan picker soal. Kode terkunci setelah lembar dipakai tryout, tetapi relasi tryout–lembar belum ada di Fase 6l sehingga pengecekan sementara selalu `false` (ADR-005).
- View `v_question_catalog` dipakai frontend untuk daftar soal dan QA untuk audit cepat.

## Perubahan Schema

Semua perubahan wajib diperbarui di file ini, dicatat di `pm-agent/decisions/` (Fase 6j: ADR-004), dan diuji oleh QA (Fase 6j: `QA-22`) sebelum dipakai. Kontrak Fase 3 tetap menjadi arsip.
