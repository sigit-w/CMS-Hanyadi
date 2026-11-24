# Handoff — QA-30

| Field | Isi |
|---|---|
| Task ID | QA-30 |
| Nama task | Uji Fase 6p, Regresi Penuh & Gate REL-18 |
| Agent pengirim | PM |
| Agent penerima | QA |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-008-peserta-tryout-dan-prospektus.md`, `pm-agent/tasks/phase6p-backlog.md`
- Endpoint / UI: `qa-agent/tests/phase6p.mjs`, `qa-agent/reports/phase6p-report.md`, `qa-agent/reports/phase6p-release-gate.md`
- Bukti (log, screenshot, test result): PR-01..PR-08 lolos, regresi 150/150, `phase6p-report.md`, `phase6p-release-gate.md`

## Acceptance Criteria Terpenuhi

- [x] PR-01: skema `023` valid (kolom, constraint, index).
- [x] PR-02: default UI tidak merender siswa sebelum picker A dipilih.
- [x] PR-03: picker A/B, detail baris, dan trash icon sesuai ADR-008.
- [x] PR-04: hapus Umum → relasi hilang, prospek terisi, login ditolak, muncul di `/prospektus`.
- [x] PR-05: hapus Siswa → relasi hilang, baris participant identik, tidak masuk prospektus.
- [x] PR-06: menu dan route Prospektus serta label `Kelola Siswa` benar.
- [x] PR-07: regresi penuh lolos tanpa OOM.
- [x] PR-08: health, aset produksi, dan gate `REL-18 GO` terverifikasi.

## Catatan Kendala / Risiko

- Gunakan `QA_ADMIN_PASSWORD` dari `backend-agent/.env`.
- Cek `free -h`; jalankan test serial dengan heap 128 MB.
- Bersihkan fixture tryout/participant setelah pengujian; jangan mengubah sesi aktif produksi.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
