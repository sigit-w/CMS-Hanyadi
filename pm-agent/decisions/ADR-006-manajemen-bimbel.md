# Decision Log — ADR-006

| Field | Isi |
|---|---|
| ID | ADR-006 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | PM-16, BE-31, FE-28, QA-28, REL-16 |

## Konteks

Pemilik proyek meminta struktur menu CMS dirapikan: **Kelola Siswa** saat ini berada di grup **Manajemen Tryout** (`#/tryouts/peserta`), sedangkan **Kelola Program Belajar** berada di grup **Setting** (`#/program-belajar`). Keduanya adalah data master bimbel yang sebaiknya berada di satu grup tersendiri, yaitu **Manajemen Bimbel**.

Perubahan yang diminta hanya menyentuh navigasi dan penempatan halaman di CMS. Tidak ada permintaan perubahan schema database, kontrak API, atau aturan akses. ADR ini mencatat keputusan PM agar BE, FE, dan QA bekerja dengan ruang lingkup yang sama.

## Keputusan

1. **Grup navigasi baru.** `NAV_GROUPS` mendapat grup `Manajemen Bimbel` dengan dua item, berurutan: `Kelola Siswa`, lalu `Kelola Program Belajar`. Item `Kelola Siswa` dihapus dari `Manajemen Tryout`; item `Kelola Program Belajar` dihapus dari `Setting`.
2. **Rute kanonik baru.** Rute utama menjadi `#/bimbel/siswa` dan `#/bimbel/program-belajar`. Rute lama `#/tryouts/peserta` dan `#/program-belajar` tetap diterima sebagai alias melalui `ROUTE_ALIASES` agar bookmark, tautan lama, dan dokumentasi lama tidak langsung rusak.
3. **Permission tidak berubah.** `Kelola Siswa` tetap memakai `tryouts.manage`; `Kelola Program Belajar` tetap memakai `program_belajar.manage`. Tidak dibuat permission baru `bimbel.manage`, karena ini adalah perubahan pengelompokan UI, bukan perubahan otorisasi.
4. **Backend tanpa perubahan kontrak.** Tidak ada migrasi database, endpoint baru, atau perubahan format respons. BE-31 hanya memastikan `/api/v1/participants` dan `/api/v1/program-belajar` tetap berfungsi dengan permission di atas, lalu mencatat grouping ini di dokumentasi backend bila diperlukan.
5. **QA memperbarui bukti navigasi.** Marker menu pada `qa-agent/tests/phase5.mjs` diselaraskan dengan label dan rute baru, ditambah skenario pemeriksaan grup `Manajemen Bimbel`, serta regresi build frontend tanpa OOM.
6. **Lingkup luar CMS tidak berubah.** Aplikasi tryout, presentation service, dan submission lama tidak disentuh.

## Konsekuensi

- Perubahan terkonsentrasi di `frontend-agent/src/App.jsx` dan test marker QA; komponen halaman `PesertaManagement.jsx` serta `ProgramBelajarManagement.jsx` tetap dipakai.
- Rute lama tetap merender halaman yang sama lewat alias, tetapi menu yang ditampilkan hanya memakai rute kanonik baru.
- Tidak ada penambahan permission, sehingga Kelola Role tidak berubah dan tidak ada migrasi `role_permissions`.
- Referensi dokumentasi lama yang menyebut "Kelola Peserta", "Kelola Siswa di Manajemen Tryout", atau `#/tryouts/peserta` perlu diselaraskan bertahap oleh masing-masing agent; alias mencegah kegagalan fungsional selama masa transisi.
- Gate rilis `REL-16` baru diberikan setelah QA-28 selesai; tidak ada deploy backend yang diwajibkan untuk perubahan ini.

## Alternatif yang Dipertimbangkan

- **Membuat permission `bimbel.manage` untuk menggantikan dua permission existing**: ditolak karena mengubah matriks RBAC dan migrasi data tanpa kebutuhan fungsional dari pemilik.
- **Memindahkan item menu saja tanpa mengubah hash route**: ditolak karena halaman masih bernama `tryouts/peserta` dan `program-belajar`, sehingga kurang konsisten dengan grup `Manajemen Bimbel`.
- **Menghapus rute lama tanpa alias**: ditolak karena dapat memutus tautan/bookmark yang sudah dipakai dan membuat regresi QA tidak perlu.
- **Menggabungkan Kelola Siswa dan Kelola Program Belajar menjadi satu halaman**: ditolak karena pemilik meminta keduanya tetap menjadi menu tersendiri di bawah satu grup.
