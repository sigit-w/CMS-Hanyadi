# Fase 6z — Laporan QA

## Ruang Lingkup

- Daftar Soal menampilkan `usage_count` berupa jumlah lembar soal aktif yang memuat soal; lembar arsip/dihapus tidak dihitung.
- Impor soal hanya menerima file `.csv`/`.xlsx`; payload `content`, `questions[]`, JSON, dan TXT ditolak `400 VALIDATION_ERROR`.
- Template CSV dan XLSX tersedia, valid, dan menghasilkan empat soal uji tanpa perubahan.
- Daftar/detail Siswa, Peserta Umum, dan peserta tryout menampilkan `username` berdampingan dengan `password_plain`/`pin_plain` untuk peran CMS berpermission; satu tombol copy menyalin `Nama`, `username`, dan PIN/password. Hash dan data user CMS tidak diekspos.
- Menu, judul, hash, dan marker QA memakai `Peserta Umum`; alias lama `#/tryouts/prospektus` tetap redirect ke `#/tryouts/peserta-umum`.
- Revisi lanjutan: tombol `Kelola Peserta` pada tryout tersimpan membuka halaman `#/tryouts/{id}/peserta` bergaya Peserta Umum dengan tabel gabungan dan form tambah inline A/B; popup manage dihapus, sedangkan popup alur Buat Tryout tetap dipertahankan.

## Eksekusi

- Perintah: dari `/opt/virtual-office-bank-soal/backend-agent`, `set -a; . ./.env; set +a; QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD" NODE_OPTIONS=--max-old-space-size=128 npm test -- --test-concurrency=1`.
- Skenario baru: `Q6Z-01`…`Q6Z-07` dari `qa-agent/tests/phase6z.mjs`.
- Fokus regresi: `REL-24`…`REL-31`, marker navigasi, pemakaian soal, kredensial peserta, dan identitas Peserta Umum.
- Secret tidak pernah dicetak; `QA_ADMIN_PASSWORD` hanya diambil dari `BOOTSTRAP_ADMIN_PASSWORD` di `.env`.

## Hasil

- `Q6Z-01`…`Q6Z-07`: 7/7 lolos, 0 gagal.
- `Q6W-01`…`Q6W-05`: 5/5 lolos, 0 gagal.
- Regresi penuh final: **206/206 lolos**, 0 gagal, 0 cancelled, 0 skipped, 0 todo, duration_ms `31728.17064`.
- Build frontend final sukses dengan `NODE_OPTIONS=--max-old-space-size=384`; bundle `dist/assets/index-C_etU5Vw.js` dan CSS `dist/assets/index-C3qyrjbW.css`.
- `node --check` untuk file backend yang diubah lolos.

## Perbaikan Saat Regresi

| Test | Severity | Penyebab | Perbaikan |
|---|---|---|---|
| N-03 | P2 | Pencocokan substring membuat `/tryouts/peserta-umum` dianggap sebagai alias lama `/tryouts/peserta` | `nav-bimbel.mjs` memakai pencocokan path exact untuk alias lama |
| L-04 | P2 | Ekspektasi `usage_count = 1` tidak mengikuti dua lembar aktif pada fixture bersama | `phase6l.mjs` mengharapkan `usage_count = 2` sesuai kontrak ADR-022 |
| PS-01 | P1 | Peserta dibuat tanpa `jenjang_id`, sehingga `generateParticipantUsername()` mengembalikan `null` | `phase6r.mjs` memakai jenjang `SD` dari seed di `before()` |
| PS-02 | P1 | Payload create tidak mengirim `jenjang_id`, sehingga username tidak tergenerate | `phase6r.mjs` menambahkan `jenjang_id` pada payload PS-01/PS-02 |
| Q6W-01 | P2 | Label tabel/detail hanya `Password` atau `PIN`, tanpa `Username` | Label diubah menjadi `Username / Password` dan `Username / PIN` |

## Bug Tersisa

| Bug ID | Severity | Status |
|---|---|---|
| - | - | Tidak ada bug P0/P1 |

Gate rilis tercatat di `phase6z-release-gate.md`.
