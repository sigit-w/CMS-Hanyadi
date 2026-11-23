# Handoff — QA-22 / REL-10 (Fase 6j)

| Field | Isi |
|---|---|
| Task ID | QA-22, REL-10 |
| Nama task | Review ADR-004, regresi status/versi/pagination/tampilan, rekomendasi release gate |
| Agent pengirim | PM |
| Agent penerima | QA, PM |
| Tanggal | 2026-11-23 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-004-penyederhanaan-soal.md`, `pm-agent/tasks/phase6j-backlog.md`
- Endpoint / UI: seluruh endpoint yang berubah di BE-25/PRES-02, CMS `#/`, dan tryout peserta
- Bukti: baseline `qa-agent/reports/phase6-release-gate.md` (REL-09 GO, 99/99)

## Acceptance Criteria Terpenuhi

- [x] ADR-004 memuat perubahan schema, kontrak, dan migrasi data untuk ditinjau QA.
- [x] BE-25, PRES-02, FE-21, TRY-10 diuji; 118/118 lolos; T-01/T-02 ditutup; REL-10 GO.

## Catatan Kendala / Risiko

- `QA-22` adalah gate sebelum `REL-10`. Tinjau ADR lebih dulu; jika ditolak, PM revisi sebelum migrasi diterapkan.
- Uji negatif wajib: `draft`/`review` ditolak, `version`/`ready_version` ditolak atau diabaikan sesuai kontrak, soal archived tidak muncul, pagination page 2/3 serta filter + pagination.
- Verifikasi visual: stem tidak bold di daftar CMS, daftar tryout, dan detail tryout.
- Verifikasi data: semua soal lama `approved`, soal baru `approved`, submission lama tetap terbaca dengan `version='v1'`.
- Jalankan test satu proses dengan `NODE_OPTIONS=--max-old-space-size=128`; laporkan resource usage dan 0 bug P0/P1 sebelum GO.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
