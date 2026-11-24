# Handoff — BE-36

| Field | Isi |
|---|---|
| Task | BE-36 |
| ADR | `pm-agent/decisions/ADR-011-tryout-scoped-login-dan-pemisahan-siswa.md` |
| Status | ready |

## Scope

- Buat migrasi `db/migrations/025_tryout_slug_login_scope.sql`: backup dulu, slug unik `tryout_sessions`, binding `auth_sessions.tryout_session_id`, rollback defensif konversi REL-20 ke `prospektus`.
- `POST /api/v1/auth/login`: participant wajib `tryout_slug`; validasi tryout aktif, jadwal, dan keanggotaan `tryout_session_participants`.
- Simpan binding tryout di `auth_sessions`, JWT, `/auth/me`, dan `refresh`.
- Endpoint baru `GET /api/v1/siswa` (hanya `public.siswa`) dan `GET /api/v1/tryouts/{id}/participants` (hanya peserta terlampir).
- Perbarui OpenAPI & `db/README.md`.

## Acceptance

Lihat `pm-agent/tasks/phase6s-backlog.md` bagian BE-36. Jalankan `node --check` dan restart `bank-soal-api`.
