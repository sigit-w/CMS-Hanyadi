# Handoff — BE-13..BE-17 (Fase 6)

| Field | Isi |
|---|---|
| Task ID | BE-13, BE-14, BE-15, BE-16, BE-17 (koordinasi PRES-01) |
| Nama task | Migrasi auth/role, endpoint auth, manajemen role, middleware RBAC, test otomatis |
| Agent pengirim | PM |
| Agent penerima | Backend |
| Tanggal | 2026-11-22 |
| Status | review |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-001-auth-role.md`, `pm-agent/tasks/phase6-backlog.md`
- Endpoint / UI: `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, CRUD `/api/v1/roles`, `GET /api/v1/users`, `GET/POST/DELETE /api/v1/users/:id/roles`
- Bukti (log, screenshot, test result): status board per 2026-11-21 (Fase 3–5 & tryout `done`, `REL-01` GO)

## Acceptance Criteria Terpenuhi

- [x] Requirement diturunkan menjadi task dengan ID, owner, prioritas, dependency, dan AC.
- [x] Desain auth, model role, dan matriks permission diputuskan di ADR-001.
- [x] Kontrak API ditulis lebih dulu oleh Backend sebelum Frontend/Tryout mengonsumsi.
- [ ] Belum: review QA terhadap ADR-001 (`QA-11`) — gate sebelum `BE-13` diterapkan.

## Catatan Kendala / Risiko

- Perubahan schema wajib ditinjau QA sebelum migrasi (`docs/agent-workflow.md` §7). Jika ADR ditolak, task berstatus `blocked` dan PM membuka ADR-002.
- Kredensial admin bootstrap harus dari environment variable; jangan pernah menaruh password di repository atau log.
- Semua endpoint lama Fase 3–5 berubah kontraknya (butuh cookie + permission), kecuali `/health` dan `/auth/login`.
- Koordinasikan `PRES-01` dengan service presentation: secret JWT bersama `AUTH_JWT_SECRET`, endpoint write tetap `X-Presentation-Key`.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
