# Release Gate — REL-20 — Fase 6r: Perubahan Flow Tryout

| Field | Isi |
|---|---|
| Tanggal | 2026-11-24 |
| Task | PM-20 → BE-35 → FE-32 → TRY-14 → QA-32 → DOC-06R → REL-20 |
| Regresi | 162/162 pass, 0 fail |
| Bug P0/P1 aplikasi | 0 |
| **Keputusan QA** | **GO** |
| **Keputusan PM** | **GO** |

## Alasan Keputusan

Seluruh acceptance criteria Fase 6r terpenuhi. Peserta Umum kini dibuat di `public.prospektus`, detail siswa/peserta menampilkan password atau PIN, baris Prospektus membuka detail dan formulir `Daftarkan sebagai Siswa`, serta pendaftaran menyalin data ke `public.siswa` dan menandai `bergabung=true`. Login Umum tetap berfungsi, password user CMS tetap scrypt. Migrasi `024` sudah diapply dengan backup dan uji idempotensi. Bug 500 pada endpoint detail ditemukan dan diperbaiki selama QA. Regresi penuh 162/162 lolos, build dan health produksi terverifikasi, dan tidak ada bug P0/P1.

## Status Gate

| Syarat | Status | Bukti |
|---|---|---|
| ADR-010 accepted & handoff | pass | `ADR-010-siswa-prospektus-kredensial.md`, handoff BE-35/FE-32/TRY-14/QA-32 |
| Migrasi `024` + backup | pass | `024_siswa_prospektus_kredensial.sql`, dump sebelum migrasi, uji idempotensi |
| BE-35 endpoint & OpenAPI | pass | PS-01..PS-05, PS-07; OpenAPI 3 path baru |
| FE-32 kredensial & detail | pass | PS-02, PS-06; `index-B10Efnkg.js` |
| TRY-14 alur login Umum/Siswa | pass | PS-01, PS-03; regresi login 200 |
| QA-32 PS-01..PS-07 | pass | `qa-agent/reports/phase6r-report.md` |
| Regresi penuh serial, heap 128 MB | pass | 162/162; 0 fail; tanpa OOM |
| Build FE heap 256 MB | pass | `index-B10Efnkg.js` 291,93 kB, gzip 82,08 kB |
| DOC-06R laporan sistem | pass | `frontend-agent/public/laporan-sistem/index.html` Fase 6r |
| Health produksi | pass | API 200; `bank-soal-api` active |
| Fixture QA bersih | pass | `after()` phase6r.mjs |
| 0 bug P0/P1 | pass | Laporan QA Fase 6r |

## Catatan Rilis

- Perubahan menyentuh migrasi DB, backend, CMS, OpenAPI, DB/backend/QA/PM docs, laporan sistem, dan QA suite.
- Commit dan push ke `origin/main` mengikuti gate ini.
- Rollback cepat: kembalikan kode/skema ke commit sebelumnya dan pulihkan dump `/tmp/opencode/bank_soal_db-pre024-*.dump` bila diperlukan; name view lama tetap tersedia hingga rollback schema dilakukan.
- `REL-15` (Fase 6m) tetap partial; `REL-16`, `REL-17`, `REL-18`, `REL-19`, dan `REL-20` GO.
