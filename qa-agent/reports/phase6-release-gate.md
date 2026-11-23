# Release Gate — Fase 6 (REL-02)

| Field | Isi |
|---|---|
| Tanggal | 2026-11-22 |
| Keputusan | **GO** |
| Disetujui | QA (`qa-agent/reports/phase6-report.md`) dan PM |
| Bug P0/P1 | 0 |
| Test | 65/65 lulus |

## Syarat Gate

| Syarat | Status | Bukti |
|---|---|---|
| ADR-001 disetujui QA sebelum migrasi | pass | `qa-agent/reports/phase6-adr-review.md` |
| Migrasi `004_auth_roles.sql` idempotent & terpasang | pass | Log deploy 2026-11-22 |
| Login wajib CMS & tryout | pass | 401 tanpa cookie di kedua domain |
| Manajemen role berfungsi | pass | A-07, A-09, A-10 |
| Matriks permission 5 role teruji | pass | A-04, A-09, A-13 |
| Regresi Fase 3–5 & tryout | pass | 52 test lama + 9 tryout |
| Cookie aman & tidak ada secret di repository | pass | A-03; kredensial hanya di `.env` mode 600 |
| Memori aman sebelum/sesudah deploy | pass | available 299MB → 407MB |

## Catatan

- Akun admin bootstrap dibuat dari env var, password disampaikan langsung ke pemilik proyek dan tidak dicatat di artifact mana pun.
- Pembaruan permission pada access token mengikuti TTL 15 menit untuk presentation service; backend membaca permission langsung dari database sehingga perubahan role segera berlaku di CMS.

Tanda tangan: QA — disetujui; PM — disetujui.

## REL-03 — Fase 6b: Pemisahan Halaman (2026-11-22)

| Gate | Hasil | Bukti |
|---|---|---|
| Endpoint create user | pass | A-09/A-11, OpenAPI `0.3.0` |
| Menu & halaman terpisah | pass | P5-14, `#/questions/new` vs `#/users/new` |
| Regresi CMS & tryout | pass | 67/67 test, aset produksi terverifikasi |
| Memori aman sebelum/sesudah deploy | pass | available 408MB → 389MB |

Keputusan: **GO**. Tanda tangan: QA — disetujui; PM — disetujui.

## REL-04 — Perbaikan Akses Peserta Tryout (2026-11-22)

| Gate | Hasil | Bukti |
|---|---|---|
| Endpoint tryout khusus peserta | pass | `GET /api/v1/tryout/questions`, OpenAPI diperbarui |
| Peserta bisa list & baca soal | pass | T-03/T-05, verifikasi produksi 200/200 |
| Tidak ada kebocoran kunci jawaban | pass | payload daftar tanpa `answer_text`/`correct_key` |
| Endpoint CMS tetap terlindungi | pass | T-08, peserta 403 di `/api/v1/questions` |
| Regresi | pass | 68/68 test |

Keputusan: **GO**. Tanda tangan: QA — disetujui; PM — disetujui.

## REL-05 — Checkbox Permission RBAC (2026-11-22)

| Gate | Hasil | Bukti |
|---|---|---|
| API permission & update role | pass | A-12/A-13, OpenAPI diperbarui |
| UI checkbox per role | pass | P5-14, Simpan Hak Akses / Pilih semua |
| Validasi & proteksi admin | pass | 400 untuk kode invalid, 409 untuk hapus roles.manage, 403 non-admin |
| Regresi | pass | 70/70 test, produksi terverifikasi |

Keputusan: **GO**. Tanda tangan: QA — disetujui; PM — disetujui.

## REL-06 — Ubah Password (2026-11-22)

| Gate | Hasil | Bukti |
|---|---|---|
| Endpoint ubah password | pass | A-14, OpenAPI diperbarui |
| Validasi & sesi | pass | 400 untuk konfirmasi/password invalid, sesi lama dicabut |
| Login setelah ubah | pass | password lama 401, password baru 200 |
| Regresi | pass | 71/71 test, produksi terverifikasi |

Keputusan: **GO**. Tanda tangan: QA — disetujui; PM — disetujui.

## REL-07 — Permission Ubah Password di RBAC (2026-11-22)

| Gate | Hasil | Bukti |
|---|---|---|
| Migrasi permission baru | pass | `005_user_password_permission.sql`, idempotent |
| Checkbox RBAC | pass | `users.password.write` tampil di `GET /permissions` |
| Enforcemen server & UI | pass | A-16 403 → 200, panel disembunyikan tanpa permission |
| Regresi | pass | 72/72 test, produksi terverifikasi |

Keputusan: **GO**. Tanda tangan: QA — disetujui; PM — disetujui.

## REL-09 — Peserta Tryout Terpisah dari User CMS (2026-11-22)

| Gate | Hasil | Bukti |
|---|---|---|
| Migrasi `010_tryout_participants.sql` | pass | Tabel, constraint, dan backfill terverifikasi di DB |
| CRUD peserta & reset password | pass | P-01..P-06, `qa-agent/tests/participants.mjs` |
| Role `peserta` tidak tersedia di Buat User | pass | P-07, backend 400, role legacy `is_active=false` |
| Halaman Kelola Peserta di Manajemen Tryout | pass | `#/tryouts/peserta`, build CMS terverifikasi |
| Sesi, submission, dan laporan memakai participant ID | pass | T-03..T-05, TR-05/TR-06, U-04..U-08 |
| Regresi | pass | 99/99 test, 0 P0/P1 |

Keputusan: **GO**. Tanda tangan: QA — disetujui; PM — disetujui.
