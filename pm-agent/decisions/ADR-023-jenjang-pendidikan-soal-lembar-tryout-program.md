# Decision Log — ADR-023

| Field | Isi |
|---|---|
| ID | ADR-023 |
| Tanggal | 2026-11-25 |
| Pemilik | PM |
| Status | accepted — masukan pemilik diterima tanpa pertanyaan terbuka; siap dieksekusi BE/FE/QA/DOC |
| Terkait task | PM-31, BE-46, FE-43, TRY-23, QA-43, DOC-14 |
| Melanjutkan | Fase 6z / `REL-32` (GO, 2026-11-25); `REL-01…REL-32` tidak dibuka ulang; Fase 7 tetap dibatalkan |

## Konteks

Pemilik meminta jenjang pendidikan menjadi atribut utama di seluruh alur konten dan manajemen:

1. Halaman Buat Soal menambahkan input jenjang pendidikan; skema import dan file template import ikut diubah.
2. Filter jenjang pendidikan ditambahkan di halaman Daftar Soal dan pada bagian Daftar Soal di halaman Buat Soal.
3. Flow Lembar Soal berubah menjadi: nama → jenjang → mapel → kode otomatis → waktu → keterangan → pilih soal sesuai jenjang dan mapel.
4. Kode lembar soal baru berformat `LS-[kode mapel]-[kode jenjang]-[mmyy]`, misalnya `LS-MTKA-SD-1126`.
5. Daftar Lembar Soal menampilkan jenjang pendidikan.
6. Flow Buat Tryout berubah menjadi: nama → jenjang → slug otomatis → tanggal/jam mulai → tanggal/jam selesai → aturan existing.
7. Daftar Tryout mengganti kolom jumlah soal dengan kolom jenjang pendidikan.
8. Kelola Program Belajar menambahkan pilihan jenjang saat membuat program.

Hasil pemeriksaan awal 2026-11-25:

- Seed `SD`/`SMP`/`SMA` sudah ada di `db/migrations/031_jenjang_dan_kredensial_peserta.sql:14-22`; master jenjang tersedia lewat `GET /api/v1/jenjangs` dan dipakai frontend di `frontend-agent/src/api.js:103`.
- Peserta, laporan tryout, dan `/auth/me` sudah memakai jenjang; soal, lembar soal, tryout event, dan program belajar belum memiliki `jenjang_id`.
- Generator kode lembar sekarang di `backend-agent/src/questionSheetRoutes.js:24-29` masih berformat `LS-${mapel}-${mmyy}` dengan `CODE_PATTERN` di `:44-53`.
- Slug tryout sudah otomatis lewat `generateTryoutSlug()` di `backend-agent/src/auth.js:17-35` dan `backend-agent/src/tryoutRoutes.js:745-759`; input manual slug perlu dihapus dari UI.
- Daftar Tryout di `frontend-agent/src/pages/TryoutManagement.jsx:1070-1109` masih menampilkan `Soal` / `question_count`.
- Template impor ada di `frontend-agent/public/templates/template-soal.csv` dan `template-soal.xlsx`; keduanya belum memiliki kolom `jenjang`.
- Marker QA yang terdampak antara lain `qa-agent/tests/phase6l.mjs`, `phase6x.mjs`, `phase6u.mjs`, `phase6o.mjs`, `phase6z.mjs`, `phase6w.mjs`, dan `nav-bimbel.mjs`.

## Keputusan

