# Backlog — Fase 6u: Tryout Bersesi, Laporan, dan Lanjutan Sesi

| Field | Isi |
|---|---|
| Fase | Fase 6u |
| Gate | `REL-27` |
| Tanggal | 2026-11-24 |
| ADR | `ADR-017` |
| Status | done |
| Pemilik | PM |
| Melanjutkan | Fitur baru setelah `REL-26`; Fase 6, 6t, dan `REL-01…REL-26` tidak dibuka ulang |

## Konteks / Masukan Pemilik

Pemilik meminta sebelas perubahan dalam tiga alur.

**1. Flow manajemen tryout**

1. Satu tryout terdiri dari beberapa sesi; satu sesi hanya terdiri dari satu mapel.
2. Saat menambahkan peserta dan memilih Peserta Umum, tampilkan juga daftar dari tabel `prospektus` dan sediakan form pencarian.
3. Ketika waktu saat ini melewati tanggal/jam akhir tryout, status berubah menjadi `selesai`.
4. Buang opsi `jadikan sesi aktif`; buang kolom `Lembar` dari tabel daftar tryout.
5. Durasi pada mode CBT adalah durasi **per sesi tryout**, bukan keseluruhan tryout.
6. Kolom `Submission` pada tabel daftar tryout dihapus.

**2. Halaman laporan tryout**

7. Ringkasan laporan menjadi satu baris: `Nama | Sekolah | Mapel | Jumlah Soal | Benar | Salah | Nilai`.
8. Laporan dapat diunduh sebagai file Excel berisi data peserta dan siswa yang mengikuti tryout.
9. Log pelanggaran default tidak tampil; muncul saat tautan `Lihat detail` diklik.

**3. Halaman tryout user**

10. Soal dibagi menjadi beberapa sesi; tidak semua soal tampil bersamaan.
11. Setelah sesi 1 selesai, peserta dapat langsung lanjut ke sesi berikutnya atau keluar dan login lagi selama batas akhir tryout belum terlampaui.

Keputusan lengkap ada di `pm-agent/decisions/ADR-017-tryout-bersesi-dan-laporan.md`.

## Requirement

| ID | Requirement | PM | Status | Gate | ADR |
|---|---|---|---|---|---|
| R1 | Induk tryout berisi banyak sesi; satu sesi tepat satu mapel | PM-25 | done | REL-27 | ADR-017 |
| R2 | Picker Peserta Umum menampilkan prospektus + pencarian nama/email/kelas/sekolah | PM-25 | done | REL-27 | ADR-017 |
| R3 | Status turunan `selesai` setelah `ends_at` induk | PM-25 | done | REL-27 | ADR-017 |
| R4 | Opsi `jadikan sesi aktif` dan kolom `Lembar` dihapus dari CMS | PM-25 | done | REL-27 | ADR-017 |
| R5 | `cbt_duration_minutes` per sesi, bukan per induk | PM-25 | done | REL-27 | ADR-017 |
| R6 | Kolom `Submission` dihapus dari tabel daftar tryout | PM-25 | done | REL-27 | ADR-017 |
| R7 | Baris laporan `Nama|Sekolah|Mapel|Jumlah Soal|Benar|Salah|Nilai` | PM-25 | done | REL-27 | ADR-017 |
| R8 | Ekspor Excel berisi roster peserta/siswa beserta ringkasan | PM-25 | done | REL-27 | ADR-017 |
| R9 | Log pelanggaran tersembunyi, tampil lewat `Lihat detail` | PM-25 | done | REL-27 | ADR-017 |
| R10 | Soal tryout user dibagi per sesi dan hanya sesi aktif yang dimuat | PM-25 | done | REL-27 | ADR-017 |
| R11 | Lanjut sesi berikutnya / login ulang sampai batas akhir induk | PM-25 | done | REL-27 | ADR-017 |

## Keputusan

