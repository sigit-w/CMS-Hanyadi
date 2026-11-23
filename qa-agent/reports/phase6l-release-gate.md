# Release Gate — REL-12 / REL-13 / REL-14 — Fase 6l

| Field | Isi |
|---|---|
| Tanggal | 2026-11-23 |
| Task | QA-24 → REL-12; QA-25 → REL-13; QA-26 → REL-14 |
| Review ADR-005 | Disetujui QA tanpa blocker |
| Regresi | 126/126 pass, 0 fail |
| Bug P0/P1 aplikasi | 0 |
| **Keputusan QA** | **GO** |

## Alasan Keputusan

Implementasi BE-27/FE-24 lolos seluruh regresi, termasuk 8 skenario Lembar Soal setelah amendemen ADR-005 2026-11-23. Keputusan pemilik proyek dipenuhi: urutan create nama → mapel → kode otomatis per mapel → kode edit manual, soal tersembunyi sebelum mapel dipilih, picker terfilter mapel dengan popup detail, durasi angka bebas, soft delete, dan permission `question_sheets.manage`. Tidak ada bug P0/P1. Temuan P2 pada test harness sudah ditutup tanpa perubahan kode aplikasi.

## Status Gate

| Syarat | Status | Bukti |
|---|---|---|
| Review ADR-005 sebelum rilis | pass | `qa-agent/reports/phase6l-report.md` |
| Migrasi `016_lembar_soal.sql` terpasang | pass | Verifikasi objek DB `2|1|2` |
| API lembar soal + flag `sheets` | pass | L-01..L-07 |
| Generator per `mapels.code` `MTKA`/`IPAS`/`BIND` + kode edit manual | pass | L-01..L-03; ADR-005 amendemen D6 2026-11-23 |
| Validasi `mapel_code`, kode 12 karakter, durasi bebas, mapel aktif | pass | L-01..L-03 |
| Picker terfilter satu mapel, popup detail, & RBAC `question_sheets.manage` | pass | L-04..L-06, A-12/A-13; bundle `index-S-JiNOIO.js` |
| Soft delete & relasi soal tidak hilang | pass | L-07 |
| UI CMS `#/question-sheets` terbuild & terdeploy | pass | Vite 256 MB sukses; `index-S-JiNOIO.js` 258,03 kB dilayani nginx |
| Dashboard menampilkan flag kode lembar | pass | L-04 + inspeksi bundle/API |
| Regresi penuh serial, heap 128 MB, tanpa OOM | pass | 126/126; available 558→345 MB |
| Test harness stale dan cleanup diselaraskan | pass | QA6L-ENV-01/03/04 closed |
| Akun/mapel/soal/lembar QA sementara dibersihkan | pass | `qa6l%` = 0 mapel/user/role/lembar; user lama & file env temp sudah dihapus |
| Admin bootstrap login terverifikasi | pass | `admin` (id 1) berrole admin; `POST /auth/login` `200 roles=["admin"]` |

## Catatan Rilis

- `used_by_tryout` sengaja selalu `false` sampai fase integrasi tryout–lembar soal; ini keputusan ADR-005/D2, bukan bug.
- QA tidak menjalankan browser automation; validasi FE berupa build produksi + inspeksi bundle + kontrak API yang diuji.
- Akun admin QA sementara sudah dihapus; regresi akhir memakai `BOOTSTRAP_ADMIN_PASSWORD` dari `backend-agent/.env` dan login terverifikasi `200 roles=["admin"]`.
- Validasi FE tetap berupa build produksi + inspeksi bundle + kontrak API; alur popup detail divestifikasi lewat marker bundle dan perilaku picker yang diuji API.

## Amendemen D6 / Gate REL-13 — 2026-11-23

| Field | Isi |
|---|---|
| Task | QA-25 → REL-13 |
| Lingkup | Kode mapel tepat 4 karakter kapital sebagai satu-satunya prefix `LS-<KODE>-mmyy` |
| Regresi | 126/126 pass, 0 fail |
| Bug P0/P1 aplikasi | 0 |
| **Keputusan QA** | **GO** |

| Syarat D6 | Status | Bukti |
|---|---|---|
| Migrasi `017_mapel_code_4_char.sql` terpasang | pass | `MTKA/BIND/IPAS`; constraint `mapels_code_4_char` `^[A-Z0-9]{4}$` |
| Backend memakai `requireMapelCode()` dan generator langsung | pass | MP-01..MP-06, L-01..L-03; `MAPEL_PREFIXES`/`CUST` dihapus |
| Frontend Kelola Mapel 4 kapital + label diselaraskan | pass | `maxLength={4}`, pattern `[A-Z0-9]{4}`; bundle `index-S-JiNOIO.js` |
| Filter, picker, tryout, dan regresi lintas modul konsisten | pass | 126/126; QA6L-ENV-04 closed |
| Fixture/cleanup produksi bersih | pass | `qa%` mapel/user/role/lembar = 0 |
| Health produksi | pass | API `200` DB up, CMS `200`, `bank-soal-api.service`/nginx active |

## Amendemen D7 / Gate REL-14 — 2026-11-23

| Field | Isi |
|---|---|
| Task | QA-26 → REL-14 |
| Lingkup | Filter `question_type` di Daftar Soal dan picker Lembar Soal |
| Regresi | 129/129 pass, 0 fail |
| Bug P0/P1 aplikasi | 0 |
| **Keputusan QA** | **GO** |

| Syarat D7 | Status | Bukti |
|---|---|---|
| Backend `GET /questions` & picker mendukung `question_type` | pass | S-09a/S-09b, L-06a |
| Nilai di luar `QUESTION_TYPES` ditolak | pass | `400 VALIDATION_ERROR` di kedua endpoint |
| Filter dapat digabung dengan mapel/status/search | pass | S-09a (mapel + tipe), L-06a (mapel + tipe) |
| UI Daftar Soal & picker Lembar Soal memiliki dropdown tipe soal | pass | `index-BxuKDQvd.js`; marker `Semua tipe` di bundle produksi |
| Build/deploy hemat memori tanpa OOM | pass | Vite 256 MB, regresi serial 128 MB, available ≈ 528 MB |
| Regresi penuh & 0 bug P0/P1 | pass | 129/129; QA7-ENV-01 closed (env QA, bukan aplikasi) |
| Health produksi | pass | API `200` DB up, CMS menyajikan hash terbaru |

## Rollback Singkat

- Hentikan fitur dari UI dengan mencabut `question_sheets.manage` dari role `admin`/`editor` bila diperlukan; API langsung `403`.
- Rollback kode: deploy ulang artifact CMS/API REL-10.
- Rollback skema (hati-hati, menghapus data lembar soal):

  ```sql
  DROP TABLE IF EXISTS public.question_sheet_questions;
  DROP TABLE IF EXISTS public.question_sheets;
  DELETE FROM public.permissions WHERE code = 'question_sheets.manage';
  DELETE FROM public.role_permissions rp
    USING public.permissions p WHERE rp.permission_id = p.id AND p.code = 'question_sheets.manage';
  ```

## Tanda Tangan

QA: **GO** untuk Fase 6l. REL-12: **GO** untuk implementasi awal; REL-13: **GO** untuk amendemen D6; REL-14: **GO** untuk amendemen D7, 2026-11-23.
