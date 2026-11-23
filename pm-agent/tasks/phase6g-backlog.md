# Backlog — Fase 6g: Manajemen Tryout

| Field | Isi |
|---|---|
| Tanggal | 2026-11-22 |
| Pemilik | PM |
| Sumber | Permintaan pemilik proyek |
| Desain | `pm-agent/decisions/ADR-002-manajemen-tryout.md` |
| Prioritas | P0 |

## Evaluasi PM

Flow yang diminta sudah jelas dan dapat dipecah menjadi satu transaksi create:

1. Admin membuka menu **Manajemen Tryout**.
2. Admin mengisi `nama tryout` dan `tanggal pelaksanaan`.
3. Admin memilih `mapel` (`BIND`, `MTKA`, `IPAS`).
4. Setelah mapel dipilih, UI memuat soal aktif pada mapel tersebut; admin mencentang soal yang dipakai.
5. UI memuat user dengan role `peserta`; admin mencentang peserta yang diundang.
6. Admin opsional menjadikan TO ini sebagai sesi aktif; sistem menonaktifkan sesi lain secara otomatis.
7. Server menyimpan sesi + relasi soal + relasi peserta dalam satu transaksi dan mengembalikan ringkasan.

Keputusan desain, kompatibilitas sesi lama, dan matriks enforcement ada di ADR-002. Tidak ada perubahan pada format laporan selain penambahan informasi mapel/jumlah soal/peserta pada daftar TO.

## Acceptance Criteria

- [ ] Migrasi `009_tryout_management.sql` diterapkan dan tercatat di `db/schema.sql` / `db/README.md`.
- [ ] `POST /api/v1/tryouts` menerima `{ name, session_date, mapel_code, question_ids[], participant_ids[], is_active }` dan mengembalikan `tryout` + ringkasan.
- [ ] `GET /api/v1/tryouts` menampilkan nama, tanggal, mapel, jumlah soal, jumlah peserta, status aktif, dan jumlah submission.
- [ ] Validasi gagal (`400`) bila mapel tidak aktif, soal tidak ada/aktif tapi beda mapel, atau peserta tidak aktif/tanpa role `peserta`.
- [ ] Menu **Manajemen Tryout** muncul hanya untuk permission `tryouts.manage`; halaman berisi form dan daftar TO.
- [ ] Saat sesi aktif memiliki relasi soal, peserta hanya melihat/mengirim soal tersebut; saat memiliki relasi peserta, hanya peserta terdaftar yang bisa submit.
- [ ] Sesi lama tanpa relasi tetap berfungsi (regresi 89 test existing lolos).
- [ ] Laporan sistem diperbarui dan build produksi CMS/tryout sukses.

## Serah Terima

| Task ID | Owner | Prioritas | Dependency | Status |
|---|---|---|---|---|
| BE-23 | Backend | P0 | ADR-002 | done |
| FE-19 | Frontend | P0 | BE-23 | done |
| TRY-08 | Tryout | P0 | BE-23 | done |
| QA-20 | QA | P0 | BE-23, FE-19, TRY-08 | done |
| REL-08 | PM | P0 | QA-20 | done |
