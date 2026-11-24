# Release Gate — REL-17 — Fase 6o: Alur Buat Tryout & Peserta Umum

| Field | Isi |
|---|---|
| Tanggal | 2026-11-24 |
| Task | QA-29A → BE-32 → FE-29/TRY-12 → QA-29 → REL-17 |
| Review ADR-007 | Disetujui QA dengan 2 catatan perbaikan; keduanya selesai |
| Regresi | 142/142 pass, 0 fail |
| Bug P0/P1 aplikasi | 0 |
| **Keputusan QA** | **GO** |
| **Keputusan PM** | **GO** |

## Alasan Keputusan

BE-32, FE-29, TRY-12, dan QA-29 selesai. Form Buat Tryout memakai urutan baru dan lembar soal sesuai mapel; tryout dapat dibuat tanpa peserta; Peserta Umum dibuat dengan PIN 9 digit dan login Nama + PIN; halaman tryout menampilkan label serta aset versi baru. Payload lama `question_ids` dan endpoint legacy `/tryout-sessions` tetap berfungsi. Dua bug P1 yang ditemukan saat QA sudah diperbaiki melalui migrasi `022` dan penyesuaian endpoint legacy. Regresi 142/142 lolos tanpa OOM, produksi sehat, dan tidak ada bug P0/P1.

## Status Gate

| Syarat | Status | Bukti |
|---|---|---|
| Review ADR-007 sebelum DDL | pass | `qa-agent/reports/phase6o-report.md`; dry-run `BEGIN … ROLLBACK` |
| Migrasi 020/021/022 idempoten & terpasang | pass | `email/password_hash/pin_hash` nullable; `start_at/end_at`; `tryout_session_sheets`; migration check = 4 |
| BE-32 kontrak & auth | pass | U-01..U-05, U-07, U-08; `/auth/me` fallback Nama; resolver Umum→Siswa→CMS |
| FE-29 urutan form & popup | pass | U-06; bundle `index-BWwbQxdi.js` terlayani CMS |
| TRY-12 label & versi aset | pass | U-09; `styles.css?v=11`, `app.js?v=12` terlayani |
| Peserta boleh kosong | pass | U-07; `participant_ids: []` sukses |
| Backward compatibility | pass | U-08; J-10; TR-01..TR-06 |
| RBAC tidak berubah | pass | A-12/A-13; `tryouts.manage`, `tryout.access`, `presentation.read`, `tryout_reports.read` |
| OpenAPI & dokumentasi | pass | U-10; `backend-agent/openapi/openapi.yaml`, `db/README.md`, README agent, status board |
| Regresi penuh serial, heap 128 MB | pass | 142/142; 0 fail; tanpa OOM |
| Build FE heap 256 MB | pass | `index-BWwbQxdi.js` 276,95 kB |
| Health produksi | pass | API/presentation `200`; CMS `200`; tryout `200` |
| Service aktif | pass | `bank-soal-api`, `bank-soal-presentation`, nginx active |
| Fixture QA bersih | pass | `qa_email=0`; `qa_umum=0`; `qa_tryout=0` |
| 0 bug P0/P1 | pass | Laporan QA Fase 6o |

## Catatan Rilis

- Deploy menyentuh DB (migrasi 020/021/022), kode backend (restart), bundle CMS, dan file statis tryout.
- Backup sebelum migrasi: `/tmp/opencode/bank_soal_fase6o_pre_20261124_085046.sql`.
- Rollback cepat UI: kembalikan `frontend-agent/dist` ke bundle sebelumnya dan `tryout-agent/index.html` ke versi aset lama. Rollback DB memerlukan penghapusan objek Fase 6o atau restore dari backup; lakukan hanya jika diperlukan.
- `REL-15` (Fase 6m) tetap partial; gate ini berdiri sendiri. `REL-16` (Fase 6n) tetap GO.
- PIN Peserta Umum hanya ditampilkan sekali saat pembuatan; tidak dapat diambil ulang karena hanya hash yang disimpan.
- Perubahan source akan di-commit dan di-push ke `origin/main` setelah gate ini ditandatangani.