| ID | Keputusan | Alasan |
|---|---|---|
| D1 | Tabel induk `tryout_events`; `tryout_sessions.event_id` FK cascade; backfill awal 1:1 | Menjaga slug login, JWT, dan seluruh FK `session_id` existing |
| D2 | `tryout_session_mapels` dibatasi `UNIQUE(session_id)`; payload baru memakai `sessions[]` dengan tepat satu `mapel_code` per sesi | Memenuhi "1 sesi = 1 mapel" tanpa menghapus kompatibilitas |
| D3 | Sesi lama multi-mapel dipecah menjadi beberapa sesi anak; baris turunan dipindah/diduplikasi sesuai mapel | Data historis tetap dapat dilaporkan |
| D4 | Slug induk untuk URL; slug sesi lama tetap diterima; login memetakan ke daftar sesi | Tidak memutus tautan dan token lama |
| D5 | Picker memuat siswa aktif + prospektus aktif; pencarian server-side; `bergabung=true` memakai ID siswa konversi | Menghindari duplikat dan memenuhi permintaan tabel prospektus |
| D6 | `status` turunan server: `terjadwal`/`berlangsung`/`selesai`; `is_active` tidak diubah otomatis | Constraint unik lama tetap aman |
| D7 | Hapus opsi aktif dan kolom `Lembar`; fieldset pemilih lembar tetap dipertahankan | Lembar masih dipakai untuk menyusun soal sesi |
| D8 | Deadline CBT = `min(mulai sesi + durasi sesi, ends_at induk)` | Durasi per sesi tetap, batas tryout tetap dihormati |
| D9 | Kolom `Submission` dihapus dari daftar tryout tanpa pengganti; `submission_count` tetap dikembalikan API untuk kebutuhan internal/laporan | Angka baris soal menyesatkan dan tidak diperlukan di daftar |
| D10 | Laporan satu baris per peserta per sesi/mapel; `Kelas` dipindah ke ekspor | Mapel tetap tampil sebagai dimensi |
| D11 | Ekspor XLSX sisi server memakai `exceljs`; menyertakan peserta tanpa submission; tanpa kunci jawaban | Format Excel sesuai permintaan dan data lengkap |
| D12 | Log pelanggaran default collapse; `Lihat detail` menampilkan JSON | Mengurangi kebisingan laporan tanpa mengubah API |
| D13 | Tryout-agent memuat soal per sesi; tombol lanjut/keluar; asset `app.js?v=19` | Sesuai alur baru dan menghindari cache lama |
| D14 | Gate `REL-27`, backup pre-`030`, rollback ke `REL-26`, tanpa Fase 7 | Konsisten dengan pola gate sebelumnya |

## Acceptance Criteria

- **R1**: induk dengan 2 sesi tersimpan; tiap sesi memiliki tepat satu mapel; dua mapel dalam satu sesi ditolak; sesi existing tetap terbaca.
- **R2**: memilih Peserta Umum menampilkan siswa dan prospektus; pencarian menemukan nama/email/kelas/sekolah; prospektus dapat dipilih tanpa error 400; tidak ada duplikat `bergabung=true`.
- **R3**: setelah `ends_at`, list dan detail menampilkan `selesai`; sebelum itu `terjadwal`/`berlangsung`; `is_active` tidak berubah karena waktu.
- **R4**: tidak ada checkbox `jadikan sesi aktif` dan tidak ada kolom `Lembar`; pemilih lembar soal di form masih berfungsi.
- **R5**: dua sesi dengan durasi berbeda menghasilkan deadline berbeda; batas induk tetap memotong deadline yang lebih panjang.
- **R6**: header dan sel `Submission` tidak ada lagi di tabel daftar; tidak ada kolom pengganti.
- **R7**: tabel laporan memiliki tepat tujuh kolom sesuai urutan pemilik; `Jumlah Soal` memakai total sesi; `Nilai` sama dengan skor existing.
- **R8**: file `.xlsx` terunduh, terbuka, dan memuat baris untuk peserta yang tidak submit sekalipun; tidak memuat kunci/pembahasan.
- **R9**: saat halaman dibuka tidak ada baris log pelanggaran; setelah `Lihat detail` diklik, baris dan JSON detail muncul; klik lagi menyembunyikan.
- **R10**: daftar sesi tampil; memilih sesi memuat hanya soal sesi itu; tombol sesi lain tidak menampilkan soal sesi sebelumnya.
- **R11**: setelah sesi 1 selesai muncul `Lanjut sesi berikutnya` dan `Keluar`; login ulang mengembalikan daftar sesi; setelah batas induk, login/sesi baru ditolak dengan pesan jelas.

