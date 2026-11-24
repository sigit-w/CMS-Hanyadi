# Handoff — FE-28 (Fase 6n)

| Field | Isi |
|---|---|
| Task ID | FE-28 |
| Nama task | Grup menu Manajemen Bimbel: pindahkan Kelola Siswa dan Kelola Program Belajar, tambah rute kanonik baru |
| Agent pengirim | PM |
| Agent penerima | Frontend |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-006-manajemen-bimbel.md`, `pm-agent/tasks/phase6n-backlog.md`; target utama `frontend-agent/src/App.jsx`
- Endpoint / UI: sidebar CMS; hash `#/bimbel/siswa` dan `#/bimbel/program-belajar`; alias `#/tryouts/peserta` dan `#/program-belajar`
- Bukti: struktur `NAV_GROUPS` saat ini ada di `App.jsx:35-63`; baseline `free -h` 2026-11-24: 1.9 GiB total, 673 MiB available, swap 687 MiB / 3.9 GiB

## Acceptance Criteria Terpenuhi

- [x] `NAV_GROUPS` memiliki grup baru dengan `key: 'manajemen-bimbel'` dan `label: 'Manajemen Bimbel'`.
- [x] Grup baru berisi tepat dua item dengan urutan `Kelola Siswa` lalu `Kelola Program Belajar`, memakai `permission` `tryouts.manage` dan `program_belajar.manage` serta ikon yang sudah ada (`Users`, `GraduationCap`).
- [x] Item `Kelola Siswa` dihapus dari grup `Manajemen Tryout`; grup tersebut menyisakan `Buat/Daftar Tryout` dan `Laporan Tryout`.
- [x] Item `Kelola Program Belajar` dihapus dari grup `Setting`; grup tersebut menyisakan `Kelola Mapel`, `Kelola Role`, dan `Laporan Sistem`.
- [x] Item menu memakai hash `#/bimbel/siswa` dan `#/bimbel/program-belajar`; cabang render di `App()` memakai `activePath` `/bimbel/siswa` dan `/bimbel/program-belajar` dengan komponen halaman yang sama.
- [x] `ROUTE_ALIASES` memetakan `/tryouts/peserta` → `/bimbel/siswa` dan `/program-belajar` → `/bimbel/program-belajar`; hash lama tetap merender halaman yang sama tanpa redirect paksa.
- [x] Tidak ada perubahan pada `src/api.js`, `PesertaManagement.jsx`, `ProgramBelajarManagement.jsx`, atau permission/RBAC.
- [x] Build produksi sukses tanpa OOM dan bundle baru dilaporkan ke QA.

## Catatan Kendala / Risiko

- Perubahan hanya pada struktur navigasi dan pencocokan rute; jangan mengganti logika form atau endpoint karena BE-31/ADR-006/D4 menyatakan kontrak tidak berubah.
- `ROUTE_ALIASES` sudah dipakai untuk `/questions/new`; tambahkan entri baru dengan pola yang sama agar `NAV_ITEMS` dan pengecekan permission tetap konsisten.
- Cek `free -h` sebelum build. Build dengan `NODE_OPTIONS=--max-old-space-size=256`; jangan paralel dengan test QA, naikkan ke `384` hanya bila gagal dan laporkan alasannya.
- Koordinasikan marker bundle dengan QA-28 karena test `P5-14` masih mencari `Kelola Peserta` dan rute lama.

## Hasil Implementasi 2026-11-24

- `frontend-agent/src/App.jsx`: grup `manajemen-bimbel` ditambahkan setelah `manajemen-tryout`; item lama dihapus dari grup `manajemen-tryout` dan `setting`.
- `ROUTE_ALIASES` memetakan `/tryouts/peserta` → `/bimbel/siswa` dan `/program-belajar` → `/bimbel/program-belajar`; cabang render memakai rute kanonik baru.
- Build `NODE_OPTIONS=--max-old-space-size=256 npm run build` sukses: `index-CXNjTfX_.js` 272,82 kB (gzip 78,57 kB) + `index-DTTFvXix.css` 20,96 kB. CMS produksi menyajikan hash tersebut.
- Tidak ada perubahan pada `src/api.js`, halaman PesertaManagement, atau ProgramBelajarManagement.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
