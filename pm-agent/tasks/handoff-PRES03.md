# Handoff — PRES-03

| Field | Isi |
|---|---|
| Task | PRES-03 |
| ADR | `pm-agent/decisions/ADR-011-tryout-scoped-login-dan-pemisahan-siswa.md` |
| Dependency | BE-36 kontrak JWT |
| Status | ready |

## Scope

- Daftar soal dan submit memakai `tryout_session_id` dari JWT/session.
- Hapus/fallback logika `ORDER BY is_active DESC LIMIT 1` sebagai penentu akses.
- Pastikan mengganti path slug setelah login tidak mengubah tryout yang diakses.
- Regresi health presentation-service.

## Acceptance

Lihat `pm-agent/tasks/phase6s-backlog.md` bagian PRES-03.
