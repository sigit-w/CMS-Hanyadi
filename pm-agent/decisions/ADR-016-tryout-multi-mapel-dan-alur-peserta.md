# Decision Log — ADR-016

| Field | Isi |
|---|---|
| ID | ADR-016 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | PM-24, BE-39, FE-36, TRY-18, PRES-06, QA-36, DOC-07, REL-26 |
| Melanjutkan | Fitur baru setelah `REL-25`; Fase 6 dan `REL-01…REL-25` tidak dibuka ulang |

## Konteks

Pemilik meminta lima perubahan sekaligus: (1) satu tryout boleh berisi beberapa mapel dengan syarat mapel tidak redundant, (2) flow lembar soal mengikuti model tersebut, (3) setiap pelanggaran memunculkan notifikasi, (4) submit jawaban cukup sekali global, dan (5) picker siswa saat buat tryout tidak menampilkan data.

Keadaan saat ini: `tryout_sessions` hanya punya `mapel_id` tunggal (`db/schema.sql:111`, dikonfirmasi di `information_schema`), create API dan CMS memakai `mapel_code` tunggal, dan satu sesi hanya satu lembar/mapel. Perbaikan sebelumnya `REL-24`/`REL-25` sudah menstabilkan 401-gate dan debounce pelanggaran; keduanya wajib tetap ada.

Batasan pemilik: **jumlah pelanggaran tidak diubah**.

## Keputusan

1. **Model multi-mapel.** Migrasi `029_tryout_multi_mapel.sql` membuat tabel `tryout_session_mapels` dengan `PRIMARY KEY (session_id, mapel_id)` dan FK ke `tryout_sessions` / `mapels` dengan `ON DELETE CASCADE`. Kolom `tryout_sessions.mapel_id` tetap nullable untuk kompatibilitas pembacaan lama dan diisi dari mapel pertama saat backfill; penulisan baru memakai junction table.
2. **Backfill.** Untuk setiap sesi, ambil `mapel_id` lama + mapel unik dari `tryout_session_sheets` yang masih relevan; deduplikasi; sisipkan ke junction. Sesi tanpa mapel valid dibiarkan tanpa baris junction dan ditandai di log migrasi.
3. **Validasi unik.** Satu sesi wajib memiliki minimal 1 dan maksimal 10 mapel aktif. Duplikat mapel dalam payload ditolak `400 VALIDATION_ERROR` sebelum DB; pelanggaran constraint DB juga diterjemahkan ke `400` dengan pesan yang sama.
4. **Kompatibilitas API.** `POST /api/v1/tryouts` menerima `mapel_codes: string[]`; field lama `mapel_code` tetap diterima dan dipetakan ke array satu elemen. Jika keduanya dikirim dan berbeda, tolak `400`. Response detail/daftar menyertakan `mapels[]` dan `mapel_code` (elemen pertama) agar klien lama tidak rusak.
5. **Perubahan mapel.** Endpoint yang mengubah relasi soal tidak lagi membandingkan `mapel_code` tunggal; ia membandingkan kumpulan mapel lama vs baru dan melakukan rekonsiliasi lembar Soal yang terpengaruh. `mapelRoutes.js` menghitung `tryout_count` dari junction, bukan kolom lama.
6. **Lembar soal.** UI mengambil daftar lembar per mapel terpilih memakai endpoint existing `GET /api/v1/question-sheets?mapel_code=...`, menampilkan label mapel pada opsi, dan memangkas `sheet_ids` saat mapel dicopot. Backend menolak `sheet_id` yang tidak termasuk mapel terpilih. Urutan dan deduplikasi `sheet_ids` tetap mengikuti ADR-005.
7. **Notifikasi pelanggaran.** Response `POST /api/v1/presentation/cbt/attempt/violation` menyertakan `type`, `violation_count`, `max_violations`. Tryout-agent menampilkan toast untuk setiap violation yang benar-benar tercatat; debounce 750 ms dari perbaikan `REL-25` dipertahankan agar satu kejadian tidak dua kali. Saat auto-submit, pesan terakhir menggabungkan pelanggaran + attempt terkunci.
8. **Kuota tidak berubah.** `cbt_max_violations` tetap `3` untuk sesi produksi; tidak ada penambahan, pengurangan, atau reset otomatis. Tombol notifikasi hanya info.
9. **Submit global.** Untuk sesi non-CBT, presentation-service menyediakan `POST /api/v1/presentation/attempts/submit-all`: menerima seluruh jawaban dari klien, memvalidasi bahwa setiap soal termasuk sesi, menilai di server, menulis `tryout_submissions` dalam satu transaksi, dan mengembalikan `submitted_count` tanpa skor. Endpoint lama `/presentation/questions/:id/submit` tetap tersedia untuk kompatibilitas API.
10. **Hilangkan submit per soal.** Tryout-agent menghapus tombol submit/simpan per soal; jawaban masuk ke state lokal dan dikirim sekali lewat endpoint global (non-CBT) atau `finalizeButton` (CBT). Non-CBT menampilkan konfirmasi sebelum submit. Autosave CBT tidak diubah.
11. **Picker siswa.** CMS menghapus filter `jenis === 'siswa'` karena endpoint `/api/v1/siswa` sudah scope-only-siswa; filter `is_active` dipertahankan. Dialog melakukan refresh data saat dibuka/fokus. Jika tidak ada siswa aktif, tampilkan pesan kosong, bukan spinner/error.
12. **Asset & gate.** Bump `app.js?v=18` (`styles.css?v=15` jika ada CSS baru). Gate `REL-26` terpisah, backup pre-migrasi wajib, dan status board tidak mengubah `REL-01…REL-25`.

## Konsekuensi

- Sesi lama tetap terbaca lewat `mapel_code`, tetapi admin/CMS harus beralih ke `mapel_codes[]`.
- Ada dua sumber kebenaran sampai klien lama habis: junction untuk penulisan baru, kolom `mapel_id` hanya untuk kompatibilitas pembacaan.
- Duplikat soal lintas mapel dalam satu sesi tetap dicegah oleh PK `tryout_session_questions`.
- Jawaban non-CBT terkirim dalam satu transaksi: tidak ada kondisi sebagian soal masuk dan sebagian gagal.
- QA wajib menguji multi-mapel unik, lembar per mapel, toast violation tanpa duplikat, submit global non-CBT, regresi CBT, dan picker siswa dengan fixture aktif.
- Backup pre-migrasi disimpan sebelum `029` dijalankan; rollback ke `REL-25` tidak menghapus Fase 6.

## Alternatif yang Dipertimbangkan

- **Tambah kolom `mapel_id_2`**: ditolak; tidak scalable dan tidak bisa menjamin uniqueness generik.
- **Hapus `mapel_id` lama**: ditolak; terlalu banyak konsumen existing (`mapelRoutes`, laporan, CMS list) yang akan rusak.
- **Simpan mapel hanya di `sheet_ids`**: ditolak; lembar bisa diarsipkan/dihapus dan bukan sumber identitas mapel sesi.
- **Submit per soal tetap ada tapi disembunyikan**: ditolak; pemilik ingin alur satu submit yang jelas.
- **Naikkan `cbt_max_violations` agar tidak auto-submit**: ditolak tegas oleh pemilik.
- **Membuka Fase 7**: ditolak; Fase 7 sudah dibatalkan dan tidak menjadi bagian dari gate ini.
