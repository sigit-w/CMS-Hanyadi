# Handoff — BE-40

| Field | Isi |
|---|---|
| Task ID | BE-40 |
| Nama task | Migrasi `030`, model induk–sesi, dan API Fase 6u |
| Agent pengirim | PM |
| Agent penerima | Backend |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `db/migrations/030_tryout_events_and_sessions.sql`, `backend-agent/src/tryoutRoutes.js`, `backend-agent/src/validate.js`, `backend-agent/src/participantRoutes.js`, `backend-agent/src/tryoutReportRoutes.js`, `backend-agent/src/authRoutes.js`, `backend-agent/package.json`, lockfile, `backend-agent/openapi/openapi.yaml`
- Endpoint / UI: `POST /api/v1/tryouts` dengan `sessions[]`, `GET /api/v1/tryouts/:id`, `GET /api/v1/tryouts/:id/sessions`, `GET /api/v1/participants?search=...`, `GET /api/v1/reports/tryout/export.xlsx`
- Bukti (log, screenshot, test result): migrasi `030` terpasang; induk `tryout_events`, one-mapel per sesi, status turunan, search prospektus, ekspor XLSX, gate `ends_at`; `backend-agent/src/routes.js` `/tryout/questions` menghormati `session_id`; regresi 32/32; baseline DB `1|1|1|2|10|1|3`

## Acceptance Criteria Terpenuhi

- [x] Tabel induk `tryout_events` + `tryout_sessions.event_id`; backfill 1:1 dan pemecahan sesi multi-mapel terdokumentasi
- [x] `tryout_session_mapels` dibatasi satu mapel per sesi; payload `sessions[]` tervalidasi
- [x] Status turunan `terjadwal`/`berlangsung`/`selesai` tersedia di list/detail tanpa mengubah `is_active`
- [x] Pencarian prospektus aktif tersedia dan ID prospektus dapat dilampirkan; `bergabung=true` memakai ID siswa
- [x] `submission_count` lama tetap dikembalikan API untuk laporan; tidak ada metrik pengganti di daftar
- [x] Ekspor XLSX memakai `exceljs`, menyertakan roster tanpa submission, tanpa kunci jawaban
- [x] Gate batas akhir induk diterapkan pada login/soal/submit; slug sesi lama tetap diterima

## Catatan Kendala / Risiko

- Backup pre-migrasi wajib sebelum `030`; rollback ke `REL-26`.
- Constraint unik `is_active` lama tidak boleh dilanggar.
- Jangan menghapus `tryout_submissions` saat memindah `session_id`.
- Lockfile `exceljs` wajib masuk commit yang sama.
- Pertanyaan terbuka ADR-017 perlu konfirmasi sebelum mengubah perilaku halaman laporan.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
