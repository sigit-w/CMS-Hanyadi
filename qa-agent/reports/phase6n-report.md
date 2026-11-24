# Laporan QA Fase 6n — Manajemen Bimbel

| Field | Isi |
|---|---|
| Tanggal | 2026-11-24 |
| Task | QA-28 / REL-16 |
| Desain | ADR-006 (accepted) |
| Lingkungan | API produksi `127.0.0.1:8082`, CMS `https://cms.hanyadi.web.id`, DB produksi |
| Hasil | **132 test, 132 pass, 0 fail** (129 baseline + 3 skenario N-01..N-03) |
| Bug P0/P1 aplikasi | 0 |
| Rekomendasi | Lihat `qa-agent/reports/phase6n-release-gate.md` |

## Review ADR-006

Hasil review: **disetujui QA tanpa blocker**.

- D1 grup `Manajemen Bimbel` berisi `Kelola Siswa` lalu `Kelola Program Belajar`; keduanya tidak lagi berada di grup lama.
- D2 rute kanonik `#/bimbel/siswa` dan `#/bimbel/program-belajar`; rute lama tetap sebagai alias, bukan menu.
- D3 permission tidak berubah: `tryouts.manage` dan `program_belajar.manage`; tidak ada `bimbel.manage`.
- D4 tidak ada migrasi/endpoint baru; BE-31 hanya verifikasi dan dokumentasi.
- D5 tryout dan presentation service tidak berubah.

## Lingkungan & Eksekusi

- Build FE: `NODE_OPTIONS=--max-old-space-size=256 npm run build` → sukses, 1611 modul, `index-CXNjTfX_.js` 272,82 kB (gzip 78,57 kB), `index-DTTFvXix.css` 20,96 kB, 3,65 s.
- Test baru: `NODE_OPTIONS=--max-old-space-size=128 node --test qa-agent/tests/nav-bimbel.mjs` → 3/3 pass.
- Regresi penuh serial (password tidak dicatat): `set -a; source backend-agent/.env; set +a; QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD" NODE_OPTIONS=--max-old-space-size=128 npm test`.
- Memory: available 658 MiB sebelum build → 674 MiB sesudah build → 593 MiB setelah regresi; swap 732→767→724 MiB. Tidak ada OOM.
- Kredensial bootstrap dari `backend-agent/.env` dipakai untuk login admin; tidak ada akun QA sementara baru.

## Detail Test

| Grup | Jumlah | Hasil |
|---|---:|---|
| Regresi existing (MVP, Phase5, Phase6, 6j, 6l, dll.) | 129 | pass |
| Navigasi baru `nav-bimbel.mjs` | 3 | pass |
| **Total** | **132** | **pass** |

Skenario baru:

| ID | Cakupan | Hasil |
|---|---|---|
| N-01 | Grup `Manajemen Bimbel` berisi dua menu dengan urutan benar dan hash kanonik | pass |
| N-02 | Alias `/tryouts/peserta` dan `/program-belajar`, render memakai rute baru | pass |
| N-03 | Item tidak lagi berada di `Manajemen Tryout` / `Setting` | pass |

## Penyesuaian Test Harness

- `phase5.mjs/P5-14`: `Kelola Peserta` → `Kelola Siswa`; tambah `Manajemen Bimbel`, `#/bimbel/siswa`, `#/bimbel/program-belajar`; hapus marker hash lama/`#/questions/new` yang sudah tidak dirender.
- `auth-rbac.mjs/A-12`: ekspektasi permission ditambah `program_belajar.manage` sesuai migrasi `018`.
- `mvp-smoke.mjs/S-17`: `UI_BASE` default diubah dari API ke `https://cms.hanyadi.web.id` karena static CMS tidak lagi dilayani akar API (INF-05).
- `backend-agent/package.json`: `nav-bimbel.mjs` dimasukkan ke script `npm test`.

## Verifikasi Produksi

| Item | Hasil |
|---|---|
| `GET https://cms.hanyadi.web.id/` | `200`, menyajikan `assets/index-CXNjTfX_.js` |
| `GET /api/v1/auth/me` tanpa cookie | `401` |
| `GET /health` API | `200` |
| `GET /health` presentation | `200` |
| `GET https://tryout.hanyadi.web.id/` | `200` |
| Service `bank-soal-api`, `bank-soal-presentation`, nginx | active |
| Pembersihan fixture | `tryout_participants` `qa_%@qa.test` = 0; contributors/roles/mapels QA = 0 |

## Catatan

- QA tidak menjalankan browser automation; validasi FE memakai assertion source `App.jsx`, marker bundle, dan kontrak API.
- Satu sisa fixture lama `qa_siswa_22971608@qa.test` (id 85, nonaktif, 2026-11-23) dihapus saat QA-28; bukan data produksi.
- Tidak ada perubahan schema atau endpoint; gate ini tidak menggantikan `REL-15` yang masih menunggu regresi penuh Fase 6m.
