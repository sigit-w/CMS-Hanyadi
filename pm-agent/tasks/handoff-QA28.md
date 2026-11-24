# Handoff — QA-28 (Fase 6n)

| Field | Isi |
|---|---|
| Task ID | QA-28 |
| Nama task | Verifikasi menu Manajemen Bimbel, alias rute, permission, dan regresi CMS; input gate REL-16 |
| Agent pengirim | PM |
| Agent penerima | QA |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-006-manajemen-bimbel.md`, `pm-agent/tasks/phase6n-backlog.md`; target `qa-agent/tests/phase5.mjs`, `qa-agent/test-cases/`, `qa-agent/reports/`
- Endpoint / UI: semua endpoint BE-31; halaman CMS `#/bimbel/siswa`, `#/bimbel/program-belajar`, alias `#/tryouts/peserta`, `#/program-belajar`
- Bukti: baseline QA `qa-agent/reports/phase6-release-gate.md` masih mencantumkan "Kelola Peserta di Manajemen Tryout"; marker `P5-14` di `phase5.mjs:171-203` masih memakai `Kelola Peserta` dan rute lama; baseline `free -h` 2026-11-24: 1.9 GiB total, 673 MiB available, swap 687 MiB / 3.9 GiB

## Acceptance Criteria Terpenuhi

- [x] Skenario positif N-01: sidebar menampilkan grup `Manajemen Bimbel` dengan `Kelola Siswa` lalu `Kelola Program Belajar`; keduanya dapat dibuka dan merender halaman yang sama seperti sebelum perubahan.
- [x] Skenario positif N-02: hash `#/bimbel/siswa` dan `#/bimbel/program-belajar` berfungsi; hash lama `#/tryouts/peserta` dan `#/program-belajar` tetap merender halaman yang sama lewat alias.
- [x] Skenario negatif N-03: `Kelola Siswa` tidak muncul lagi di grup `Manajemen Tryout`; `Kelola Program Belajar` tidak muncul lagi di grup `Setting`; grup lama tetap berisi item yang seharusnya.
- [x] RBAC tidak berubah: user dengan `tryouts.manage` melihat Kelola Siswa, user dengan `program_belajar.manage` melihat Kelola Program Belajar; tanpa permission keduanya tidak muncul dan akses langsung tetap ditolak backend.
- [x] Marker `P5-14` diperbarui dari `Kelola Peserta` menjadi `Kelola Siswa`, ditambah `Manajemen Bimbel`, `#/bimbel/siswa`, dan `#/bimbel/program-belajar`; marker lama untuk grup lama tidak dihapus selain item yang memang dipindah.
- [x] Tidak ada bug P0/P1; regresi suite backend/CMS lulus dan tidak ada perubahan pada alur tryout/presentation maupun data submission lama.
- [x] Laporan QA mencantumkan hasil `free -h` sebelum/sesudah, nomor bundle baru, serta rekomendasi GO/NO-GO untuk `REL-16`.

## Catatan Kendala / Risiko

- QA-28 bergantung pada FE-28 dan konfirmasi BE-31. Marker lama `Kelola Peserta` saat ini sudah tidak cocok dengan source frontend pasca commit `3597617`, sehingga perlu diselaraskan agar regresi tidak gagal palsu.
- Perubahan ini tidak boleh memicu migrasi database; bila ada usulan permission atau endpoint baru, kembalikan ke PM untuk ADR baru, jangan langsung luluskan.
- Jalankan test satu proses dengan `NODE_OPTIONS=--max-old-space-size=128`; jangan paralel dengan build frontend. Laporkan bila available memory turun di bawah ~200 MiB.
- `REL-16` baru digate setelah QA-28 selesai; gate ini tidak mengubah status `REL-15` yang masih menunggu regresi penuh Fase 6m.

## Hasil Pengujian 2026-11-24

- Test baru `qa-agent/tests/nav-bimbel.mjs`: 3/3 pass (N-01 susunan menu, N-02 alias rute, N-03 item dihapus dari grup lama); didaftarkan di `backend-agent/package.json`.
- Marker `P5-14` diselaraskan ke `Buat Soal`, `Kelola Siswa`, `Manajemen Bimbel`, `#/bimbel/siswa`, `#/bimbel/program-belajar`; ekspektasi `A-12` ditambah `program_belajar.manage`; `S-17` memakai `QA_UI_BASE` default `https://cms.hanyadi.web.id`.
- Regresi penuh serial: **132 test, 132 pass, 0 fail**, heap 128 MB, tanpa OOM. Available memory 658→674 MB saat build, 593 MB setelah regresi; swap 732→767→724 MB.
- Bundle `index-CXNjTfX_.js` terlayani CMS `200`; health API/presentation `200`; `/auth/me` tanpa cookie `401`; tryout `200`; 0 bug P0/P1.
- Sisa fixture lama `qa_siswa_22971608@qa.test` dihapus; `qa_%@qa.test` = 0, contributors/roles/mapels QA = 0.
- Rekomendasi QA: **GO** untuk `REL-16` (`qa-agent/reports/phase6n-release-gate.md`).

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
