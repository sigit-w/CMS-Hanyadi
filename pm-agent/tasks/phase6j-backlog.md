# Backlog — Fase 6j: Penyederhanaan Soal & Pagination

| Field | Isi |
|---|---|
| Tanggal | 2026-11-23 |
| Pemilik | PM |
| Sumber | Permintaan pemilik proyek (7 poin) |
| Desain | `pm-agent/decisions/ADR-004-penyederhanaan-soal.md` |
| Prioritas | P0 |

## Evaluasi PM

Permintaan dipecah menjadi empat perubahan fungsional dan satu perubahan operasional:

1. Hilangkan konsep versi dari pengalaman pengguna (CMS, API, tryout), tanpa menghapus data lama.
2. Status soal disederhanakan menjadi `approved` sebagai publish/approve; `draft`/`review` dihapus; data lama dimigrasikan.
3. Tampilan pertanyaan memakai font normal di daftar soal CMS maupun daftar/detail tryout.
4. Daftar soal CMS memakai pagination server-side dengan default 20 baris per halaman.
5. QA melakukan regresi penuh; PM membuka release gate `REL-10` dan deploy hanya jika GO.

Keputusan detail ada di ADR-004. Tidak ada perubahan pada model role/permission.

## Acceptance Criteria

- [ ] Migrasi `015_simplify_question_status.sql` diterapkan; `schema.sql` dan `db/README.md` diperbarui.
- [ ] Semua soal existing `draft`/`review` menjadi `approved`; soal baru (manual + import) tersimpan `approved`.
- [ ] `draft` dan `review` tidak lagi diterima oleh database, backend validator, filter CMS, maupun OpenAPI.
- [ ] Tidak ada parameter `version`/`ready_version` dan tidak ada endpoint versi/readiness/varian di kontrak API yang diekspos.
- [ ] Backend dan presentation service menyajikan soal dari tabel inti; hanya soal `approved` yang muncul di tryout.
- [ ] Stem soal di daftar CMS dan daftar/detail tryout dirender tanpa bold (`font-weight: 400`).
- [ ] Daftar soal CMS mengirim `page`/`limit=20`, menampilkan kontrol halaman, dan total dari `pagination.total`.
- [ ] QA menjalankan seluruh test existing + skenario baru, 0 bug P0/P1, lalu merekomendasikan GO/NO-GO.
- [ ] Build dan deploy dilakukan bertahap dengan heap dibatasi; tidak ada OOM.
- [ ] Laporan sistem dan status board diperbarui.

## Serah Terima

| Task ID | Owner | Prioritas | Dependency | Status |
|---|---|---|---|---|
| PM-09 | PM | P0 | - | done |
| PM-10 | PM | P0 | PM-09 | done |
| BE-25 | Backend | P0 | ADR-004 | done |
| PRES-02 | Presentation | P0 | ADR-004 | done |
| FE-21 | Frontend | P0 | BE-25 | done |
| TRY-10 | Tryout | P0 | PRES-02 | done |
| DOC-06J | PM/Docs | P1 | BE-25, FE-21, TRY-10 | done |
| QA-22 | QA | P0 | BE-25, PRES-02, FE-21, TRY-10 | done |
| REL-10 | PM | P0 | QA-22 | done |
