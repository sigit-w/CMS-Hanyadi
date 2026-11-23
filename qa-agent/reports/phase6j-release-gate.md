# Release Gate — REL-10 / Fase 6j

| Field | Isi |
|---|---|
| Tanggal | 2026-11-23 |
| Task | QA-22 → REL-10 |
| Review ADR-004 | Disetujui QA dengan catatan |
| Regresi | 118/118 pass, 0 fail |
| Bug P0/P1 aplikasi | 0 |
| **Keputusan QA** | **GO** (lihat addendum 2026-11-23) |

## Alasan Keputusan

Implementasi BE-25/PRES-02/FE-21/TRY-10 lolos seluruh regresi di lingkungan isolasi, termasuk 10 skenario baru Fase 6j. Temuan awal T-01 (3 konten varian unik pada soal #968) telah ditutup melalui penghapusan data fixture uji pada 2026-11-23; detail dan bukti deploy ada di Addendum di bawah.

## Status Gate

| Syarat | Status | Bukti |
|---|---|---|
| Review ADR-004 sebelum migrasi | pass | `qa-agent/reports/phase6j-report.md` |
| Migrasi `015` idempoten & terpasang di DB uji | pass | `UPDATE 19`; default `approved`; constraint 3 status |
| Create/import otomatis `approved` | pass | J-01, J-02, S-04, S-10..S-12 |
| `draft`/`review` ditolak di update/filter | pass | J-03, P5-09 |
| Kontrak bebas versi/readiness; endpoint lama 404 | pass | J-04, J-05, S-03, S-08, S-30, P5-07/P5-08/P5-12, U-05 |
| Tryout hanya `approved`, tanpa `archived` | pass | J-06, T-03..T-05, P5-05 |
| Pagination CMS 20/total/filter/hapus item page2 | pass | J-07, P5-11 |
| Stem non-bold di CMS & tryout | pass | J-08, T-01, T-02 |
| Data lama termigrasi & submission `v1` kompatibel | pass | J-09, J-10 |
| Regresi penuh serial, heap 128 MB, tanpa OOM | pass | 118/118; peak child RSS 109,4 MB |
| Perbandingan sampel konten varian sesuai ADR-004 poin 32 | pass | T-01 ditutup: fixture uji #968–#969 dihapus; 0 varian beda stem |
| DOC-06J (OpenAPI/README/status board) selesai | pass | OpenAPI, DB README, arsitektur, README agent, checklist, laporan sistem, status board |

## Syarat Menjadi GO

1. Tutup T-01: pemilik proyek memilih **salin konten varian terpilih ke tabel inti** untuk soal #968 (dan verifikasi option/answer key) **atau** memberikan persetujuan tertulis untuk kehilangan teks varian tersebut.
2. Jalankan migrasi `015_simplify_question_status.sql` di produksi **sebelum** restart service; verifikasi `SELECT status,count(*) FROM questions GROUP BY status` tidak lagi memuat `draft`/`review`, default `approved`, constraint hanya `approved/rejected/archived`.
3. Ambil backup DB produksi sebelum migrasi (wajib untuk rollback data).
4. Build Vite/tryout bergiliran dengan `NODE_OPTIONS=--max-old-space-size=256` (naik `384` hanya jika gagal), tanpa `npm install`, tanpa parallel build/test.
5. Deploy kode baru hanya setelah migrasi; verifikasi `/health` 8082/8083, endpoint lama 404, pagination 20, stem normal, dan sampel soal #968 sesuai keputusan poin 1.
6. Selesaikan DOC-06J: OpenAPI, README backend/frontend, `db/README.md`, laporan sistem, dan status board mengikuti kontrak baru.

## Rollback Singkat

- Tabel versi/varian dan kolom `tryout_submissions.version` sengaja tidak dihapus; rollback kode cukup deploy ulang artifact REL-09 (kode lama) setelah migrasi/urutan deploy dihentikan.
- Reverse skema `015` hanya jika diperlukan, dengan backup tersedia:

  ```sql
  ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_status_check;
  ALTER TABLE public.questions ADD CONSTRAINT questions_status_check
    CHECK (status IN ('draft', 'review', 'approved', 'rejected', 'archived'));
  ALTER TABLE public.questions ALTER COLUMN status SET DEFAULT 'draft';
  ```

- Catatan: reverse constraint/default **tidak memulihkan** baris `draft`/`review` yang sudah berubah menjadi `approved`; pemulihan status butuh restore dari backup.

## Tanda Tangan

## Addendum 2026-11-23 — Penutupan Gate

- T-01 ditutup: 17 soal fixture uji (termasuk #968) dihapus dari produksi setelah backup; verifikasi ulang `0` varian dengan stem berbeda dari induk.
- Backup: `/tmp/opencode/bank_soal_db-backup-2026-11-23-before-015.sql` (diambil sebelum cleanup & migrasi).
- Migrasi `015` diterapkan: `UPDATE 3`; status produksi kini hanya `approved (3)`; default `approved`; constraint `approved/rejected/archived`.
- Deploy: `bank-soal-api.service` dan `bank-soal-presentation.service` active; health `:8082`/`:8083` OK; build CMS 256 MB sukses (236,02 kB JS); tryout aset `?v=10`; `nginx -t` + reload OK.
- Smoke publik (via Host header lokal): health API, CMS index dengan hash baru, tryout index/app/css sesuai kontrak tanpa versi dan stem normal.
- Memori pascadeploy: ~618 MiB available, swap 526 MiB/3,9 GiB, tanpa OOM.

QA: **GO**. PM: **REL-10 GO**, deployed 2026-11-23.
