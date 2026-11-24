# Decision Log — ADR-017

| Field | Isi |
|---|---|
| ID | ADR-017 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | PM-25, BE-40, FE-37, TRY-19, PRES-07, QA-37, DOC-08, REL-27 |
| Melanjutkan | Fitur baru setelah `REL-26`; Fase 6, 6t, dan `REL-01…REL-26` tidak dibuka ulang |

## Konteks

Pemilik meminta sebelas perubahan yang dikelompokkan dalam tiga alur:

1. **Manajemen tryout:** induk tryout berisi banyak sesi; satu sesi hanya satu mapel; picker peserta umum juga menampilkan data prospektus + pencarian; status otomatis `selesai` setelah batas waktu; hapus opsi `jadikan sesi aktif` dan kolom `Lembar`; durasi CBT berlaku per sesi; dan kolom `Submission` dihapus dari daftar.
2. **Laporan tryout:** satu baris ringkasan berisi `Nama | Sekolah | Mapel | Jumlah Soal | Benar | Salah | Nilai`; unduh Excel berisi peserta dan siswa; log pelanggaran tersembunyi sampai `Lihat detail` diklik.
3. **Halaman tryout user:** soal dibagi per sesi, tidak semua tampil sekaligus; setelah sesi selesai peserta bisa lanjut ke sesi berikutnya atau keluar dan login lagi selama batas akhir tryout belum terlampaui.

Keadaan saat ini: `tryout_sessions` adalah satu-satunya entitas tryout, `tryout_session_mapels` masih many-to-many (`ADR-016`), status hanya `is_active` + `start_at`/`end_at`, login terikat satu slug/sesi, `cbt_duration_minutes` ada di baris sesi, `submission_count` menghitung baris `tryout_submissions` per soal, laporan hanya dirender di layar, dan log pelanggaran selalu tampil. Tidak ada library Excel di `package.json` mana pun.

## Keputusan

1. **Model induk–sesi.** Tambah tabel induk `tryout_events` (`id`, `name`, `slug` unik, `starts_at`, `ends_at`, timestamp) dan kolom `tryout_sessions.event_id` NOT NULL dengan FK `ON DELETE CASCADE`; `status` adalah field turunan di response API, bukan kolom fisik. CMS menyebut induk sebagai `tryout`, dan baris `tryout_sessions` sebagai `sesi`. Backfill awal 1 induk : 1 sesi agar slug login, JWT, dan semua FK `session_id` existing tetap valid.
2. **Satu sesi = satu mapel.** Setelah backfill/split, `tryout_session_mapels` dibatasi menjadi `UNIQUE (session_id)`; `tryout_sessions.mapel_id` tetap sebagai mirror legacy. Payload baru `POST /api/v1/tryouts` menerima `sessions[]`, tiap elemen persis satu `mapel_code`; `mapel_codes[]` lama hanya diterima untuk kompatibilitas bila panjangnya 1. Sesi lama yang memiliki banyak mapel dipecah menjadi beberapa sesi anak dengan mempertahankan soal, lembar, peserta, attempt, dan submission sesuai sesi barunya.
3. **Slug & login.** Slug kanonik induk dipakai untuk URL undangan dan daftar tryout. Slug sesi existing tetap dipertahankan sebagai fallback dan untuk token lama. Login memetakan peserta ke induk lalu memberi daftar sesi yang boleh dikerjakan; token tidak lagi secara permanen terikat satu sesi.
4. **Picker peserta umum/prospektus.** Dialog pilih peserta menampilkan tiga sumber: `siswa` aktif, `prospektus` aktif (termasuk `prospek=true`), dan form manual Umum. Pencarian sisi server mencakup nama, email, kelas, dan sekolah. ID `prospektus` dapat langsung dilampirkan; jika `bergabung=true`, pakai ID `siswa` hasil konversi agar tidak duplikat. Guard backend hanya menolak peserta `is_active=false`, bukan lagi `prospek=true`.
5. **Status.`status` merupakan field turunan server: `selesai` bila `now() > ends_at` (batas induk), `berlangsung` bila di dalam rentang, `terjadwal` bila sebelum mulai. Nilai dihitung di query list/detail tryout dan laporan; `is_active` tidak diubah otomatis karena constraint unik lama masih berlaku.
6. **Hapus UI.** Opsi `jadikan sesi aktif` dihapus dari form buat/edit tryout; tidak mengirim `is_active` dari form. Kolom `Lembar` dihapus dari tabel daftar tryout. Fieldset pemilih lembar soal **tetap ada** di form karena dipakai untuk membentuk soal sesi. Penghapusan tombol `Aktifkan` di halaman laporan menunggu konfirmasi pemilik (lihat Pertanyaan Terbuka).
7. **Durasi CBT per sesi.** `cbt_duration_minutes` tetap di `tryout_sessions`, kini benar-benar per sesi. Form induk tidak lagi memuat satu durasi global; tiap kartu sesi memiliki durasi sendiri. Deadline efektif attempt = `min(waktu_mulai_sesi + durasi_sesi, ends_at induk)`.
8. **Submission.** Kolom `Submission` dihapus dari tabel daftar tryout tanpa pengganti. Field `submission_count` tetap dikembalikan API untuk kompatibilitas internal/laporan, tetapi tidak dirender di CMS.
9. **Baris laporan.** Ringkasan laporan menjadi satu baris per peserta per sesi/mapel dengan kolom persis `Nama | Sekolah | Mapel | Jumlah Soal | Benar | Salah | Nilai`. `Kelas` dipindahkan ke detail/ekspor. `Jumlah Soal` memakai `row.total` yang sudah tersedia; `Nilai` memakai `row.score`.
10. **Ekspor Excel.** Tambah endpoint `GET /api/v1/reports/tryout/export.xlsx` dengan permission `tryout_reports.read`, dibangun memakai `exceljs` di backend. Isi ekspor: seluruh peserta terdaftar (siswa + prospektus), termasuk yang belum submit, dengan kolom `Jenis | Nama | Sekolah | Kelas | Mapel | Jumlah Soal | Benar | Salah | Nilai | Status`. Tidak memuat kunci jawaban atau pembahasan. Batas `LIMIT 500` tidak dipakai untuk ekspor; gunakan stream/pagination. Frontend hanya mengunduh blob.
11. **Log pelanggaran.** Tabel `Log Pelanggaran` default tersembunyi. Tombol/tautan `Lihat detail` per baris attempt (atau per grup sesi) menampilkan daftar pelanggaran dan `detail` JSON. API dan penyimpanan log tidak diubah.
12. **Soal per sesi.** Tryout-agent menampilkan daftar/tab sesi dan hanya memuat soal sesi yang dipilih. CBT `startCbt()` dan non-CBT `loadQuestions()` menerima `session_id`; `submit-all` tetap per sesi. Jumlah soal yang tampil tidak lagi seluruh induk sekaligus.
13. **Lanjut & login ulang.** Setelah sesi selesai, tombol `Lanjut sesi berikutnya` dan `Keluar` ditampilkan. Peserta boleh masuk lagi selama `now() <= ends_at` induk; server memeriksa batas ini pada login, pengambilan soal, autosave, dan submit. Sesi yang sudah `submitted` terkunci; sesi berikutnya tetap tersedia.
14. **Asset & gate.** Bump `tryout-agent/index.html` ke `app.js?v=19` (`styles.css?v=15` hanya jika CSS berubah). Gate baru `REL-27`; backup pre-migrasi wajib sebelum `030`; rollback ke `REL-26`; `REL-01…REL-26` tidak diubah.

