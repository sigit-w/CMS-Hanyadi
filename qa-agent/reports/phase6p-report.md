# Laporan QA — Fase 6p: Peserta Tryout, Detail, Hapus Relasi & Prospektus

| Field | Isi |
|---|---|
| Tanggal | 2026-11-24 |
| Task | QA-30 |
| ADR | ADR-008 accepted |
| Gate | REL-18 |
| Regresi | 150/150 pass, 0 fail |
| Test baru | PR-01..PR-08 (8/8 pass) |
| Bug P0/P1 | 0 |

## Ringkasan

BE-33, FE-30, TRY-13, dan QA-30 selesai. Siswa tidak lagi tampil default pada daftar peserta Buat Tryout; opsi `A. Peserta Didik` kini memuat daftar siswa aktif dari Kelola Siswa dengan tombol `Pilih`. Baris peserta terlampir dapat diklik untuk dialog detail dan memakai icon `Trash2` sebagai pengganti checkbox. Peserta Umum yang dikeluarkan, baik dari draft maupun tryout tersimpan, ditandai prospek, dinonaktifkan, sesinya dicabut, serta muncul di halaman/menu `Prospektus` di bawah Manajemen Tryout. Peserta Siswa hanya terlepas dari relasi tryout; baris participant dan login tetap utuh. Label `Kelola Siswa Tryout` sudah menjadi `Kelola Siswa`.

## Hasil Skenario

| ID | Skenario | Hasil |
|---|---|---|
| PR-01 | Migrasi `023`, constraint/index prospek, OpenAPI, DB doc, ADR-008 | pass |
| PR-02 | Default daftar peserta tidak merender siswa; checkbox lama tidak ada | pass |
| PR-03 | Picker A/B, `ParticipantRows`, detail baris, icon `Trash2`, marker bundle | pass |
| PR-04 | Hapus Umum dari tryout tersimpan: relasi hilang, prospek terisi, login 401, muncul di `/prospektus` | pass |
| PR-05 | Hapus Siswa: relasi hilang, baris participant identik, login 200, tidak masuk prospektus | pass |
| PR-06 | Prospek draft via `POST /participants/{id}/prospek`, Siswa ditolak 400, menu/route/label benar | pass |
| PR-07 | Dokumentasi backend/PM/status board sesuai implementasi | pass |
| PR-08 | Health API dan presentation `200` | pass |

## Regresi

- Perintah: `NODE_OPTIONS=--max-old-space-size=128 npm test`.
- Hasil: `150/150` pass, `0` fail, tanpa OOM.
- Sebelumnya Fase 6o: `142/142`; tambahan Fase 6p: `8` test.
- Regresi mencakup auth/RBAC, soal/import/pagination, lembar soal, navigasi Bimbel, peserta, Fase 6o, dan tryout.
- TRY-13 terverifikasi tanpa perubahan source `tryout-agent`; U-04, U-09, T-01..T-08, dan PR-04/PR-06 tetap lolos.

## Bukti Implementasi

| Item | Bukti |
|---|---|
| Migrasi | `023_prospektus_peserta_umum.sql` idempoten; kolom `prospek`, `prospek_at`, constraint, dan index terverifikasi |
| Endpoint | `DELETE /tryouts/{id}/participants/{participantId}`, `POST /participants/{id}/prospek`, `GET /prospektus`, `GET /participants?prospek=` |
| Bundle CMS | `index-CIWSCIZ4.js`, `index-Dni-VBeV.css` |
| Aset tryout | `styles.css?v=11`, `app.js?v=12` tidak berubah |
| Backup DB | `/tmp/opencode/bank_soal_fase6p_pre_<timestamp>.fc` |
| Health | API `8082/health` 200, presentation `8083/health` 200, CMS/tryout HTTPS 200 |

## Catatan

- `REL-15` tetap partial dan tidak diubah oleh gate ini.
- PIN Peserta Umum tetap tidak dapat diambil ulang; prospek tidak dapat login kembali tanpa reset PIN atau pembuatan ulang.
- Tidak ada bug P0/P1 yang terbuka.