1. **D1 — Fase dan gate.** Permintaan ini masuk Fase 6aa dengan gate `REL-33`, rollback ke `REL-32`. `REL-01…REL-32` tidak dibuka ulang; Fase 7 tetap dibatalkan.
2. **D2 — Master jenjang.** Tidak membuat seed baru. Semua form mengambil opsi dari `GET /api/v1/jenjangs`; nilai yang dipakai adalah kode `SD`, `SMP`, `SMA`. Data lama di-backfill ke `SD` sebelum kolom baru menjadi `NOT NULL`.
3. **D3 — Soal dan impor.** `questions` dan payload create/update soal wajib membawa jenjang. Header import CSV/XLSX menyisipkan `jenjang` setelah `mapel`; template CSV dan XLSX diperbarui dengan contoh yang langsung lolos import. Filter jenjang tersedia di Daftar Soal dan pada bagian Daftar Soal di halaman Buat Soal.
4. **D4 — Lembar soal.** `question_sheets` wajib memiliki jenjang. Kode otomatis menjadi `LS-${mapel}-${jenjang}-${mmyy}` dengan `mmyy` tetap memakai UTC seperti implementasi sekarang. Kode hanya dihasilkan setelah jenjang dan mapel dipilih. Picker soal difilter oleh jenjang **dan** mapel; soal dengan jenjang berbeda tidak boleh dipilih. Daftar Lembar Soal menampilkan jenjang.
5. **D5 — Tryout.** `tryout_events` wajib memiliki jenjang. Urutan form Buat Tryout adalah nama → jenjang → slug auto-readonly → mulai → selesai → sesi/mapel/lembar/peserta seperti existing. Slug tetap dihasilkan backend; lembar yang dipilih harus berjenjang sama dengan tryout.
6. **D6 — Daftar Tryout.** Kolom `Soal` / `question_count` diganti dengan kolom `Jenjang` yang menampilkan `jenjang_kode`/`jenjang_nama`. Kolom peserta dan kolom lainnya tidak berubah. Status filter dan tombol salin URL hasil revisi sebelumnya dipertahankan.
7. **D7 — Program Belajar.** Form dan tabel Kelola Program Belajar menambahkan jenjang. Opsi tetap berasal dari master jenjang; validasi wajib jenjang berlaku di UI dan API.
8. **D8 — Isolasi regresi.** Tidak mengubah username login peserta, URL `https://tryout.hanyadi.web.id/{slug}`, format laporan tryout, gate `REL-24…REL-32`, maupun mekanisme kredensial. QA wajib menjalankan skenario baru dan regresi penuh sebelum `REL-33` GO.

## Konsekuensi

- Diperlukan migrasi `034` untuk FK `jenjang_id` pada `questions`, `question_sheets`, `tryout_events`, dan `program_belajar`, plus backfill `SD`, index, perubahan panjang/constraint kode lembar, dan rebuild `v_question_catalog`.
- Seluruh kontrak API yang berubah wajib tercatat di `backend-agent/openapi/openapi.yaml` sebelum frontend mengonsumsinya.
- Template XLSX harus diperbarui sebagai file biner/XML yang konsisten dengan template CSV; QA menguji keduanya sebagai fixture import valid.
- Perubahan format kode lembar soal memutus asumsi lama pada validator, test, dan contoh dokumentasi; semua marker lama harus diganti, bukan ditambahkan sebagai alternatif.
- Backfill `SD` bersifat keputusan PM karena data lama belum memiliki jenjang; QA wajib memastikan tidak ada soal/lembar/tryout/program dengan `jenjang_id` kosong setelah migrasi.

## Alternatif yang Dipertimbangkan

- **Menambah jenjang sebagai teks bebas.** Ditolak karena master `jenjang` sudah ada dan dipakai peserta/laporan; teks bebas akan memicu inkonsistensi kode.
- **Membuat seed jenjang baru.** Ditolak karena `SD`/`SMP`/`SMA` sudah final di ADR-019 dan migrasi `031`.
- **Menyimpan kode lembar format lama sebagai alias.** Ditolak karena pemilik meminta format baru dan QA perlu satu aturan yang tegas.
- **Membuka Fase 7.** Ditolak; mengikuti pola Fase 6w–6z, pekerjaan lanjutan dicatat sebagai Fase 6aa agar gate lama tidak dibuka ulang.
