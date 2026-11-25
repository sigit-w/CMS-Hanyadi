# Handoff — DOC-14

| Field | Isi |
|---|---|
| Task ID | DOC-14 |
| Nama task | Template import, kontrak API, dan dokumentasi jenjang pendidikan |
| Agent pengirim | PM |
| Agent penerima | Dokumentasi |
| Tanggal | 2026-11-25 |
| Status | review |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-023-jenjang-pendidikan-soal-lembar-tryout-program.md`, `pm-agent/tasks/phase6aa-backlog.md`
- Endpoint / UI: kontrak `/questions`, `/questions/import`, `/question-sheets`, `/tryouts`, `/program-belajar`
- Bukti: masukan pemilik 2026-11-25 dan pemetaan template `frontend-agent/public/templates/template-soal.csv|xlsx`, `backend-agent/openapi/openapi.yaml`, `db/README.md`, `backend-agent/README.md`, laporan sistem

## Acceptance Criteria Terpenuhi

- [ ] AC3: template CSV dan XLSX diperbarui dengan 19 header identik; `jenjang` berada setelah `mapel`; contoh memakai `SD`/`SMP`/`SMA` dan langsung lolos import
- [ ] AC8: OpenAPI mencatat `jenjang` wajib, query filter jenjang, pattern kode lembar `^LS-[A-Z0-9]{4}-(SD|SMP|SMA)-[0-9]{4}$`, dan field jenjang pada tryout/program belajar
- [ ] AC8: `db/README.md`, `backend-agent/README.md`, `docs/architecture.md`, dan laporan sistem menjelaskan migrasi `034`, backfill `SD`, serta dampak ke alur soal/lembar/tryout/program
- [ ] AC8: ADR-023, backlog Fase 6aa, README PM, dan status board saling merujuk

## Catatan Kendala / Risiko

- XLSX bukan sekadar rename: sheet dan shared strings harus konsisten dengan urutan header CSV.
- Jangan menghapus catatan `REL-24…REL-32`; Fase 6aa menambah `REL-33` dengan rollback `REL-32`.
- Jangan menuliskan secret dari `backend-agent/.env` ke dokumentasi atau contoh.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
