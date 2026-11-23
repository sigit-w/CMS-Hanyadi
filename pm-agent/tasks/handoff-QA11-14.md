# Handoff — QA-11..QA-14 / REL-02 (Fase 6)

| Field | Isi |
|---|---|
| Task ID | QA-11, QA-12, QA-13, QA-14, REL-02 |
| Nama task | Review ADR, uji auth, uji RBAC, regresi & release gate Fase 6 |
| Agent pengirim | PM |
| Agent penerima | QA |
| Tanggal | 2026-11-22 |
| Status | review |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-001-auth-role.md`, `pm-agent/tasks/phase6-backlog.md`
- Endpoint / UI: seluruh endpoint auth/role, CMS, dan tryout yang berubah di Fase 6
- Bukti (log, screenshot, test result): laporan QA sebelumnya `qa-agent/reports/tryout-report.md`, `phase5-report.md`

## Acceptance Criteria Terpenuhi

- [x] Semua task Fase 6 memiliki ID, prioritas, dependency, dan AC.
- [x] ADR-001 memuat perubahan schema dan kontrak yang perlu ditinjau QA.
- [ ] Belum: implementasi Backend/Frontend/Tryout/Presentation/Infra untuk diuji.

## Catatan Kendala / Risiko

- `QA-11` adalah gate: sebelum ADR disetujui, `BE-13` tidak boleh diterapkan. Jika ditolak, catat alasan dan PM membuka ADR-002.
- Uji negatif wajib: tanpa cookie, cookie kadaluarsa, refresh reuse, privilege escalation, admin terakhir, dan akses tryout tanpa login.
- Pastikan 52 skenario tryout lulus setelah login wajib dan tidak ada bug P0/P1 sebelum `REL-02`.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
