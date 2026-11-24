# Handoff — FE-33

| Field | Isi |
|---|---|
| Task | FE-33 |
| ADR | `pm-agent/decisions/ADR-011-tryout-scoped-login-dan-pemisahan-siswa.md` |
| Dependency | BE-36 kontrak |
| Status | ready |

## Scope

- Manajemen Tryout: tampilkan URL `https://tryout.hanyadi.web.id/{slug}` read-only + tombol salin.
- Kelola Siswa: pakai endpoint khusus `siswa`, jangan `GET /participants` gabungan.
- Picker `A. Peserta Didik` dan daftar peserta tryout: pakai endpoint siswa/tryout participants.
- Prospektus: pertahankan tombol **Daftarkan Siswa** untuk konversi eksplisit.
- Build dengan `NODE_OPTIONS=--max-old-space-size=256 npm run build`.

## Acceptance

Lihat `pm-agent/tasks/phase6s-backlog.md` bagian FE-33.
