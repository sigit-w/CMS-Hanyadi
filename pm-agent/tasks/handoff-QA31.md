# Handoff — QA-31

| Field | Isi |
|---|---|
| Task ID | QA-31 |
| Nama task | Uji Fase 6q, Regresi Penuh & Gate REL-19 |
| Agent pengirim | PM |
| Agent penerima | QA |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-009-kelola-peserta-tryout.md`, `pm-agent/tasks/phase6q-backlog.md`
- Endpoint / UI: `qa-agent/tests/phase6q.mjs`, `qa-agent/reports/phase6q-report.md`, `qa-agent/reports/phase6q-release-gate.md`
- Bukti (log, screenshot, test result): `qa-agent/reports/phase6q-report.md`, `phase6q-release-gate.md`, regresi 155/155

## Acceptance Criteria Terpenuhi

- [x] QP-01 helper text lama tidak ada di source/bundle.
- [x] QP-02 popup Kelola Peserta memiliki A/B dan marker alur target.
- [x] QP-03 attach siswa existing idempoten dan validasi negatif.
- [x] QP-04 Umum baru terlampir; trash/Prospektus tetap benar.
- [x] QP-05 regresi penuh, health produksi, dan gate `REL-19 GO`.

## Catatan Kendala / Risiko

- Perbarui asersi lama `phase6p.mjs` PR-02 yang masih mencari helper text.
- Gunakan `QA_ADMIN_PASSWORD` dari `backend-agent/.env`.
- Cek `free -h`; test serial heap 128 MB; bersihkan fixture.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
