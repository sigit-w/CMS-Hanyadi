# Release Gate — REL-24

| Field | Isi |
|---|---|
| Tanggal | 2026-11-24 |
| Status | GO |
| Nama | Purge data operasional dan RBAC CRUD |
| Referensi | ADR-014, `rbac-crud-report.md` |

## Kriteria

| Kriteria | Status | Bukti |
|---|---|---|
| Backup DB dan upload sebelum perubahan | pass | dump + tar di `/tmp/opencode` |
| Data soal/lembar/tryout/siswa/peserta kosong | pass | verifikasi `count(*)` pasca-purge |
| User admin, role, permission, mapel, master tetap ada | pass | 1 admin, 5 role, 46 permission, 3 mapel |
| File upload terhapus | pass | direktori upload berisi 0 file |
| Permission CRUD tampil di Kelola Role | pass | `RoleManagement.jsx`, bundle `index-Bba7nOMD.js` |
| Guard `*.manage` lama tidak dipecah | pass | tidak ada perubahan middleware guard |
| Regresi penuh | pass | 179/179 |
| Build dan health produksi | pass | Vite 256 MB, API/presentation/CMS/tryout 200 |
| Commit dan push | pass | perubahan di-commit dan di-push ke `origin/main` |

Gate `REL-01…REL-23` tetap GO dan tidak dibuka ulang. Fase 7 tetap dibatalkan.
