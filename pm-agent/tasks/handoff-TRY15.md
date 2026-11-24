# Handoff — TRY-15

| Field | Isi |
|---|---|
| Task | TRY-15 |
| ADR | `pm-agent/decisions/ADR-011-tryout-scoped-login-dan-pemisahan-siswa.md` |
| Dependency | BE-36 kontrak |
| Status | ready |

## Scope

- Baca slug dari segmen path `/{slug}` (reserved: `api`, `assets`, `health`, `favicon.ico`).
- Kirim `tryout_slug` saat login participant.
- Tampilkan pesan jelas untuk root/reserved/slug invalid; jangan bocorkan keberadaan akun/tryout.
- Bump versi aset `app.js`/`styles.css`.

## Acceptance

Lihat `pm-agent/tasks/phase6s-backlog.md` bagian TRY-15.
