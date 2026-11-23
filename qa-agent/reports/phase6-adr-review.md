# QA-11 — Review ADR-001 & Test Plan Fase 6

| Field | Isi |
|---|---|
| Task ID | QA-11 |
| Tanggal | 2026-11-22 |
| Status | done |
| Keputusan | **Disetujui** (dengan amandemen ADR-001-A1) |

## Review ADR

| Aspek | Hasil | Catatan |
|---|---|---|
| Model pengguna | pass | `contributors` diperluas, tidak ada tabel `users` ganda |
| Model role | pass | `roles`, `user_roles`, `permissions`, `role_permissions`, guard admin terakhir |
| Session & cookie | pass | HttpOnly, Secure, SameSite=Lax, Domain `.hanyadi.web.id`, refresh berotasi |
| Kriptografi | pass | ADR-001-A1: `scrypt` + JWT HS256 via `node:crypto`, tanpa npm baru |
| Pemisahan CMS/tryout | pass | `cms.access` vs `tryout.access`; write variasi tetap `X-Presentation-Key` |
| Rahasia | pass | Bootstrap dari env; tidak ada kredensial di repository/log |
| Gate schema | pass | QA menyetujui migrasi `004_auth_roles.sql` untuk diterapkan |

Keputusan: `BE-13` boleh berjalan setelah laporan ini. Bila implementasi menyimpang dari ADR, QA membuka bug dan task dikembalikan ke pemiliknya.

## Test Plan Fase 6

| ID | Fokus | Kasus Uji |
|---|---|---|
| TP-01 | Login | admin valid → 200 + cookie; password salah → 401; user nonaktif → 403 |
| TP-02 | Session | `/auth/me` tanpa cookie → 401; refresh rotasi; reuse refresh lama → 401; logout → session revoked |
| TP-03 | RBAC | 401 tanpa cookie, 403 role salah pada endpoint CMS; eskalasi via body ditolak |
| TP-04 | Manajemen role | CRUD role, assign/revoke, guard admin terakhir, role nonaktif tidak bisa dipakai |
| TP-05 | Tryout | tanpa login tidak ada daftar soal/pembahasan; peserta bisa menjawab; write variasi tanpa key → 401 |
| TP-06 | Regresi | 19 smoke + 15 edge + 12 phase5 + 6 tryout tetap lolos setelah auth |

## Catatan Sumber Daya

- Pemeriksaan memori 2026-11-22: total 1935MB, available 299MB, swap 3293MB. QA akan menjalankan test bertahap (tidak paralel) dan memakai `NODE_OPTIONS=--max-old-space-size=128` untuk proses Node.
- Kredensial uji diambil dari env `BOOTSTRAP_ADMIN_USERNAME`/`BOOTSTRAP_ADMIN_PASSWORD`, tidak ditulis di test case.
