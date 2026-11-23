# Decision Log — ADR-004

| Field | Isi |
|---|---|
| ID | ADR-004 |
| Tanggal | 2026-11-23 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | BE-25, PRES-02, FE-21, TRY-10, DOC-06J, QA-22, REL-10 |

## Konteks

Pemilik proyek meminta penyederhanaan bank soal: versi `v1`/`v2`/`v3` tidak lagi terlihat maupun dipilih pengguna, semua soal baru langsung berstatus publish/approve, status `draft` dan `review` dihapus, teks pertanyaan tidak ditebalkan, dan daftar soal CMS memakai pagination dengan default 20 baris per halaman. Perubahan harus tetap hemat memori karena lingkungan produksi hanya ~2 GB RAM.

Keputusan ini menggantikan "kesiapan multi-versi" pada Fase 5 (`ADR` implisit migrasi `002`/`003`) tanpa menghapus data historis.

## Keputusan

1. **Status kanonik adalah `approved`.** Nilai ini dipakai sebagai publish/approve. Status `draft` dan `review` dihapus dari `CHECK` database, validasi backend, filter CMS, OpenAPI, dan checklist QA. Status `rejected` dan `archived` tetap dipertahankan sebagai status penunjang.
2. **Soal baru otomatis `approved`.** `insertQuestion()` dan jalur import memakai `DEFAULT 'approved'` / insert eksplisit `approved`; tidak ada lagi alur Draft → Review → Approve.
3. **Data lama dimigrasikan.** Migrasi `015_simplify_question_status.sql` mengubah semua baris `draft`/`review` menjadi `approved`, mengganti default kolom, dan memperbarui constraint menjadi `('approved','rejected','archived')`.
4. **Versi dinonaktifkan di UI/API, data tetap.** Tabel `presentation_versions`, `question_version_readiness`, `question_presentation_variants`, dan kolom `tryout_submissions.version` tidak dihapus. Semua pilihan versi, filter `ready_version`, query `version`, endpoint `/presentation-versions`, `/questions/:id/readiness`, dan `/questions/:id/variants` dihapus dari kontrak yang diekspos. Column `version` pada submission tetap diisi konstan `'v1'` secara internal untuk kompatibilitas histori.
5. **Sumber konten tunggal.** Backend dan presentation service membaca `questions` + `question_options` + `answer_keys` (bukan varian/readiness). Gate tampil tryout berubah dari `is_ready=true` menjadi `questions.status='approved'` dan `status <> 'archived'`.
6. **Teks pertanyaan tidak bold.** Stem di daftar soal CMS dan daftar/detail soal tryout dirender dengan font weight normal (400). Tag `<strong>` dan kelas `font-medium`/`font-semibold`/`font-bold` pada stem diganti elemen biasa.
7. **Pagination CMS.** Daftar soal mengirim `page` dan `limit=20` secara eksplisit; virtual scrolling diganti kontrol halaman Prev/Next + informasi "halaman x dari y". Kontrak backend `pagination: { page, limit, total }` sudah ada dan dipertahankan.
8. **Deploy bertahap & aman memori.** Migrasi dijalankan sebelum restart service. Build Vite dijalankan bergiliran dengan `NODE_OPTIONS=--max-old-space-size=256` (naik ke `384` hanya jika gagal), tidak parallel, dan tidak menjalankan `npm install` saat deploy.

## Konsekuensi

- Kontrak API berubah: klien yang masih mengirim `version`/`ready_version` harus diperbarui; QA memperbarui 99 skenario existing dan menambah skenario status/pagination.
- Field `readiness`, `ready_version_count`, dan `is_multi_version_ready` tidak lagi dikirim backend pada response soal. Permission `readiness.write` tetap ada di database tetapi tidak dipakai UI; tidak dihapus agar tidak mengubah matriks RBAC existing.
- Jika ada edit konten yang pernah dilakukan hanya pada baris `question_presentation_variants`, konten tersebut tidak lagi tampil; QA wajib membandingkan sampel soal sebelum gate.
- Laporan sistem, `db/README.md`, OpenAPI, README backend/frontend, dan status board harus mengikuti kontrak baru.
- Rollback tetap memungkinkan karena tabel versi tidak dihapus; cukup deploy ulang versi kode lama + migrasi `015` reverse manual bila diperlukan.

## Alternatif yang Dipertimbangkan

- **Menambah status `published`**: ditolak karena duplikat makna dengan `approved` dan memaksa migrasi seluruh checklist QA tanpa manfaat fungsional.
- **Menghapus tabel versi secara permanen**: ditolak karena destruktif dan berisiko terhadap histori submission serta rollback.
- **Membiarkan readiness otomatis namun disembunyikan**: ditolak karena soal baru tetap bisa gagal tampil bila flag tidak ter-set, bertentangan dengan requirement auto-publish.