## Konsekuensi

- Perubahan model menyentuh hampir semua konsumen `tryout_sessions`: CMS, laporan, auth, presentation, dan QA. Backfill 1:1 adalah langkah paling aman; pemecahan sesi multi-mapel lama harus dicatat eksplisit di log migrasi.
- `ADR-016` tetap berlaku sebagai sejarah, tetapi aturan "1 sesi banyak mapel" digantikan oleh ADR-017 untuk data baru.
- Status `selesai` hanya dilaporkan, bukan mengubah `is_active`; ini menghindari pelanggaran constraint unik lama dan tidak mematikan data historis.
- `submission_count` berubah makna di UI; QA lama yang mengasumsikan jumlah baris soal perlu diperbarui.
- Penambahan `exceljs` dan kolom `event_id` perlu lockfile di-commit bersama perubahan backend.
- Regresi wajib mencakup `REL-24`/`REL-25`/`REL-26`: 401 gate netral, debounce violation, multi-mapel unik, dan submit global per sesi tidak boleh hilang.

## Pertanyaan Terbuka

1. Apakah tombol `Aktifkan` dan opsi `jadikan sesi aktif` di halaman **laporan** juga harus dihapus, atau hanya di manajemen tryout?
2. Apakah batas `ends_at` induk juga mengunci sesi yang sedang berjalan, atau hanya mencegah login/mulai sesi baru?
3. Untuk prospektus dengan `bergabung=true`, apakah boleh tetap dipilih sebagai `prospektus_id`, atau wajib memakai ID siswa hasil konversi?
4. Apakah ekspor perlu menyertakan peserta yang sudah dihapus dari tryout (relasi dilepas tetapi datanya masih ada)?

## Alternatif yang Dipertimbangkan

- **Menambah `mapel_id_2`, `mapel_id_3`, dst.**: ditolak; tidak scalable dan tidak menjamin satu mapel per sesi.
- **Menyimpan semua sesi sebagai array JSON di `tryout_sessions`**: ditolak; FK, attempt, dan submission existing tidak bisa dijamin.
- **Mengubah `is_active` menjadi `selesai` lewat cron**: ditolak; constraint unik lama dan data historis berisiko.
- **Ekspor CSV dari browser tanpa library**: ditolak; pemilik meminta file Excel dan dataset perlu join roster sisi server.
- **Menampilkan log pelanggaran tanpa detail**: ditolak; pemilik ingin detail dapat dibuka sesuai kebutuhan.
- **Membuka Fase 7**: ditolak; Fase 7 sudah dibatalkan dan tidak dipakai untuk perubahan ini.
