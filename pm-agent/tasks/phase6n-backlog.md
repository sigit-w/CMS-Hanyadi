# Backlog — Fase 6n: Manajemen Bimbel

| Field | Isi |
|---|---|
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Sumber | Permintaan pemilik proyek 2026-11-24 |
| Status | ADR-006 `accepted`; BE-31/FE-28/QA-28 `done`; `REL-16` **GO** 2026-11-24; frontend terdeploy |
| Prioritas | P1 |

## Requirement Pemilik

1. Pindahkan menu dan halaman **Kelola Siswa** dari grup **Manajemen Tryout** ke menu tersendiri bernama **Manajemen Bimbel**.
2. Pindahkan menu **Kelola Program Belajar** dari grup **Setting** ke bawah menu **Manajemen Bimbel** tersebut.

## Evaluasi PM

- Permintaan murni perubahan navigasi CMS. Halaman yang dipakai tetap `PesertaManagement.jsx` dan `ProgramBelajarManagement.jsx`; tidak ada form field atau alur data baru.
- Tidak ada perubahan schema, endpoint, format respons, atau permission. Karena itu bekerja sama dengan BE tetap dicatat sebagai task tersendiri untuk memastikan kontrak tidak berubah dan dokumentasi tidak menyesatkan, bukan untuk menambah migrasi.
- QA perlu memperbarui marker menu karena label existing di test `P5-14` masih `Kelola Peserta`, sementara UI sudah memakai `Kelola Siswa` sejak commit `3597617`.
- Rute lama dipertahankan sebagai alias agar tidak ada tautan/bookmark yang rusak; rute baru dipakai sebagai menu utama.
- Perlu cek `free -h` sebelum/sesudah build frontend dan test QA; jalankan satu proses dengan heap dibatasi agar tidak OOM, mengikuti kebiasaan Fase 6l/6m.

## Keputusan & Definisi

| ID | Keputusan | Sumber |
|---|---|---|
| D1 | Grup baru bernama **Manajemen Bimbel** berisi dua item dengan urutan: `Kelola Siswa`, lalu `Kelola Program Belajar`. | Pemilik + PM |
| D2 | Rute kanonik `#/bimbel/siswa` dan `#/bimbel/program-belajar`; rute lama `#/tryouts/peserta` dan `#/program-belajar` tetap aktif sebagai alias. | PM (ADR-006) |
| D3 | Permission tetap `tryouts.manage` untuk Kelola Siswa dan `program_belajar.manage` untuk Kelola Program Belajar; tidak ada `bimbel.manage`. | PM (ADR-006) |
| D4 | Tidak ada migrasi database, endpoint baru, atau perubahan kontrak API; BE hanya verifikasi dan dokumentasi. | PM (ADR-006) |
| D5 | Aplikasi tryout dan presentation service tidak berubah; regresi difokuskan pada CMS dan marker navigasi QA. | PM (ADR-006) |

## Acceptance Criteria

- [x] Grup **Manajemen Bimbel** tampil di sidebar CMS dengan dua item: `Kelola Siswa` lalu `Kelola Program Belajar`.
- [x] `Kelola Siswa` tidak lagi tampil di grup **Manajemen Tryout**; `Kelola Program Belajar` tidak lagi tampil di grup **Setting**.
- [x] Menu memakai hash `#/bimbel/siswa` dan `#/bimbel/program-belajar`; hash lama tetap merender halaman yang sama lewat `ROUTE_ALIASES`.
- [x] Permission pembuka menu tidak berubah: `tryouts.manage` dan `program_belajar.manage`; user tanpa permission tersebut tetap tidak melihat menu terkait.
- [x] Backend mengonfirmasi endpoint `/api/v1/participants` dan `/api/v1/program-belajar` tidak berubah serta dokumentasi backend tidak menyatakan seolah-olah ada API/permission baru.
- [x] Test marker QA diselaraskan (`Kelola Siswa`, `Manajemen Bimbel`, rute baru) dan skenario negatif memastikan menu lama sudah tidak ada di grup lamanya.
- [x] Build frontend produksi sukses tanpa OOM; regresi QA lolos, 0 bug P0/P1, lalu gate `REL-16` diputuskan oleh PM bersama QA.

## Serah Terima

| Task ID | Owner | Prioritas | Dependency | Status |
|---|---|---|---|---|
| PM-16 | PM | P1 | - | done — requirement, ADR-006, backlog, dan handoff diterbitkan |
| BE-31 | Backend | P1 | PM-16 | done — kontrak & permission terverifikasi, tanpa perubahan kode backend |
| FE-28 | Frontend | P1 | PM-16 | done — grup/menu/rute baru di `App.jsx`, bundle `index-CXNjTfX_.js` |
| QA-28 | QA | P1 | BE-31, FE-28 | done — marker diselaraskan, 3 skenario baru, regresi 132/132 |
| REL-16 | PM | P1 | QA-28 | done — **GO** 2026-11-24; deploy frontend produksi |

## Handoff Diterbitkan

- `pm-agent/decisions/ADR-006-manajemen-bimbel.md` — dasar keputusan, status `accepted`.
- `pm-agent/tasks/handoff-BE31.md` — konfirmasi kontrak API dan dokumentasi backend.
- `pm-agent/tasks/handoff-FE28.md` — grup, menu, dan rute CMS.
- `pm-agent/tasks/handoff-QA28.md` — marker test, skenario navigasi, regresi, dan input `REL-16`.
- Batasan memori berlaku untuk FE-28 dan QA-28: cek `free -h` sebelum/sesudah, build dengan heap dibatasi, jangan menjalankan test dan build paralel.
- Hasil akhir 2026-11-24: regresi 132/132 pass, 0 bug P0/P1, bundle `index-CXNjTfX_.js` terlayani CMS, health API/presentation/CMS/tryout `200`, `REL-16` **GO**. Bukti di `qa-agent/reports/phase6n-report.md` dan `phase6n-release-gate.md`.
