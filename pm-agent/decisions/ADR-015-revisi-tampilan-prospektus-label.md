# Decision Log — ADR-015

| Field | Isi |
|---|---|
| ID | ADR-015 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | UI-REVISI |
| Melanjutkan | `REL-24`; Fase 6 dan `REL-01…REL-24` tidak dibuka ulang |

## Konteks

Pemilik melaporkan dua masalah tampilan:

1. Di halaman Prospektus, kolom pencarian dan informasi jumlah berada di baris berbeda sehingga terlihat tidak sejajar.
2. Beberapa label form masih diawali nomor urut, misalnya `1. Nama Lembar Soal` dan `5. Jadwal`.
3. Judul **Daftar Prospektus** dan tombol **Muat ulang** dianggap berlebih pada kartu daftar.

## Keputusan

1. Halaman Prospektus menempatkan input pencarian dan badge jumlah data dalam satu baris flex yang sejajar. Jumlah data mengikuti hasil filter (`visible.length`).
2. Judul **Daftar Prospektus**, tombol **Muat ulang**, dan `CardHeader` dihapus; `CardContent` memakai padding atas penuh.
3. Semua prefiks nomor pada label dihapus, mencakup form Lembar Soal (`Nama Lembar Soal`, `Mapel`, `Kode Lembar Soal`, `Cari Soal pada Mapel Ini`) dan Program Belajar (`Nama Program`, `Kelas`, `Biaya`, `Deskripsi Program`, `Jadwal`).
4. Tidak ada perubahan skema, API, migrasi, atau RBAC. Fase 7 tetap dibatalkan.

## Konsekuensi

- QA lama yang mencari marker bernomor dalam arsip `phase6l-report.md` bersifat historis dan tidak dipakai sebagai kontrak saat ini.
- Bundle CMS berubah ke `index-BouF6F0x.js`; regresi penuh tetap 179/179.
