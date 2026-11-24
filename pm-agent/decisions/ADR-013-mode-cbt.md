# Decision Log — ADR-013

| Field | Isi |
|---|---|
| ID | ADR-013 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | PM-23, BE-38, FE-35, TRY-17, PRES-05, QA-35, DOC-06CBT, REL-23 |
| Melanjutkan | Fitur baru setelah `REL-22`; Fase 6 dan `REL-01…REL-22` tidak dibuka ulang |

## Konteks

Pemilik meminta mode ujian berbasis komputer (CBT) untuk tryout dengan alur lengkap: timer, submit akhir, autosave, navigasi ragu-ragu, acak soal/opsi, pengawasan pelanggaran, dan laporan admin.

Keputusan pemilik:

1. Cakupan yang dikerjakan adalah **CBT lengkap**, bukan sebagian fitur.
2. Hasil/score dihitung server dan **hanya tersedia untuk admin**; peserta tidak menerima skor, kunci, atau status benar/salah.
3. Pengacakan soal dan opsi **diatur admin per tryout**, bukan selalu aktif dan bukan pilihan peserta.
4. Fase 7 tetap dibatalkan; tidak boleh membuat backlog, ADR, handoff, atau perubahan infra Fase 7.

Sesi non-CBT yang sudah ada harus tetap memakai alur lama, sehingga perubahan bersifat opt-in per tryout.

## Keputusan

1. **Mode per tryout.** Migrasi `027_cbt_exam_mode.sql` menambah kolom `cbt_enabled`, `cbt_duration_minutes`, `cbt_shuffle_questions`, `cbt_shuffle_options`, `cbt_require_fullscreen`, dan `cbt_max_violations` pada `tryout_sessions`. `cbt_enabled=true` wajib memiliki durasi 1–600 menit; batas pelanggaran 0–100 dengan `0` berarti tidak ada auto-submit.
2. **Model attempt.** Tabel `tryout_attempts` menyimpan satu attempt per `(session_id, participant_id)` dengan `seed` deterministik, `started_at`, `deadline_at`, `submitted_at`, `status`, dan `violation_count`. Status yang dikenal: `in_progress`, `submitted`, `expired`.
3. **Data pendukung.** `tryout_cbt_drafts` menyimpan jawaban sementara per attempt/soal, `tryout_cbt_flags` menyimpan penanda ragu-ragu, dan `tryout_cbt_violations` mencatat `tab_hidden`, `window_blur`, `fullscreen_exit`, dan `paste` beserta detail JSON.
4. **Laporan admin.** View `v_cbt_attempt_report` menggabungkan identitas peserta, waktu attempt, status, jumlah pelanggaran, dan ringkasan skor dari `tryout_submissions`. Endpoint `GET /api/v1/reports/tryout` menambah blok `attempts` dan `violations`.
5. **Konfigurasi backend.** `POST /api/v1/tryouts` menerima field `cbt_*`. Admin dapat mengubah konfigurasi lewat `PATCH /api/v1/tryouts/{id}/cbt` dengan validasi yang sama. Daftar dan detail tryout mengembalikan konfigurasi CBT.
6. **Endpoint peserta.** Presentation-service menyediakan:
   - `POST /api/v1/presentation/cbt/attempt/start`
   - `GET /api/v1/presentation/cbt/attempt`
   - `POST /api/v1/presentation/cbt/attempt/autosave`
   - `POST /api/v1/presentation/cbt/attempt/flag`
   - `POST /api/v1/presentation/cbt/attempt/violation`
   - `POST /api/v1/presentation/cbt/attempt/finalize`
7. **Timer & submit.** Deadline dihitung server dari `started_at + cbt_duration_minutes`. Autosave dan finalize setelah deadline ditolak; finalize berulang mengembalikan state terkunci. Finalize berjalan dalam transaksi, menulis jawaban ke `tryout_submissions` dengan `version='v1'`, dan mengunci attempt.
8. **Acak deterministik.** Urutan soal, opsi, dan pernyataan diacak dari `seed` attempt. Opsi tetap mengirim `key` asli untuk penilaian dan `label` A/B/C/D untuk tampilan, sehingga pengacakan tidak mengubah kunci.
9. **Pengawasan.** Setiap pelanggaran menambah `violation_count`. Jika `cbt_max_violations > 0` dan jumlah pelanggaran melebihi batas, server melakukan finalize otomatis. Log tetap tersimpan untuk admin.
10. **Kerahasiaan.** Payload peserta tidak mengandung `score`, `correct_key`, `correct_keys`, `is_correct`, atau kunci pernyataan. Satu-satunya umpan balik peserta adalah status terkirim/attempt terkunci.
11. **UI.** CMS memiliki form CBT saat membuat tryout, dialog **Atur CBT**, kolom **Mode**, serta tabel **Attempt CBT** dan **Log Pelanggaran** di laporan. Tryout-agent memakai timer, autosave, flag ragu-ragu, dan submit akhir; aset di-bump ke `styles.css?v=14` dan `app.js?v=15`.
12. **Fallback.** Sesi non-CBT mengembalikan `409 Tryout ini tidak menggunakan mode CBT`; tryout-agent tetap menjalankan alur lama tanpa gangguan.
13. **Gate.** `REL-23` dibuat sebagai gate khusus fitur ini. Gate lama dan penutup Fase 6 tidak diubah.

## Konsekuensi

- Migration `027` idempoten dan mengatur owner objek baru ke `bank_soal_user` karena dijalankan sebagai `postgres`.
- Satu peserta hanya memiliki satu attempt per sesi; tidak ada attempt ulang lewat endpoint CBT.
- Skor dihitung dari submission final yang ditulis saat finalize, bukan dari draft autosave.
- Peserta tidak bisa melihat laporan attempt atau log pelanggaran.
- QA wajib mencakup kerahasiaan, determinisme acak, deadline, autosave, flag, violation log, finalize idempoten, dan regresi alur non-CBT.
- Backup pre-migrasi disimpan di `/tmp/opencode/bank_soal_db-pre027-2026-11-24.dump`.

## Alternatif yang Dipertimbangkan

- **CBT aktif global**: ditolak; sesi existing harus tetap memakai alur lama.
- **Acak di sisi peserta**: ditolak; pemilik ingin konfigurasi admin per tryout.
- **Penilaian/skor di browser**: ditolak; skor dan kunci harus tetap di server dan hanya untuk admin.
- **Membuka kembali Fase 7**: ditolak; Fase 7 sudah dibatalkan dan tidak menjadi bagian dari gate ini.
