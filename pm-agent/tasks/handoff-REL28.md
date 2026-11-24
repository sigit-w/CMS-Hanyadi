# Handoff — REL-28

| Field | Isi |
|---|---|
| Task ID | REL-28 |
| Nama task | Gate produksi Fase 6v: filter dan format laporan tryout |
| Agent pengirim | PM |
| Agent penerima | Release |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `pm-agent/progress/status-board.md`, `pm-agent/tasks/phase6v-backlog.md`
- Endpoint / UI: `#/reports/tryout`, `GET /api/v1/tryout-sessions?search=`, `GET /api/v1/reports/tryout/export.xlsx?session_id=&tryout_name=`
- Bukti (log, screenshot, test result): QA final `36 tests, 36 pass, 0 fail`; DOC `YAML OK 3.0.3 56`, `git diff --check` OK. Services `bank-soal-api.service` dan `bank-soal-presentation.service` active; `/health` 200; build frontend sukses; backup pre-6v `/tmp/opencode/bank_soal_db-pre6v-2026-11-24.dump` (332248 bytes); rollback ke `REL-27`; tanpa migrasi DB.

## Acceptance Criteria Terpenuhi

- [x] Backup/rollback ke `REL-27` disiapkan dan path backup dicatat
- [x] Deploy perubahan BE-41 dan FE-38 ke produksi setelah QA-38 lolos
- [x] Smoke test: halaman laporan tanpa dua section lama, filter sesi + `Cari/Filter`, unduh XLSX dengan `tryout_name` dan format sesuai `ADR-018`, endpoint legacy masih merespons
- [x] Regresi `REL-24…REL-27` lolos; DOC-09 valid; gate `REL-28` ditandai GO/NO-GO oleh PM/Release

## Catatan Kendala / Risiko

- Gate `REL-28` GO. Rollback ke `REL-27`; `REL-01…REL-27` tidak dibuka ulang; Fase 7 tetap dibatalkan.
- Baseline DB final `2|3|3|6|40|5|3` = 2 events, 3 sessions (271,375,376), 3 junction, 6 relasi peserta, 40 submissions, 5 attempts, `cbt_max_violations=3`. Fixture pemilik event48/sesi375,376/peserta495,496/attempts76..79 dipertahankan.
- Risiko diterima: peserta yang tidak terdaftar di semua sesi mendapat nilai 0 untuk mapel lain (perilaku nilai kosong); klien legacy wajib mengirim `event_id`/`eventId` yang valid.
- Seluruh perubahan Fase 6v telah di-commit dan di-push ke `origin/main` di `425ce3d` — `Finalisasi Fase 6v — filter dan format laporan tryout` — sesuai permintaan user.

## Tindakan Penerima

- [x] Diterima