## Breakdown Task

| ID | Agent | Deskripsi | AC | Gate | Status | ADR |
|---|---|---|---|---|---|---|
| PM-25 | PM | Mencatat 11 perubahan, ADR-017, backlog ini, 7 handoff, dan status board | R1–R11 | REL-27 | done | ADR-017 |
| BE-40 | Backend | Migrasi `030`, induk `tryout_events`, one-mapel constraint, status turunan, search prospektus, endpoint ekspor XLSX, gate batas akhir | R1–R8, R10, R11 | REL-27 | done | ADR-017 |
| FE-37 | Frontend | Form induk + sesi, picker prospektus + search, hapus opsi aktif/kolom Lembar, status, durasi per sesi, laporan 1 baris, tombol Excel, toggle log | R1–R9 | REL-27 | done | ADR-017 |
| TRY-19 | Tryout | Tab sesi, muat soal per sesi, panel lanjut/keluar, login ulang, bump `app.js?v=19` | R10, R11 | REL-27 | done | ADR-017 |
| PRES-07 | Presentasi | Soal/attempt per sesi, deadline efektif `min(sesi, induk)`, toggle detail log tanpa perubahan API | R5, R10, R11 | REL-27 | done | ADR-017 |
| QA-37 | QA | Test R1–R11 + regresi `REL-24`…`REL-26`, fixture dibersihkan | R1–R11 | REL-27 | done | ADR-017 |
| DOC-08 | Dokumentasi | Update `docs/architecture.md`, `db/README.md`, OpenAPI, README backend | R1, R5, R8 | REL-27 | done | ADR-017 |
| REL-27 | Release | Backup pre-`030`, deploy, smoke test, gate GO/NO-GO | R1–R11 | REL-27 | GO (belum commit) | ADR-017 |

## Handoff

- `tasks/handoff-BE40.md`
- `tasks/handoff-FE37.md`
- `tasks/handoff-TRY19.md`
- `tasks/handoff-PRES07.md`
- `tasks/handoff-QA37.md`
- `tasks/handoff-DOC08.md`
- `tasks/handoff-REL27.md`

## Risiko & Catatan

- Constraint unik `is_active` lama (`db/migrations/008_tryout_sessions_and_report_permission.sql`) tidak boleh bertabrakan dengan status `selesai` baru.
- Login saat ini terikat satu slug/sesi (`backend-agent/src/authRoutes.js`); perubahan ke daftar sesi adalah perubahan kontrak paling sensitif.
- `submission_count` saat ini menghitung baris soal (`tryoutRoutes.js`); field tetap ada di API tetapi tidak dirender di daftar.
- Pemisahan sesi multi-mapel hasil `ADR-016` harus dicatat; jangan menghapus baris `tryout_submissions` saat memindah `session_id`.
- Library `exceljs` belum terpasang; perubahan `package.json` dan lockfile wajib masuk commit yang sama.
- Marker QA lama untuk `Lembar`, status `Aktif`, dan `app.js?v=18` harus diperbarui bersamaan.
- `REL-24` (401 gate netral), `REL-25` (debounce 750 ms), dan `REL-26` (submit global per sesi) tidak boleh diregresi.
- Empat pertanyaan terbuka di ADR-017 tetap tercatat sebagai catatan historis; verifikasi final mengikuti bukti QA-37.
- Tidak ada perubahan pada Fase 7, tidak ada ADR/backup Fase 7 yang boleh dipakai.
- **Status akhir:** seluruh task `done`, `REL-27` **GO**; regresi `32 tests, 32 pass, 0 fail`, migrasi `030` terpasang, backup `/tmp/opencode/bank_soal_db-pre030-2026-11-24.dump` ada (187958 bytes), services sehat, baseline DB `1|1|1|2|10|1|3`, `YAML OK 3.0.3 56`. Perubahan Fase 6u sudah di-commit dan di-push ke `origin/main` di commit `b9f377a` — `Finalisasi Fase 6u — tryout bersesi dan tutup REL-27` — sesuai permintaan user. Gate `REL-01…REL-27` tetap berlaku; Fase 7 tetap dibatalkan.
