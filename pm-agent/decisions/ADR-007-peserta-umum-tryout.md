# Decision Log — ADR-007

| Field | Isi |
|---|---|
| ID | ADR-007 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | PM-17, QA-29A, BE-32, FE-29, TRY-12, QA-29, REL-17 |

## Konteks

Pemilik proyek meminta alur halaman **Buat Tryout** diubah menjadi: (1) isi nama tryout dengan label Camel/Title Case, (2) pilih tanggal dan jam mulai, (3) pilih tanggal dan jam selesai, (4) pilih mapel, (5) tampilkan lembar soal sesuai mapel, (6) tombol tambah peserta yang tidak wajib, (7) pilihan `A. Peserta Didik` atau `B. Peserta Umum`, (8) Peserta Didik diabaikan dulu, (9) Peserta Umum membuka popup data, (10) data berisi Nama, Sekolah, PIN, WA orang tua, (11) PIN 9 digit acak otomatis, (12) Nama + PIN dipakai login di halaman tryout sehingga aturan login harus diubah.

Saat ini form memakai field `name`, `session_date DATE`, `mapel_code`, checkbox soal individual, dan wajib memilih minimal satu siswa. Login tryout memakai email + password. Belum ada konsep `Peserta Umum`, `PIN`, atau relasi tryout–lembar soal. ADR ini mengunci keputusan agar Backend, Frontend, Tryout, dan QA bekerja pada kontrak yang sama.

## Keputusan

1. **Label dan urutan form.** Label diubah menjadi `Nama Tryout` (Title/Camel Case); field internal tetap `name`. Urutan tampilan: `Nama Tryout` → `Tanggal & Jam Mulai` → `Tanggal & Jam Selesai` → `Mapel` → `Lembar Soal` → tombol `Tambah Peserta Tryout` → `Simpan Tryout`. Checkbox `Jadikan sesi aktif` dipertahankan di bawah sebagai opsi lanjutan.
2. **Waktu mulai/selesai.** Input memakai `datetime-local` untuk `start_at` dan `end_at` (`TIMESTAMPTZ`, zona `Asia/Jakarta`). Berlaku `end_at > start_at`. Kolom lama `session_date` tetap diisi dari `start_at::date` agar laporan dan query existing tidak rusak.
3. **Sumber soal berubah ke lembar soal.** Setelah mapel dipilih, UI memuat `GET /api/v1/question-sheets?status=active&mapel=<KODE>` dan menampilkan lembar soal aktif (nama, kode, durasi, jumlah soal). User wajib memilih minimal satu lembar. Checkbox soal individual lama digantikan di UI, bukan dihapus dari kontrak API.
4. **Relasi tryout–lembar soal.** Backend menerima `sheet_ids`, menyimpan relasi di tabel baru `tryout_session_sheets`, lalu dalam satu transaksi mengembangkan soal lembar menjadi baris `tryout_session_questions` agar presentation service dan pembatasan soal sesi aktif tetap bekerja. Payload lama `question_ids` tetap diterima untuk kompatibilitas regresi dan data existing.
5. **Peserta opsional.** Validasi minimal satu peserta dihapus. `participant_ids` boleh kosong atau tidak dikirim; daftar tryout menampilkan `participant_count = 0` bila memang tidak ada peserta.
6. **Tombol tambah peserta.** Tombol `Tambah Peserta Tryout` membuka pilihan `A. Peserta Didik` dan `B. Peserta Umum`. Memilih `A. Peserta Didik` hanya menampilkan pesan "Segera hadir" dan tidak membuat data apa pun pada Fase 6o.
7. **Peserta Umum disimpan di `tryout_participants`.** Modal `B. Peserta Umum` berisi Nama (wajib), Sekolah (wajib), PIN (wajib, 9 digit), WA Orang Tua (wajib, memakai format validator existing). Data disimpan sebagai `jenis='umum'`, `email NULL`, `kelas=0`, `program_belajar_id NULL`, `wa_orang_tua` terisi, `pin_hash` dari scrypt, dan `password_hash` tidak dipakai. Plaintext PIN hanya tampil di modal dan tidak boleh masuk log/DB.
8. **Pembuatan PIN.** Frontend membuat 9 digit acak memakai Web Crypto (`crypto.getRandomValues`), menampilkan nilai di field read-only dengan tombol `Generate ulang`, lalu mengirimkannya sebagai `pin` ke `POST /api/v1/participants`. Backend tetap memvalidasi `/^\d{9}$/` dan menyimpan hash. Tidak memakai `Math.random` dan tidak memakai email dummy.
9. **Unik dan validasi.** Dibuat partial unique index `lower(nama)` untuk `jenis='umum'`. Nama Umum yang sama (abaikan huruf) ditolak `409`. Email tetap unik untuk siswa; `email` dibuat nullable hanya untuk Umum. WA Umum wajib dan mengikuti format `^\\+?[0-9][0-9 -]{6,18}$`.
10. **Endpoint participant.** `POST /api/v1/participants` menerima dua bentuk: siswa (`nama`, `email`, `password`, `kelas`, `sekolah`, opsional `program_belajar_id`/`wa_orang_tua`) dan umum (`jenis='umum'`, `nama`, `sekolah`, `pin`, `wa_orang_tua`). Tidak ada endpoint baru `/umum`.
11. **Login tryout.** Kontrak `POST /api/v1/auth/login { username, password }` tidak berubah. Untuk Umum, `username = Nama` dan `password = PIN`. Urutan resolusi backend: Umum (`lower(nama)`, `pin_hash`) → Siswa (`lower(email)`, `password_hash`) → contributor CMS. JWT/session tetap `account_type='participant'`, roles `['peserta']`, permissions `['tryout.access','presentation.read']`.
12. **Auth lintas layer.** `authMiddleware.js` tidak boleh lagi mensyaratkan `participant_email`; gunakan fallback `nama` untuk `username` dan `display_name`. `authRoutes.js` tidak boleh menganggap email selalu ada. Cookie, refresh, logout, dan lockout 5 percobaan/15 menit tetap dipakai untuk kedua jenis peserta.
13. **UI tryout peserta.** Label diubah menjadi `Nama atau Email peserta` dan `Password atau PIN`, input username bertipe `text`, placeholder menjelaskan Umum memakai Nama dan Siswa memakai Email. Pesan error dibuat netral agar tidak membocorkan jenis akun. Aset di-bump ke `styles.css?v=11` dan `app.js?v=12`. Alur daftar soal dan submit tidak berubah.
14. **Migrasi dan dokumentasi.** Migrasi idempoten baru: `020_peserta_umum.sql`, `021_tryout_jadwal_lembar.sql`, dan `022_participant_password_nullable.sql` (perbaikan untuk database yang sudah menjalankan `020`). QA-29A wajib me-review ADR dan rencana migrasi sebelum migrasi diapply. OpenAPI, `db/README.md`, README agent terkait, dan status board diselaraskan. Tidak ada permission baru: `tryouts.manage`, `tryout.access`, dan `presentation.read` sudah cukup.

