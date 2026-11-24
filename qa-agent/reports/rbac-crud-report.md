# Laporan QA — Purge Data & RBAC CRUD

| Field | Isi |
|---|---|
| Tanggal | 2026-11-24 |
| Cakupan | Penghapusan data operasional, file upload, dan opsi CRUD Kelola Role |
| Referensi | ADR-014 |

## Eksekusi

- Backup DB: `/tmp/opencode/bank_soal_db-pre-purge-20261124-140728.dump`.
- Backup upload: `/tmp/opencode/uploads-pre-purge-20261124-140728.tar.gz`.
- Purge memakai `DELETE` transaksional dari tabel turunan ke induk; service dihentikan saat eksekusi.
- Migration `028_crud_permissions.sql` diterapkan dengan `psql -1`.
- Upload aktif dikosongkan; direktori tetap ada.
- QA dijalankan dengan fixture sementara 2 soal, 1 lembar, dan 1 tryout aktif; fixture dihapus lagi setelah pengujian.

## Hasil

| Pemeriksaan | Hasil |
|---|---|
| Syntax `auth-rbac.mjs` | lolos |
| Regresi penuh | 179/179 lolos, 0 gagal |
| A-12 permission | 46 kode sesuai DB |
| Build CMS | sukses, `index-Bba7nOMD.js` |
| Health API/presentation | 200 |
| Health CMS/tryout via HTTPS | 200 |
| Bundle production | grup `Siswa & Peserta`, `Program Belajar`, dan teks CRUD hadir |

## State Akhir

| Objek | Jumlah |
|---|---:|
| questions | 0 |
| question_sheets | 0 |
| tryout_sessions | 0 |
| siswa | 0 |
| prospektus | 0 |
| permissions | 46 |
| role_permissions | 76 |
| admin user | 1 |
| file upload | 0 |

Log QA lengkap: `/tmp/opencode/qa-rbac.log`.
