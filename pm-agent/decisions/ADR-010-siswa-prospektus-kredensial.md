# Decision Log — ADR-010

| Field | Isi |
|---|---|
| ID | ADR-010 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | PM-20, BE-35, FE-32, TRY-14, QA-32, REL-20 |

## Konteks

Pemilik meminta tiga perubahan alur tryout: (1) Peserta Umum yang dibuat dari halaman Buat Tryout disimpan di tabel `prospektus`, bukan di tabel `siswa`, dengan struktur yang sama; (2) popup/halaman detail siswa atau peserta menampilkan password atau PIN; (3) baris Prospektus diklik untuk melihat detail dan tombol mendaftarkan peserta tersebut sebagai siswa, yang menyimpan data ke `siswa` dan menandai baris prospektus sebagai `bergabung`.

Kondisi saat ini: tidak ada tabel fisik `siswa` maupun `prospektus`; satu tabel `tryout_participants` menampung keduanya lewat kolom `jenis`. Password dan PIN hanya tersimpan sebagai hash scrypt sehingga tidak bisa ditampilkan ulang. Pemilik menegaskan password/PIN peserta boleh disimpan plaintext, sedangkan password user CMS tetap wajib terenkripsi/hash. Pemilik memilih refactor penuh dan Peserta Umum tetap bisa login.

## Keputusan

1. **Tabel fisik.** `tryout_participants` direname menjadi `public.siswa`. Tabel baru `public.prospektus` dibuat dengan struktur kolom identik ditambah `bergabung BOOLEAN NOT NULL DEFAULT false` dan `bergabung_at TIMESTAMPTZ`. Keduanya memakai sequence id yang sama agar identitas peserta unik.
2. **Data Umum.** Baris `jenis='umum'` dipindahkan dari `siswa` ke `prospektus`. Peserta Umum baru dari form Buat Tryout/Kelola Peserta ditulis langsung ke `prospektus`, tetap `is_active=true` dan tetap bisa login dengan Nama + PIN.
3. **Kompatibilitas.** View `tryout_participants` dibuat sebagai `UNION ALL` dari `siswa` dan `prospektus`, lengkap dengan trigger `INSTEAD OF DELETE`, supaya query lama (auth, laporan, QA) tetap bekerja. Seluruh kode aplikasi baru menulis ke tabel fisik yang sesuai.
4. **Integritas referensial.** FK `participant_id` pada `auth_sessions`, `tryout_submissions`, dan `tryout_session_participants` diganti dengan trigger validasi keberadaan id di `siswa` atau `prospektus`, plus trigger cascade penghapusan. Ini diperlukan karena satu kolom tidak bisa mereferensi dua tabel.
5. **Kredensial peserta.** Kolom `password_plain` ditambahkan di `siswa`, `pin_plain` di `prospektus`. Nilainya diisi saat pembuatan/reset dan hanya dikembalikan lewat endpoint detail. Hash scrypt tetap menjadi satu-satunya sumber verifikasi login. Data lama yang tidak punya plaintext menampilkan `—`.
6. **Password CMS.** Tidak ada perubahan pada `contributors.password_hash`; password user CMS tetap scrypt dan tidak pernah dikembalikan API. Plaintext hanya untuk peserta tryout.
7. **Pendaftaran prospek.** Endpoint baru `POST /api/v1/prospektus/{id}/daftar` menyalin data ke `siswa` (nama, sekolah, WA, kelas, email, program belajar, password) dalam satu transaksi, lalu menandai `bergabung=true` dan `bergabung_at=now()` pada `prospektus`. Akun Umum lama tetap aktif agar histori login/submission tidak terputus.
8. **Detail.** `GET /api/v1/participants/{id}/detail` dan `GET /api/v1/prospektus/{id}` mengembalikan kredensial plaintext. Endpoint list tetap tidak mengembalikan hash maupun plaintext.
9. **UI.** Dialog detail di Buat Tryout/Kelola Peserta dan Kelola Siswa menampilkan Password/PIN. Baris Prospektus diklik membuka detail plus tombol `Daftarkan sebagai Siswa`; status `Bergabung` ditampilkan sebagai badge.
10. **Dokumentasi & gate.** OpenAPI, `db/README.md`, `db/schema.sql`, README agent, laporan sistem, test QA, status board, dan `REL-20` diperbarui; commit/push ke `cms-hanyadi`.

## Konsekuensi

- Migrasi `024` menyentuh skema dan memerlukan backup sebelum diterapkan.
- Plaintext kredensial peserta meningkatkan risiko jika database bocor; akses endpoint detail dibatasi `tryouts.manage` dan tidak dicatat ke log.
- `REL-15` tetap partial; `REL-20` dihitung terpisah dari `REL-19`.
- QA harus mengganti asumsi "PIN tidak bisa ditampilkan" pada ADR-008 poin 4 dan ADR-007 poin 25 dengan kontrak baru ADR-010.

## Alternatif yang Dipertimbangkan

- **Menambah flag `bergabung` pada `tryout_participants`**: ditolak pemilik karena ingin tabel `prospektus` fisik terpisah.
- **Menyimpan kredensial terenkripsi dengan kunci aplikasi**: ditolak karena pemilik memperbolehkan plaintext untuk peserta dan menginginkan tampilan langsung.
- **Menyimpan plaintext juga untuk user CMS**: ditolak; password CMS tetap hash scrypt.