## Konsekuensi

- Perubahan menyentuh DB, backend auth/participant/tryout, CMS, aplikasi tryout, OpenAPI, dan QA. Ini bukan perubahan navigasi seperti Fase 6n.
- Sesi aktif, cookie HttpOnly, `auth_sessions.owner_check`, dan pembatasan soal lewat `tryout_session_questions` tetap dipakai; Umum tidak memerlukan jalur session baru.
- Laporan tryout perlu menampilkan Sekolah untuk Umum dan menyembunyikan/menandai `Kelas 0` agar tidak menyesatkan.
- PIN yang diketahui admin saat pembuatan harus diserahkan ke peserta; karena hanya hash yang disimpan, PIN tidak bisa diambil ulang—admin harus membuat ulang/reset bila peserta lupa (reset PIN masuk backlog menyusul, bukan blocker Fase 6o).
- `REL-15` tetap partial menunggu regresi Fase 6m; gate `REL-17` untuk Fase 6o dihitung terpisah.

## Alternatif yang Dipertimbangkan

- **Tetap memilih soal individual seperti sekarang**: ditolak karena pemilik secara eksplisit meminta lembar soal berdasarkan mapel.
- **Tabel terpisah `tryout_umum_participants`**: ditolak karena auth, session, submission, dan relasi sesi sudah generik memakai `participant_id`; tabel baru akan menggandakan logika.
- **Email dummy `umum-<id>@invalid` agar `NOT NULL` tetap dipertahankan**: ditolak karena menyesatkan laporan dan berisiko tertukar dengan siswa saat login.
- **Backend saja yang membangkitkan PIN lalu mengembalikannya setelah simpan**: ditolak karena pemilik meminta PIN terlihat di popup pengisian; tetap divisualisasikan sebelum submit memakai Web Crypto.
- **Endpoint login baru `/participant/login`**: ditolak karena menduplikasi cookie/refresh session dan memaksa perubahan presentation service tanpa kebutuhan fungsional.
- **Mengimplementasikan Peserta Didik sekaligus**: ditolak karena pemilik meminta fitur ini ditunda.
