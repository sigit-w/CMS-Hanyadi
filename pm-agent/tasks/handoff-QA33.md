# Handoff — QA-33

| Field | Isi |
|---|---|
| Task | QA-33 |
| ADR | `pm-agent/decisions/ADR-011-tryout-scoped-login-dan-pemisahan-siswa.md` |
| Dependency | BE-36, FE-33, TRY-15, PRES-03 |
| Status | ready |

## Scope

- Buat `qa-agent/tests/phase6s.mjs` dengan skenario login scoped positif/negatif, binding session, pemisahan daftar, dan konversi prospektus eksplisit.
- Sesuaikan helper login participant pada test lama agar memakai tryout fixture/slug.
- Regresi penuh `NODE_OPTIONS=--max-old-space-size=128 npm test`.
- Laporan `phase6s-report.md` dan `phase6s-release-gate.md` dengan `REL-21 GO`.

## Acceptance

Lihat `pm-agent/tasks/phase6s-backlog.md` bagian QA-33.
