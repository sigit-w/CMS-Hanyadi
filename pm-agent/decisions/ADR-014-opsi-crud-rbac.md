# Decision Log — ADR-014

| Field | Isi |
|---|---|
| ID | ADR-014 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | RBAC-CRUD, DATA-PURGE |
| Melanjutkan | `REL-23`; Fase 6 dan `REL-01…REL-23` tidak dibuka ulang |

## Konteks

Pemilik meminta dua perubahan:

1. Data operasional soal, lembar soal, tryout, siswa, dan peserta dihapus beserta file upload gambar soal; user admin dan RBAC tetap dipertahankan.
2. Halaman Kelola Role menampilkan semua opsi CRUD per modul, bukan hanya permission agregat lama.

Permission aktif sebelum perubahan berjumlah 16. UI menyembunyikan `readiness.write`, sehingga pilihan yang terlihat tidak sesuai dengan isi database.

Keputusan pemilik:

1. Cakupan RBAC adalah **CRUD lengkap + legacy**; permission `*.manage` lama tidak dihapus.
2. Pemetaan role **mengikuti akses saat ini**, bukan perluasan wewenang.
3. File upload ikut dihapus.

## Keputusan

1. Migrasi `028_crud_permissions.sql` menambah 30 permission CRUD dan mempertahankan 16 permission lama, sehingga total menjadi 46 permission.
2. Permission baru mencakup `questions`, `question_sheets`, `tryouts`, `participants`, `mapels`, `roles`, `users`, dan `program_belajar`. Modul read-only (`cms`, `presentation`, `reports`, `tryout_reports`) tidak diubah.
3. `admin` menerima seluruh permission baru. `editor` menerima CRUD soal, lembar soal, dan program belajar. `validator`, `viewer`, dan `peserta` tidak berubah.
4. Backend tetap memakai `*.manage` lama sebagai guard; permission CRUD baru diekspos untuk konfigurasi role dan tidak memecah guard existing.
5. `RoleManagement.jsx` menampilkan seluruh permission dari `GET /api/v1/permissions`, termasuk `readiness.write`, dikelompokkan per prefix.
6. QA `A-12` diperbarui ke 46 kode permission. Dokumen status, skema, API, dan laporan sistem mengikuti angka tersebut.
7. Purge data memakai backup DB + upload terlebih dahulu, `DELETE` transaksional dari tabel turunan ke induk, dan verifikasi bahwa admin/RBAC/mapel/master tetap utuh. File upload dihapus setelah backup.
8. Fase 7 tetap dibatalkan; tidak ada ADR, backlog, handoff, atau perubahan infra Fase 7.

## Konsekuensi

- Role lama tetap berfungsi tanpa migrasi token; perubahan permission role langsung dibaca backend pada request berikutnya.
- Admin perlu menyimpan ulang role jika ingin mencentang permission CRUD baru; tombol **Pilih semua** kini mencakup seluruh permission.
- Data soal dan tryout kosong setelah eksekusi; QA berikutnya wajib membuat fixture sendiri dan membersihkannya.
