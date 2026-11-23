# Laporan QA Fase 6j — Penyederhanaan Soal & Pagination

| Field | Isi |
|---|---|
| Tanggal | 2026-11-23 |
| Task | QA-22 / REL-10 |
| Desain | ADR-004 (accepted) |
| Lingkungan | API isolasi `127.0.0.1:18082`, presentation `127.0.0.1:18083`, DB `qa_phase6j_scratch` |
| Hasil | **118 test, 118 pass, 0 fail** |
| Bug P0/P1 aplikasi | 0 |
| Rekomendasi | Lihat `qa-agent/reports/phase6j-release-gate.md` |

## Review ADR-004

Hasil review: **disetujui QA dengan catatan gate**.

- ADR konsisten dengan backlog Fase 6j dan handoff BE-25/PRES-02/FE-21/TRY-10: status kanonik `approved`, `draft`/`review` dihapus, versi disembunyikan dari kontrak tetapi data historis tetap disimpan, stem non-bold, pagination CMS 20 baris.
- Keputusan menyimpan tabel versi/varian dan kolom `tryout_submissions.version='v1'` sudah tepat untuk rollback dan kompatibilitas submission lama.
- Penghapusan `readiness.write` dari UI tidak mengubah matriks RBAC; permission tetap ada di DB dan tidak dihapus dari test A-12/A-13.
- Strategi memori (test 128 MB, build Vite 256 MB, serial) sesuai keterbatasan ~2 GB RAM.
- Catatan penting ADR poin 32 (perbandingan sampel konten varian) **tidak terpenuhi secara otomatis**: ditemukan 3 baris varian dengan stem unik pada soal #968. Lihat Temuan T-01.

## Lingkungan & Eksekusi

- Scratch DB dibuat dari salinan produksi, lalu `db/migrations/015_simplify_question_status.sql` diterapkan hanya di scratch: `UPDATE 19`, default `approved`, constraint menjadi `('approved','rejected','archived')`.
- Service produksi port 8082/8083 **tidak di-restart dan tidak di-deploy**.
- Kode yang diuji adalah source tree Fase 6j (BE-25/PRES-02/FE-21/TRY-10), bukan artifact produksi lama.
- Perintah (password diambil dari env, tidak dicatat/dicetal):

  `QA_API_BASE=http://127.0.0.1:18082 QA_PRESENTATION_BASE=http://127.0.0.1:18083 DB_NAME=qa_phase6j_scratch QA_ADMIN_PASSWORD=<env> NODE_OPTIONS=--max-old-space-size=128 node --test --test-concurrency=1 <seluruh file qa-agent/tests>`

- Eksekusi satu urutan, bukan parallel. Percobaan awal gagal di A-03 karena proses isolasi saya memakai `AUTH_COOKIE_SECURE=0`; konfigurasi isolasi dikembalikan ke `1` seperti produksi dan regresi diulang dari awal. Ini kesalahan setup test, bukan bug aplikasi.

## Detail Test

| Grup | Jumlah | Hasil |
|---|---:|---|
| Auth/RBAC A-01..A-17 | 17 | pass |
| Mapel MP-01..MP-06 | 6 | pass |
| Multi-jawaban MA-01..MA-02 | 2 | pass |
| Edge S-20..S-34 | 15 | pass |
| Smoke S-01..S-19 | 19 | pass |
| Peserta P-01..P-09 | 9 | pass |
| Fase 5 P5-01..P5-14 (kontrak baru) | 14 | pass |
| Fase 6j J-01..J-10 (baru) | 10 | pass |
| Manajemen soal M-01..M-03 | 3 | pass |
| Laporan tryout TR-01..TR-06 | 6 | pass |
| Tryout T-01..T-08 | 8 | pass |
| Upload & grading U-01..U-09 | 9 | pass |
| **Total** | **118** | **118 pass, 0 fail** |

Perubahan test utama:

- `auth-helper.mjs` dan seluruh test kini membaca `QA_API_BASE`/`QA_PRESENTATION_BASE` sehingga bisa dijalankan di port isolasi.
- Ekspektasi lama dihapus: `/presentation-versions`, readiness, varian, field `version`/`readiness`, `id="version"`, marker `Siap versi`/virtual scroll, dan submit/query `version=v1`.
- Test lama yang tidak relevan dialihkan ke kontrak baru (mis. P5-03..P5-13, U-05, S-03, S-08, S-30, T-01..T-05).
- `backend-agent/package.json` memasukkan `qa-agent/tests/phase6j.mjs` ke script `npm test`.

## Skenario Baru (J-01..J-10)

