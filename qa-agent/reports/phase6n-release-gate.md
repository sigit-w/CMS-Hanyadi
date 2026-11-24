# Release Gate — REL-16 — Fase 6n: Manajemen Bimbel

| Field | Isi |
|---|---|
| Tanggal | 2026-11-24 |
| Task | QA-28 → REL-16 |
| Review ADR-006 | Disetujui QA tanpa blocker |
| Regresi | 132/132 pass, 0 fail |
| Bug P0/P1 aplikasi | 0 |
| **Keputusan QA** | **GO** |
| **Keputusan PM** | **GO** |

## Alasan Keputusan

BE-31, FE-28, dan QA-28 selesai. Grup `Manajemen Bimbel` tampil dengan `Kelola Siswa` lalu `Kelola Program Belajar`; item lama sudah dihapus dari `Manajemen Tryout` dan `Setting`. Rute baru berfungsi dan rute lama tetap menjadi alias. Permission serta kontrak API tidak berubah. Regresi 132/132 lolos tanpa OOM, produksi sehat, dan tidak ada bug P0/P1.

## Status Gate

| Syarat | Status | Bukti |
|---|---|---|
| Review ADR-006 sebelum rilis | pass | `qa-agent/reports/phase6n-report.md` |
| BE-31 konfirmasi kontrak & permission | pass | DB `program_belajar.manage`/`tryouts.manage`; endpoint `401` tanpa cookie; guard di source |
| FE-28 grup/menu/rute baru | pass | `App.jsx`; N-01..N-03; bundle `index-CXNjTfX_.js` |
| Tidak ada perubahan schema/API | pass | Tidak ada migrasi baru; kontrak OpenAPI tidak berubah |
| RBAC tidak berubah | pass | A-12/A-13 dengan `program_belajar.manage` ditambahkan ke ekspektasi |
| Alias rute lama | pass | N-02; `#/tryouts/peserta` dan `#/program-belajar` tidak lagi sebagai menu |
| Marker QA diselaraskan | pass | P5-14, A-12, S-17 diperbarui; `nav-bimbel.mjs` masuk `npm test` |
| Regresi penuh serial, heap 128 MB | pass | 132/132; 0 fail; tanpa OOM |
| Build FE heap 256 MB | pass | `index-CXNjTfX_.js` 272,82 kB terlayani nginx CMS |
| Health produksi | pass | API/presentation `200`, CMS `200`, tryout `200`, `/auth/me` `401` |
| Service aktif | pass | `bank-soal-api`, `bank-soal-presentation`, nginx active |
| Fixture QA bersih | pass | `qa_%@qa.test` = 0; contributors/roles/mapels QA = 0 |
| 0 bug P0/P1 | pass | Laporan QA Fase 6n |

## Catatan Rilis

- Deploy hanya menyentuh artifact frontend; backend tidak perlu restart karena tidak ada perubahan kode atau konfigurasi.
- `REL-15` (Fase 6m) tetap berstatus menunggu regresi penuh; gate ini berdiri sendiri.
- Rollback: kembalikan `frontend-agent/dist` ke bundle sebelumnya; nginx menyajikan direktori tersebut langsung, sehingga tidak perlu reload untuk perubahan aset.
- Perubahan source masih berada di working tree dan belum di-commit dalam sesi ini; artifact produksi sudah diperbarui oleh build FE.
