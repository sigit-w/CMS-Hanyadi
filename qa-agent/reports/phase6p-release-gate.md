# Release Gate — REL-18 — Fase 6p: Peserta Tryout, Detail, Hapus Relasi & Prospektus

| Field | Isi |
|---|---|
| Tanggal | 2026-11-24 |
| Task | PM-18 → BE-33 → FE-30/TRY-13 → QA-30 → REL-18 |
| Regresi | 150/150 pass, 0 fail |
| Bug P0/P1 aplikasi | 0 |
| **Keputusan QA** | **GO** |
| **Keputusan PM** | **GO** |

## Alasan Keputusan

Seluruh acceptance criteria Fase 6p terpenuhi. Migrasi `023` terpasang dan idempoten; endpoint hapus relasi membedakan Peserta Umum dan Siswa sesuai ADR-008; draft Umum yang dikeluarkan juga masuk Prospektus lewat endpoint prospek mandiri. CMS menampilkan picker siswa, detail baris, trash icon, dan menu Prospektus; label `Kelola Siswa Tryout` sudah diganti. Regresi penuh 150/150 lolos tanpa OOM, layanan produksi sehat, bundle CMS dan aset tryout terverifikasi, serta tidak ada bug P0/P1.

## Status Gate

| Syarat | Status | Bukti |
|---|---|---|
| ADR-008 accepted & handoff | pass | `pm-agent/decisions/ADR-008-peserta-tryout-dan-prospektus.md`, handoff BE-33/FE-30/TRY-13/QA-30 |
| Migrasi `023` idempoten & terpasang | pass | PR-01; kolom, constraint, index |
| BE-33 kontrak & dokumentasi | pass | PR-01, PR-04..PR-06; OpenAPI, DB doc, backend README |
| FE-30 UI & bundle | pass | PR-02, PR-03, PR-06; `index-CIWSCIZ4.js` |
| TRY-13 non-regresi | pass | `git status --short -- tryout-agent` bersih; U-04/U-09/T-01..T-08 |
| QA-30 PR-01..PR-08 | pass | `qa-agent/reports/phase6p-report.md` |
| Regresi penuh serial, heap 128 MB | pass | 150/150; 0 fail; tanpa OOM |
| Build FE heap 256 MB | pass | `index-CIWSCIZ4.js` 285,00 kB, gzip 81,12 kB |
| Health produksi | pass | API/presentation 200; CMS/tryout 200 |
| Service aktif | pass | `bank-soal-api`, `bank-soal-presentation`, nginx aktif |
| Fixture QA bersih | pass | `after()` phase6p.mjs menghapus tryout & participant uji |
| 0 bug P0/P1 | pass | Laporan QA Fase 6p |

## Catatan Rilis

- Deploy menyentuh DB (migrasi `023`), kode backend (restart), dan bundle CMS; `tryout-agent` tidak berubah.
- Backup sebelum migrasi: `/tmp/opencode/bank_soal_fase6p_pre_<timestamp>.fc`.
- Rollback cepat UI: kembalikan `frontend-agent/dist` ke bundle `index-BWwbQxdi.js`. Rollback DB memerlukan penghapusan objek Fase 6p atau restore backup; lakukan hanya jika diperlukan.
- `REL-15` (Fase 6m) tetap partial; `REL-16` dan `REL-17` tetap GO.
- Perubahan akan di-commit dan di-push ke `origin/main`.
