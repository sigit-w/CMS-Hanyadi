# Decision Log — ADR-002

| Field | Isi |
|---|---|
| ID | ADR-002 |
| Tanggal | 2026-11-22 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | BE-23, FE-19, TRY-08, QA-20, REL-08 |

## Konteks

Pemilik proyek meminta menu baru **Manajemen Tryout** di CMS. Admin membuat satu Tryout (TO) dengan menentukan nama, tanggal pelaksanaan, mapel soal, soal yang dipakai, dan peserta yang diundang. Saat ini `tryout_sessions` hanya menyimpan `name`, `session_date`, dan `is_active`; tidak ada relasi ke mapel, daftar soal, atau peserta. Laporan tryout sudah rilis dan dikelompokkan per sesi.

## Keputusan

1. **Pertahankan `tryout_sessions` sebagai entity TO.** Tidak membuat tabel `tryouts` baru agar laporan, submission, dan sesi aktif yang sudah rilis tetap kompatibel. Tambah kolom `mapel_id` ke `tryout_sessions`.
2. **Tambah dua tabel relasi**: `tryout_session_questions (session_id, question_id, position)` dan `tryout_session_participants (session_id, user_id)`. Keduanya memakai `ON DELETE CASCADE`.
3. **Enforce saat sesi aktif sudah dikonfigurasi** (backward compatible):
   - Jika sesi aktif memiliki baris `tryout_session_questions`, endpoint `/api/v1/tryout/questions` hanya mengembalikan soal dalam daftar itu; presentation `/variants` dan `/submit` menolak soal di luar daftar.
   - Jika sesi aktif memiliki baris `tryout_session_participants`, presentation `/submit` hanya menerima peserta dalam daftar itu.
   - Sesi lama tanpa baris relasi tetap berperilaku seperti sebelumnya (semua soal siap, semua peserta dengan `tryout.access`).
4. **Permission baru `tryouts.manage`**, diberikan ke role `admin` saat migrasi. Menu dan endpoint create/list TO memakai permission ini; laporan tetap memakai `tryout_reports.read`.
5. **Satu sesi aktif** tetap dijamin oleh index unik existing. Form create menyediakan opsi `is_active`; mengaktifkan TO baru menonaktifkan sesi lain dalam transaksi yang sama.
6. **Validasi server**: mapel harus aktif; semua soal harus aktif dan `mapel_id`-nya cocok; semua peserta harus aktif dan memiliki role `peserta`. UI hanya membantu pemilihan, bukan satu-satunya pengaman.

## Konsekuensi

- Migrasi `009_tryout_management.sql` wajib diterapkan sebelum endpoint/UI dipakai; `db/schema.sql` dan `db/README.md` ikut diperbarui.
- Frontend menambah API client `getTryouts`, `createTryout`, dan menu `Manajemen Tryout` (`#/tryouts`).
- Tryout agent tidak berubah secara struktural; perilaku daftar soal mengikuti sesi aktif yang dikonfigurasi.
- QA menambah skenario create TO, validasi mapel/soal/peserta, filter soal aktif, dan penolakan submit oleh peserta di luar daftar.
- Risiko: data uji harus dibersihkan agar tidak mengubah sesi aktif produksi; QA memakai sesi uji dan mengembalikan sesi default aktif setelah selesai.

## Alternatif yang Dipertimbangkan

- **Tabel `tryouts` terpisah**: ditolak karena memaksa dual-write ke `tryout_sessions` untuk submission/laporan dan berisiko memecah pelaporan yang sudah rilis.
- **Hanya menyimpan metadata tanpa enforcement**: ditolak karena pilihan soal/peserta admin tidak berdampak nyata pada pengalaman peserta.
- **Enforcement tanpa fallback**: ditolak karena sesi lama (termasuk data produksi) akan kehilangan akses sampai data relasi di-backfill.

## Amandemen 2026-11-22 — Identitas Kelas dan Sekolah

- Pemilik proyek meminta `kelas` (bilangan bulat 1–100) dan `sekolah` (maksimal 255 karakter) menjadi bagian dari data peserta tryout.
- Migrasi `011_participant_class_school.sql` menambah kedua kolom secara idempotent. Nilai default `kelas = 0` dan `sekolah = ''` menjaga baris lama tetap valid; constraint check mengizinkan `0` hanya untuk data lama, sedangkan API/UI mewajibkan `1–100` dan nama sekolah tidak kosong.
- CRUD Peserta, daftar peserta pada form Tryout, laporan tryout, OpenAPI, `db/README.md`, dan laporan sistem mengikuti field baru ini.
