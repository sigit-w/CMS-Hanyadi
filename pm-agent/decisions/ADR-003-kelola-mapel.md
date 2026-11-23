# Decision Log — ADR-003

| Field | Isi |
|---|---|
| ID | ADR-003 |
| Tanggal | 2026-11-22 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | BE-24, FE-20, QA-21, REL-09 |

## Konteks

Setelah tabel `categories` direname menjadi `mapels` (ADR lanjutan migrasi `012`), daftar mapel masih bersifat statis: tiga kode di-hardcode di validasi backend, constraint CHECK database, dan OpenAPI. Pemilik proyek meminta halaman CRUD Mapel di CMS pada grup **Setting** agar admin dapat menambah, mengubah, menonaktifkan, dan menghapus mapel tanpa perubahan kode.

## Keputusan

1. **Kode mapel menjadi identifier dinamis.** Awalnya format `^[a-z][a-z0-9_-]{1,31}$` divalidasi di database (migrasi `013`) dan backend dengan seed `matematika`, `bahasa_indonesia`, `ipas`. Format ini **digantikan ADR-005/D6**: kode wajib unik tepat 4 karakter `^[A-Z0-9]{4}$` (`MTKA/BIND/IPAS` untuk seed) lewat migrasi `017`.
2. **Validasi keberadaan mapel tetap server-side.** Pembuatan soal, update soal, import, dan pembuatan tryout menolak kode yang tidak ada atau tidak aktif; tidak lagi memakai enum statis.
3. **Permission baru `mapels.manage`**, default hanya role `admin`. Endpoint write (`POST`, `PUT`, `DELETE`) dan opsi `include_inactive=true` memakai permission ini. Endpoint baca dasar tetap tersedia untuk `questions.read` agar form soal tidak berubah.
4. **Hapus bersifat hard delete dengan guard relasi.** Mapel yang masih memiliki soal aktif atau tryout ditolak dengan `409`. Nonaktif mapel tersedia lewat `PUT is_active=false` untuk menghentikan pemakaian tanpa menghapus histori.
5. **Menu CMS `#/mapels`** ditempatkan pada grup Setting bersama Kelola Role dan Laporan Sistem. UI menampilkan jumlah soal dan tryout agar admin mengetahui dampak sebelum menghapus.
6. **OpenAPI, README, QA, dan laporan sistem** diperbarui mengikuti kontrak baru. QA menambah enam skenario CRUD/permission.

## Konsekuensi

- Migrasi `013_mapel_crud.sql` wajib diterapkan sebelum endpoint/UI dipakai; `db/schema.sql`, `db/README.md`, `backend-agent/README.md`, dan `frontend-agent/README.md` ikut diperbarui.
- Role admin tidak boleh kehilangan `mapels.manage` melalui halaman Kelola Role (guard `adminRequiredPermissions`).
- Jumlah permission bertambah dari 13 menjadi 14 dan pemetaan role-permission dari 30 menjadi 31.
- Perubahan kode mapel tidak memutus relasi karena FK memakai `mapels.id`; namun kode lama yang dipakai filter/import berhenti dikenali setelah diubah.
- Risiko: data uji mapel harus dihapus oleh QA setelah pengujian agar seed tetap tiga mapel.

## Alternatif yang Dipertimbangkan

- **Menggunakan `questions.write` untuk CRUD mapel**: ditolak karena editor soal akan bisa mengubah master data yang dipakai seluruh sistem.
- **Menggunakan `roles.manage`**: ditolak karena mencampurkan administrasi akses dengan master data akademik.
- **Soft delete saja**: ditolak karena daftar mapel akan menumpuk; nonaktif sudah tersedia, sedangkan hapus permanen dibatasi hanya untuk mapel tanpa relasi.
