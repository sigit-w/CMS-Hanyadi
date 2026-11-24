# Backlog Fase 6p — Peserta Tryout, Detail, Hapus Relasi & Prospektus

Tanggal: 2026-11-24  
Sumber keputusan: `pm-agent/decisions/ADR-008-peserta-tryout-dan-prospektus.md`  
Gate: `REL-18`

## Requirement Pemilik

| # | Requirement |
|---|---|
| R1 | Halaman Buat Tryout secara default tidak menampilkan data siswa yang diinputkan dari menu Kelola Siswa. |
| R2 | Tombol `Tambah Peserta Tryout` membuka dua pilihan: `A. Peserta Didik` dan `B. Peserta Umum`; pilihan A menampilkan daftar siswa yang bisa dipilih user. |
| R3 | Setelah nama peserta tryout dilampirkan, klik baris tersebut menampilkan detail siswa/peserta. |
| R4 | Daftar peserta tidak memakai checkbox; gunakan icon keranjang sampah untuk menghapus data peserta dari tryout. |
| R5 | Peserta Umum yang dihapus dari tryout disimpan datanya ke halaman Prospektus. |
| R6 | Peserta Siswa yang dihapus dari tryout hanya terlepas dari tryout; data di tabel siswa tidak dihapus atau dinonaktifkan. |
| R7 | Buat halaman/menu baru **Prospektus** di bawah grup **Manajemen Tryout**. |
| R8 | Label `Kelola Siswa Tryout` menjadi `Kelola Siswa`. |
| R9 | Deploy, commit, dan push ke GitHub `cms-hanyadi`. |

## Breakdown Task

| Task ID | Owner | Prioritas | Dependency | Ringkasan |
|---|---|---|---|---|
| PM-18 | PM | P0 | - | ADR-008 accepted; backlog dan handoff diterbitkan |
| BE-33 | Backend | P0 | ADR-008 | Migrasi `023`, endpoint `DELETE /tryouts/{id}/participants/{participantId}`, `POST /participants/{id}/prospek`, `GET /prospektus`, filter `?prospek=`, OpenAPI & DB doc |
| FE-30 | Frontend | P0 | BE-33 (kontrak) | Picker siswa, detail baris, trash icon, halaman/menu Prospektus, label `Kelola Siswa`, marker QA, build |
| TRY-13 | Tryout | P1 | BE-33 (kontrak) | Verifikasi tidak ada perubahan kode; smoke login Umum & Siswa |
| QA-30 | QA | P0 | BE-33, FE-30, TRY-13 | `PR-01..PR-08`, regresi penuh, laporan & gate |
| REL-18 | PM | P0 | QA-30 | Deploy produksi, verifikasi health/aset, commit/push |

## Acceptance Criteria

### BE-33
- [x] Migrasi `023_prospektus_peserta_umum.sql` idempoten dan terpasang.
- [x] `DELETE /tryouts/{id}/participants/{participantId}` mengembalikan `404` untuk tryout/peserta/relasi tidak ditemukan.
- [x] Menghapus Peserta Umum: relasi hilang, `proses=true`, `prospek_at` terisi, `is_active=false`, sesi aktif dicabut.
- [x] Menghapus Peserta Siswa: relasi hilang, baris participant tidak berubah sama sekali.
- [x] `POST /participants/{id}/prospek` menandai Umum dari draft tryout dan menolak Siswa dengan `400`.
- [x] `GET /prospektus` hanya mengembalikan Peserta Umum ber-`prospek=true`.
- [x] `GET /participants` tanpa query tetap kompatibel; `?prospek=true|false` bekerja.
- [x] OpenAPI dan `db/README.md` sesuai implementasi.

### FE-30
- [x] Daftar `Peserta Tryout` kosong secara default dan siswa tidak tampil sebelum dipilih lewat `A. Peserta Didik`.
- [x] Dialog A menampilkan siswa aktif dengan tombol `Pilih`; dialog B mempertahankan popup Umum Fase 6o.
- [x] Klik baris peserta terlampir membuka dialog detail.
- [x] Tidak ada checkbox pada daftar peserta terlampir; tombol `Trash2` tersedia per baris.
- [x] Menghapus Umum memunculkan notifikasi masuk Prospektus; menghapus Siswa memunculkan notifikasi data siswa tetap tersimpan.
- [x] Menu `#/tryouts/prospektus` tampil di grup Manajemen Tryout dengan tabel Prospektus.
- [x] Judul halaman Kelola Siswa sudah `Kelola Siswa`.
- [x] Build produksi sukses dengan `NODE_OPTIONS=--max-old-space-size=256`.

### TRY-13
- [x] Tidak ada perubahan source `tryout-agent`.
- [x] Login Nama + PIN untuk Umum dan Email + Password untuk Siswa masih berfungsi.

### QA-30
- [x] `PR-01..PR-08` lolos.
- [x] Regresi penuh `npm test` lolos tanpa OOM.
- [x] `qa-agent/reports/phase6p-report.md` dan `phase6p-release-gate.md` tersedia dengan `REL-18 GO`.

### REL-18
- [x] Backend health `200`, frontend assets terdeploy, Prospektus dapat diakses admin.
- [x] Commit dibuat dan `origin/main` terverifikasi setelah push.

## Catatan Eksekusi

- Cek `free -h` sebelum test/build.
- Test: `NODE_OPTIONS=--max-old-space-size=128 npm test`.
- Build: `NODE_OPTIONS=--max-old-space-size=256 npm run build`.
- Backup DB sebelum migrasi `023`.
- Jangan menjalankan dua build/test besar bersamaan.
