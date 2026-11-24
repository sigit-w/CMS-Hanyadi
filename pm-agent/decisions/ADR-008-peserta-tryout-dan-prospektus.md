# Decision Log — ADR-008

| Field | Isi |
|---|---|
| ID | ADR-008 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | PM-18, BE-33, FE-30, TRY-13, QA-30, REL-18 |

## Konteks

Setelah Fase 6o, halaman **Buat/Daftar Tryout** masih memuat seluruh `tryout_participants` ke dalam daftar peserta dan menampilkannya memakai checkbox. Data siswa dari **Kelola Siswa**因此 ikut tampil secara default, padahal pemilik meminta siswa hanya muncul setelah user memilih `A. Peserta Didik`. Pemilik juga meminta baris peserta yang telah dilampirkan bisa diklik untuk melihat detail; penghapusan peserta dari tryout memakai icon keranjang sampah, bukan checkbox; Peserta Umum yang dikeluarkan masuk ke halaman Prospektus; Peserta Siswa yang dikeluarkan hanya terlepas dari tryout dan datanya tidak boleh hilang dari tabel siswa. Label `Kelola Siswa Tryout` juga perlu disederhanakan menjadi `Kelola Siswa`.

## Keputusan

1. **Default daftar peserta.** `GET /api/v1/participants` tetap mengembalikan semua peserta aktif untuk kebutuhan picker/detail, tetapi UI Buat Tryout hanya merender peserta yang sudah terpilih untuk tryout tersebut. Karena state awal `participant_ids` kosong, siswa tidak tampil sampai user membuka `A. Peserta Didik` dan memilihnya. Teks bantu ditambahkan agar perilaku ini jelas.
2. **Picker dua pilihan.** Tombol `Tambah Peserta Tryout` tetap membuka dialog `A. Peserta Didik` dan `B. Peserta Umum`. Memilih `A. Peserta Didik` menampilkan daftar siswa aktif (`jenis='siswa'`, `is_active=true`, `prospek=false`) dengan tombol `Pilih` per baris. Tidak memakai checkbox di daftar ini. Memilih `B. Peserta Umum` mempertahankan popup Fase 6o.
3. **Daftar peserta terlampir.** Peserta yang sudah dipilih dirender sebagai baris klik dengan tombol icon `Trash2`. Tidak ada `Checkbox` pada fieldset `Peserta Tryout`. Klik baris membuka dialog detail; klik icon trash menghapus relasi peserta–tryout setelah konfirmasi. `Checkbox` masih dipakai untuk Lembar Soal dan opsi sesi aktif.
4. **Detail peserta.** Dialog detail menampilkan Nama, Jenis, Sekolah, Kelas/Program Belajar untuk siswa, WA orang tua, dan jumlah submission. PIN yang sudah di-hash tidak ditampilkan lagi; UI hanya memberi catatan bahwa PIN tidak dapat dilihat ulang.
5. **Hapus relasi, bukan hapus data induk.** Endpoint baru `DELETE /api/v1/tryouts/{id}/participants/{participantId}` menghapus baris `tryout_session_participants` dalam satu transaksi. Endpoint lama `DELETE /participants/{id}` tidak dipakai untuk aksi ini karena melakukan soft delete `is_active=false` dan mencabut sesi untuk semua jenis peserta.
6. **Peserta Umum menjadi prospek.** Jika peserta yang dikeluarkan ber-`jenis='umum'`, transaksi yang sama menandai baris `tryout_participants` dengan `prospek=true`, `prospek_at=now()`, `is_active=false`, lalu mencabut `auth_sessions` yang masih aktif. Data nama, sekolah, WA, dan hash PIN tetap tersimpan. Peserta Umum prospek tidak bisa login sampai dikembalikan/dibuat ulang (fitur restore tidak masuk scope Fase 6p).
7. **Peserta Siswa tetap utuh.** Jika `jenis='siswa'`, backend hanya menghapus relasi `tryout_session_participants`. Baris `tryout_participants`, `is_active`, password hash, program belajar, dan data siswa sama sekali tidak diubah. Siswa tetap bisa login dan muncul kembali di picker untuk tryout lain.
8. **Model data Prospektus.** Ditambahkan kolom `prospek BOOLEAN NOT NULL DEFAULT false` dan `prospek_at TIMESTAMPTZ` pada `tryout_participants`, beserta constraint `NOT prospek OR jenis='umum'` dan partial index untuk prospek. Tidak dibuat tabel baru agar FK submission, sesi, dan relasi tryout tetap konsisten. Migrasi idempoten: `023_prospektus_peserta_umum.sql`.
9. **Endpoint prospektus.** `GET /api/v1/prospektus` dengan permission `tryouts.manage` mengembalikan peserta umum ber-`prospek=true` diurutkan dari `prospek_at` terbaru. `GET /api/v1/participants?prospek=true|false` juga didukung untuk filter opsional; perilaku tanpa query tetap seperti sebelumnya.
10. **Halaman/menu Prospektus.** Halaman baru `#/tryouts/prospektus` memakai permission `tryouts.manage`, diberi menu **Prospektus** di dalam grup **Manajemen Tryout** (di bawah **Buat/Daftar Tryout**). Menampilkan Nama, Sekolah, WA orang tua, dan Tanggal masuk prospek. Tidak ada aksi restore/edit pada Fase 6p.
11. **Label.** Judul di `PesertaManagement.jsx` diubah dari `Kelola Siswa Tryout` menjadi `Kelola Siswa`; menu sidebar sudah memakai label tersebut sehingga tidak diubah lagi.
12. **Tryout agent.** Tidak ada perubahan kode `tryout-agent`. Penghapusan relasi otomatis membuat peserta tidak lagi menerima soal dari sesi terkait. QA tetap melakukan smoke login Umum dan Siswa untuk memastikan ADR-007 tidak regresi.
13. **Dokumentasi dan QA.** OpenAPI, `db/README.md`, README agent, marker `phase5.mjs`, test `phase6p.mjs`, laporan QA, release gate `REL-18`, status board, dan commit/push GitHub diperbarui.
14. **Amendemen draft tryout.** Karena daftar peserta juga dipakai sebelum tryout disimpan, trash pada draft Umum memanggil `POST /api/v1/participants/{id}/prospek`: peserta ditandai prospek, dinonaktifkan, dan sesinya dicabut walau belum ada `tryout_sessions`. Trash draft Siswa hanya menghapus state lokal; data siswa tetap utuh. Untuk tryout yang sudah tersimpan, trash memakai `DELETE /tryouts/{id}/participants/{participantId}` seperti keputusan 5.

