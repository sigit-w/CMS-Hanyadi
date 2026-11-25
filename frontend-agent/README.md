# Frontend Agent — React.js

## Fungsi

Membangun dashboard CMS untuk input soal, upload/pengumpulan soal dari berbagai sumber, filter mapel, dan daftar soal dengan pagination 20 serta stem tanpa bold (ADR-004/Fase 6j).

## Peta Direktori

| Path | Fungsi |
|---|---|
| `public/` | Aset statis |
| `src/components/` | Komponen reusable (form soal, opsi, kunci, upload, filter) |
| `src/pages/` | Halaman dashboard, daftar soal, detail soal, sumber |
| `src/hooks/` | Hook untuk fetching dan state |
| `src/services/` | API client, base URL dari `.env` |
| `src/stores/` | State global ringan |
| `src/styles/` | Styling bersama |
| `tests/` | Test komponen dan alur UI |

## Fitur Utama Fase 3

- Input soal manual beserta pilihan dan kunci jawaban.
- Upload file soal dan tampilan riwayat sumber (manual/upload/eksternal).
- Filter mapel dinamis dari `/api/v1/mapels`, pencarian, pagination dengan `limit` default 20.
- Halaman `#/mapels` bernama **Kelola Mapel & Jenjang**: CRUD mapel dengan permission `mapels.manage` dan CRUD jenjang `SD`/`SMP`/`SMA` dari migrasi `031`.
- CRUD siswa (`#/bimbel/siswa`, `tryouts.manage`) dan program belajar (`#/bimbel/program-belajar`, `program_belajar.manage`) berada di grup Manajemen Bimbel; hash lama tetap menjadi alias. Siswa, Peserta Umum, dan Prospektus menampilkan kolom jenjang serta `username`, dengan filter jenjang.
- Form pendaftaran peserta Siswa mengisi otomatis password dari digit WA bila valid, jika tidak `nama depan@mmyy`; password masih bisa diganti. Peserta Umum memakai PIN/WA 8–15 digit.
- Form Buat Tryout memakai urutan Nama Tryout → jadwal mulai → jadwal selesai → mapel → lembar soal, dengan peserta opsional. Siswa tidak tampil default; opsi `A. Peserta Didik` memuat daftar siswa aktif dari Kelola Siswa untuk dipilih, sedangkan `B. Peserta Umum` membuat Nama/Sekolah/Jenjang/WA dan PIN 8–15 digit yang bisa di-generate ulang. `username` dibangkitkan otomatis dan dipakai login tryout.
- Baris peserta terlampir dapat diklik untuk detail dan dilengkapi icon keranjang sampah, bukan checkbox. Peserta Umum yang dikeluarkan masuk ke menu `Prospektus` (`#/tryouts/prospektus`) di bawah Manajemen Tryout; Siswa hanya terlepas dari tryout.
- Halaman laporan `#/reports/tryout` memakai `Combobox` pencarian tryout, filter jenjang, filter sesi, dan popup unduh tryout-only. Daftar Tryout memiliki tombol **Ubah** (hanya nama/jadwal, semua status, `slug` tidak berubah), **Unduh Soal**, dan **Unduh Soal + Kunci** (satu ZIP berisi PDF per sesi; varian berkunci butuh `tryout_questions.key_export`).
- Fase 6q (ADR-009): helper text lama di form Buat Tryout dihapus. Tombol `Kelola Peserta` pada Daftar Tryout membuka popup berisi daftar peserta dan tombol `A. Peserta Didik` / `B. Peserta Umum`; penambahan dari popup langsung tersimpan ke tryout lewat `POST /api/v1/tryouts/{id}/participants`, sedangkan alur form draft tetap lokal sampai tryout disimpan.
- Soal baru langsung `approved`; tidak ada pilihan versi/readiness atau status `draft`/`review` di UI.
- State loading, empty, dan error yang jelas.

## Aturan Implementasi

- Bentuk request/response mengikuti `backend-agent/openapi/`, bukan tebakan.
- Validasi form mencerminkan aturan backend sebelum submit.
- Daftar soal mengirim `page`/`limit=20` dengan kontrol halaman; stem dirender tanpa bold (`font-weight: 400`).
- Tidak menyimpan secret di bundle frontend.

## Kontrak Fase 6j (ADR-004)

- Status soal langsung `approved`; `draft`/`review` tidak tersedia di filter maupun form.
- Tanpa pilihan versi, `ready_version`, atau komponen readiness; endpoint lama mengembalikan 404.
- Daftar soal memakai pagination server-side `limit=20` (Prev/Next + "halaman x dari y"), bukan virtual scroll.
- Stem soal di daftar CMS dan daftar/detail tryout memakai font weight normal (400).

## Task Fase 3

Lihat `docs/phase3-tasks.md` rentang `FE-01` sampai `FE-08` (arsip Fase 3).
