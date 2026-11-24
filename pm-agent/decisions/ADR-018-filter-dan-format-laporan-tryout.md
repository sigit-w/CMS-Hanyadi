# Decision Log — ADR-018

| Field | Isi |
|---|---|
| ID | ADR-018 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | PM-26, BE-41, FE-38, QA-38, DOC-09, REL-28 |
| Melanjutkan | Fase 6u / `REL-27`; `REL-01…REL-27` tidak dibuka ulang; Fase 7 tetap dibatalkan |

## Konteks

Pemilik meminta empat perubahan pada halaman laporan tryout:

1. Hapus section **Buat Sesi Tryout** dan section **Sesi Tersedia**.
2. Buat filter sesi tryout, dengan pencarian teks bila data sudah terlalu banyak, serta tombol **Cari/Filter**.
3. Tambahkan filter **nama tryout** saat mengunduh laporan tryout.
4. Format laporan mengikuti contoh file XLSX yang dilampirkan pemilik.

Keadaan saat ini: `frontend-agent/src/pages/TryoutReport.jsx` masih memuat section `Buat Sesi Tryout`, `Sesi Tersedia`, checkbox `Jadikan sesi aktif`, dan tombol `Aktifkan`; import/handler `createTryoutSession`, `activateTryoutSession` serta state `form`, `saving`, `notice` masih dipakai. Ekspor XLSX hanya menerima `session_id`, filter belum ada, dan permission `tryout_reports.read` belum diubah.

Contoh format diekstrak dari `/home/ubuntu/Copy of HASIL TRYOUT TKA TKAD SD NEW PRIMAGAMA di SMPN 1 YK-21 NOV 2026.xlsx`: tiga baris judul, header dua level pada baris 6–7, kolom tetap `NO`, `NAMA SISWA`, `USER`, `ASAL SEKOLAH`, `WAKTU`, `TOTAL`, `RATA-RATA`, `RANKING`, grup per mapel berisi `B`, `S`, `NILAI`, satu baris per peserta diurutkan dari `TOTAL` terbesar, serta catatan kaki berisi aturan dan statistik `MAKSIMAL`/`MINIMAL`/`RATA-RATA` per mapel.

## Keputusan

1. **D1 — Hapus dua section dari halaman laporan.** Hapus `Buat Sesi Tryout` dan `Sesi Tersedia` beserta checkbox `Jadikan sesi aktif`, tombol `Aktifkan`, import/handler `createTryoutSession` dan `activateTryoutSession`, serta state `form`, `saving`, `notice` yang terkait di `TryoutReport.jsx`. Endpoint legacy `POST /tryout-sessions` dan `PATCH /tryout-sessions/:id/activate` di backend **tidak dihapus** pada Fase 6v agar klien lama tidak rusak. Pembuatan dan aktivasi sesi tetap dilakukan di halaman manajemen tryout.
2. **D2 — Filter sesi tryout.** Sumber data adalah `tryout_sessions` beserta induk `tryout_events`; tampilkan nama induk, nama sesi, dan mapel. Gunakan pencarian sisi server lewat parameter `search` pada endpoint daftar sesi laporan, dengan debounce bila data banyak. Tombol `Cari/Filter` menerapkan filter; nilai awal adalah `Semua sesi`.
3. **D3 — Filter nama tryout pada ekspor.** Endpoint ekspor XLSX menerima `session_id` dan `tryout_name`. `tryout_name` memakai `ILIKE` case-insensitive, partial match, wildcard `%`/`_` di-escape, dan dibatasi panjangnya. Bila keduanya diisi, keduanya digabung dengan `AND`. Permission `tryout_reports.read` tidak diubah. Nama file unduhan mencerminkan filter yang dipakai.
4. **D4 — Format XLSX.** Ekspor memakai tiga baris judul, header dua level, dan satu baris per peserta. Untuk setiap mapel dibuat grup tiga kolom `B` (benar), `S` (salah), `NILAI` (2 desimal), diikuti `TOTAL`, `RATA-RATA`, dan `RANKING`. Baris diurutkan dari `TOTAL` menurun. Di bawah tabel ditambahkan `KETERANGAN`, aturan `B`/`S`, kriteria pengurutan, statistik `MAKSIMAL`/`MINIMAL`/`RATA-RATA` per mapel, dan baris tanda tangan. Nama mapel bersifat dinamis dari tryout yang difilter; contoh `INDONESIA`/`MATEMATIKA`/`IPAS` tidak di-hardcode. Tidak ada kunci jawaban atau pembahasan.
5. **D5 — Ruang lingkapan dan gate.** Tidak ada migrasi database. Rollback ke `REL-27`; gate baru `REL-28`; tanpa Fase 7. `REL-01…REL-27` tidak dibuka ulang.
6. **D6 — Reliabilitas.** Regresi `REL-24…REL-27` wajib tetap lolos: 401 gate netral, debounce violation, submit global per sesi, serta laporan 7 kolom dan log tersembunyi tidak boleh berubah.

## Konsekuensi

- Halaman laporan menjadi fokus baca/filter/ekspor; operasi tulis sesi tetap berada di manajemen tryout.
- Format XLSX berubah dari 10 kolom lama menjadi format contoh pemilik; QA-38 wajib menguji struktur header, urutan baris, statistik, dan tidak adanya kunci jawaban.
- Tampilan layar 7 kolom Fase 6u dipertahankan sampai pemilik meminta format contoh dipakai juga di layar.
- Perubahan ini hanya dicatat oleh PM sampai pemilik meminta development; tidak ada commit atau push otomatis.

## Pertanyaan Terbuka

1. Apakah format XLSX contoh juga harus dipakai untuk tabel di layar CMS, atau hanya untuk file unduhan?
2. Apakah filter `tryout_name` pada ekspor juga harus ikut menjadi filter di layar laporan?
3. Bila teks pencarian kosong, apakah tombol `Cari/Filter` harus menampilkan seluruh sesi (`Semua sesi`)?

## Alternatif yang Dipertimbangkan

- **Menghapus endpoint create/activate legacy**: ditolak pada Fase 6v karena dapat merusak klien lama.
- **Mempertahankan format 10 kolom ekspor existing**: ditolak karena pemilik memberikan contoh format baru.
- **Membuka Fase 7**: ditolak; Fase 7 sudah dibatalkan dan perubahan ini masuk Fase 6v / `REL-28`.