## Konsekuensi

- Perubahan menyentuh DB, backend participant/tryout, CMS, OpenAPI, dan QA. Tidak ada perubahan pada presentation service maupun aplikasi tryout.
- Prospek adalah status turunan dari Peserta Umum, bukan jenis baru; `jenis` tetap `umum` agar kontrak login lama tidak berubah.
- Mengeluarkan Peserta Umum yang sudah mengerjakan tryout tidak menghapus submission; laporan historis tetap bisa membaca data participant.
- Karena PIN tidak disimpan plaintext, prospek tidak bisa login kembali tanpa reset PIN; ini diterima dan tercatat sebagai konsekuensi.
- `REL-15` tetap partial; `REL-18` dihitung terpisah dari `REL-17`.

## Alternatif yang Dipertimbangkan

- **Menghapus `tryout_participants` untuk Umum lalu membuat baris baru di tabel `prospektus`**: ditolak karena akan memutus FK submission dan duplikat data.
- **Menambah `jenis='prospek'`**: ditolak karena constraint dan logika login ADR-007 harus diubah; flag `prospek` lebih aman dan kompatibel.
- **Menggunakan checkbox lagi dengan aksi hapus massal**: ditolak karena pemilik secara eksplisit meminta icon keranjang sampah per baris.
- **Memanggil `DELETE /participants/{id}`**: ditolak karena efeknya terlalu luas dan akan menonaktifkan siswa juga.
- **Menyimpan siswa yang dikeluarkan sebagai prospek**: ditolak karena pemilik meminta data siswa tetap utuh di tabel siswa.