1. **J-01** create soal manual → `201`, status `approved`.
2. **J-02** import JSON → semua `question_ids` berstatus `approved`.
3. **J-03** `draft`/`review` ditolak `400` pada `PUT /questions/:id` dan `?status=`.
4. **J-04** tidak ada `version`, `ready_version`, `readiness`, `ready_version_count`, `is_multi_version_ready` pada list/detail CMS, tryout, dan presentation.
5. **J-05** endpoint lama `/presentation-versions`, `/readiness`, `/variants`, `/questions/:id/v1` → `404 NOT_FOUND`.
6. **J-06** tryout hanya soal `approved`; soal yang diarsipkan tidak muncul (mapel uji terpisah).
7. **J-07** pagination CMS: page1 20 item, page2 5 item, `limit=20`, `total=25`; filter + pagination konsisten; hapus soal terakhir di page2 → `total=24`, page2 4 item, page1 tetap 20.
8. **J-08** stem tidak bold: source `Dashboard.jsx` memakai `<p>` tanpa `font-*`, bundle CMS tidak memuat marker versi, CSS/JS tryout memakai `font-weight: 400` dan tanpa `<strong>`.
9. **J-09** data lama `draft`/`review` di scratch termigrasi `approved`, default dan constraint `015` terverifikasi.
10. **J-10** submission lama `version='v1'` terbaca di laporan; submit baru menyimpan `v1` secara internal.

Selain itu, skenario yang diperbarui mencakup create/import approved (S-04, S-10..S-12, P5-02, U-01, TR-02), archived tidak tampil/tidak bisa disajikan (M-01, P5-05, J-06), endpoint lama 404 (S-03, S-30, P5-07, P5-12, U-05, J-05), dan parameter versi diabaikan tanpa field bocor (P5-08).

## Resource & Memori

| Metrik | Nilai |
|---|---|
| Available memory sebelum | 502 MB |
| Available memory sesudah | 397 MB |
| Swap free sebelum → sesudah | 3451 MB → 3443 MB |
| Peak RSS child test terbesar | 109,4 MB |
| RSS API isolasi | 154,9 MB |
| RSS presentation isolasi | 64,3 MB |
| Durasi regresi | 7,0 detik |
| OOM / restart tak sengaja | Tidak ada |

`NODE_OPTIONS=--max-old-space-size=128` dipakai untuk test dan kedua service isolasi. Tidak ada `npm install`, tidak ada build parallel.

## Temuan

- **T-01 — P1, blocker gate (data, bukan bug kode).** Terdapat 3 baris `question_presentation_variants` dengan stem unik untuk soal #968 (`v1`, `v2`, `v3`: “Variasi v1/v2/v3 Fase 5”), sementara stem inti adalah “Soal induk Fase 5”. Kode baru membaca tabel inti sesuai ADR-004, sehingga teks varian tersebut tidak akan tampil setelah deploy. Reproduksi (read-only):

  ```sql
  SELECT q.id, pv.code, q.stem AS stem_inti, v.stem AS stem_varian
  FROM question_presentation_variants v
  JOIN presentation_versions pv ON pv.id = v.version_id
  JOIN questions q ON q.id = v.question_id
  WHERE v.stem IS DISTINCT FROM q.stem;
  -- mengembalikan 3 baris untuk q.id = 968
  ```

  Sesuai konsekuensi ADR poin 32, ini butuh keputusan pemilik proyek: salin konten varian terpilih ke `questions`/`question_options`/`answer_keys` sebelum deploy, atau tanda terima tertulis bahwa konten varian tersebut hilang.

  **Resolusi 2026-11-23:** baris #968 beserta 16 soal fixture QA lain ternyata masuk ke DB produksi saat sesi regresi. Setelah backup `bank_soal_db-backup-2026-11-23-before-015.sql`, ke-17 soal, 15 sumber, dan 15 sesi auth uji dihapus. Verifikasi ulang: `0` baris varian dengan stem berbeda dari induk. T-01 ditutup tanpa backport konten.

- **T-02 — P2, closed.** Dokumentasi QA lama (`qa-agent/README.md:30`) masih menyebut “readiness konsisten dengan schema”. DOC-06J telah menyelaraskan README, checklist, scenario, DB README, arsitektur, dan laporan sistem aktif dengan kontrak Fase 6j.

- Tidak ada bug P0/P1 pada kode aplikasi yang ditemukan selama regresi.

## Kesimpulan

Seluruh 118 test lolos, termasuk 10 skenario baru Fase 6j. T-01 dan T-02 telah ditutup; gate REL-10 dinyatakan **GO** pada 2026-11-23 setelah migrasi, deploy, dan smoke produksi (lihat `phase6j-release-gate.md`).
