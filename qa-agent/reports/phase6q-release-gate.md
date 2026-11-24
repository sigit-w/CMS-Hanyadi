# Release Gate — REL-19 — Fase 6q: Kelola Peserta dari Daftar Tryout

| Field | Isi |
|---|---|
| Tanggal | 2026-11-24 |
| Task | PM-19 → BE-34 → FE-31 → QA-31 → DOC-06Q → REL-19 |
| Regresi | 155/155 pass, 0 fail |
| Bug P0/P1 aplikasi | 0 |
| **Keputusan QA** | **GO** |
| **Keputusan PM** | **GO** |

## Alasan Keputusan

Seluruh acceptance criteria Fase 6q terpenuhi. Helper text yang dilarang sudah hilang dari source dan bundle. Popup **Kelola Peserta** kini menampilkan daftar peserta serta tombol `A. Peserta Didik` dan `B. Peserta Umum` dengan alur yang sama seperti form Buat Tryout, dan hasilnya langsung tersimpan lewat endpoint baru `POST /api/v1/tryouts/{id}/participants`. Endpoint idempoten, menolak peserta nonaktif/prospek, serta tidak menambah migrasi. Regresi penuh 155/155 lolos tanpa OOM, build dan health produksi terverifikasi, laporan sistem sudah diperbarui, dan tidak ada bug P0/P1.

## Status Gate

| Syarat | Status | Bukti |
|---|---|---|
| ADR-009 accepted & handoff | pass | `ADR-009-kelola-peserta-tryout.md`, handoff BE-34/FE-31/QA-31 |
| BE-34 kontrak & dokumentasi | pass | QP-01; OpenAPI, backend README |
| FE-31 UI & bundle | pass | QP-02, QP-05; `index-D0au7v9d.js` |
| Helper text dihapus | pass | QP-02, QP-05; source & bundle bersih |
| Popup A/B target `manage` | pass | QP-02, QP-03, QP-04 |
| Endpoint attach idempoten & validasi | pass | QP-03, QP-05 |
| Trash/Prospektus tidak regresi | pass | QP-04; PR-04..PR-06 remains |
| QA-31 QP-01..QP-05 | pass | `qa-agent/reports/phase6q-report.md` |
| Regresi penuh serial, heap 128 MB | pass | 155/155; 0 fail; tanpa OOM |
| Build FE heap 256 MB | pass | `index-D0au7v9d.js` 285,98 kB, gzip 81,30 kB |
| DOC-06Q laporan sistem | pass | `frontend-agent/public/laporan-sistem/index.html` Fase 6q |
| Health produksi & aset | pass | API/presentation 200; CMS/tryout 200; aset `?v=11`/`?v=12` |
| Fixture QA bersih | pass | `after()` phase6q.mjs |
| 0 bug P0/P1 | pass | Laporan QA Fase 6q |

## Catatan Rilis

- Tidak ada perubahan skema DB; backend di-restart setelah perubahan source.
- Perubahan menyentuh backend, CMS, OpenAPI, backend README, laporan sistem, QA, PM docs, dan akan di-commit ke `origin/main`.
- Rollback cepat UI: kembalikan bundle CMS ke `index-CIWSCIZ4.js` dan kode backend ke commit sebelumnya.
- `REL-15` (Fase 6m) tetap partial; `REL-16`, `REL-17`, `REL-18`, dan `REL-19` GO.
