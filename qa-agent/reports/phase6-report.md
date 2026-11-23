# Laporan QA Fase 6 — Auth & Manajemen Role

| Field | Isi |
|---|---|
| Tanggal | 2026-11-22 |
| Task | QA-11, QA-12, QA-13, QA-14, QA-15, QA-16, QA-17, QA-18, QA-19 |
| Hasil | **99 test, 99 pass, 0 fail** |
| Bug P0/P1 | 0 |

## Ringkasan Eksekusi

| Grup | Jumlah | Hasil | Bukti |
|---|---|---|---|
| Smoke Fase 3 (S-01..S-19) | 19 | pass | `qa-agent/tests/mvp-smoke.mjs` |
| Edge Fase 3 (S-20..S-34) | 15 | pass | `qa-agent/tests/mvp-edge.mjs` |
| Fase 5 (P5-01..P5-14) | 14 | pass | `qa-agent/tests/phase5.mjs` |
| Peserta tryout (P-01..P-08) | 8 | pass | `qa-agent/tests/participants.mjs` |
| Tryout + gate login (T-01..T-08) | 8 | pass | `qa-agent/tests/tryout.mjs` |
| Auth/RBAC + create user + permission + ubah password (A-01..A-17) | 17 | pass | `qa-agent/tests/auth-rbac.mjs` |
| Upload & grading (U-01..U-09) | 9 | pass | `qa-agent/tests/upload-grading.mjs` |
| Manajemen soal (M-01..M-03) | 3 | pass | `qa-agent/tests/question-management.mjs` |
| Laporan & manajemen tryout (TR-01..TR-06) | 6 | pass | `qa-agent/tests/tryout-report.mjs` |

Perintah: `QA_ADMIN_PASSWORD=<dari env> NODE_OPTIONS=--max-old-space-size=128 npm test` di `backend-agent/`.

## QA-12 — Login, sesi, cookie

- Login admin valid → 200, cookie `access_token` dan `refresh_token` memiliki `HttpOnly`, `Secure`, `SameSite=Lax`, `Domain=.hanyadi.web.id`.
- Password salah → 401; endpoint tanpa cookie → 401.
- Refresh berotasi; pemakaian ulang refresh lama → 401.
- Logout mencabut sesi: `/auth/me` dengan token lama → 401.
- Percobaan login gagal dihitung dan akun dikunci sementara setelah batas (`AUTH_MAX_FAILED_LOGIN`).

## QA-13 — RBAC & manajemen role

- Lima role seed: `admin`, `editor`, `validator`, `viewer`, `peserta` (26 permission mapping).
- Admin: CRUD role, lihat user, berikan/cabut role — lolos.
- Viewer: bisa baca soal (200), tidak bisa menulis soal (403), tidak bisa mengelola role (403).
- Escalation via body request ditolak middleware server, bukan hanya disembunyikan UI.
- Guard admin terakhir: 409 saat mencoba mencabut role admin tunggal.
- Role non-sistem dapat dinonaktifkan; role sistem tidak bisa dihapus (409).

## QA-14 — Regresi CMS & tryout

- 52 test lama tetap lolos setelah middleware auth dipasang (test diperbarui memakai cookie login, bukan melewati auth).
- CMS: `/api/v1/categories` 401 tanpa cookie, 200 dengan cookie.
- Tryout: halaman memuat gate login; daftar soal dan pembahasan tidak dirender sebelum sesi aktif.
- Presentation service: baca variasi 401 tanpa cookie, 200 dengan cookie; tulis variasi tetap menolak tanpa `X-Presentation-Key`.
- Akses produksi via proxy `cms.hanyadi.web.id` dan `tryout.hanyadi.web.id` terverifikasi.

## Catatan Sumber Daya

- Sebelum eksekusi: total 1935MB, available 299MB, swap 3293MB.
- Sesudah deploy: total 1935MB, available 407MB, swap 3101MB. Tidak ada OOM, tidak ada restart tak sengaja.
- Semua proses Node dibatasi `NODE_OPTIONS` (API 128M, presentation 96M, test 128M). Tidak ada package npm baru.

## QA-15 — Pemisahan halaman input soal & buat user (Fase 6b)

- `POST /api/v1/users` (A-09 dipakai sebagai alur utama pembuatan viewer): 201, role `viewer` melekat, login langsung berhasil.
- Validasi create user (A-11): password <12 karakter → 400; username duplikat → 409; role tidak ditemukan → 400.
- Bundle CMS (P5-14) memuat judul `Halaman Input Soal`, `Halaman Buat User`, menu `Input Soal`, `Buat User`, dan route `#/questions/new`, `#/users/new`.
- Halaman input soal tidak lagi memuat form pembuatan user; manajemen role juga dipisah ke menu `Kelola Role`.
- Regresi produksi: CMS menyajikan aset `index-Ca1MfYYo.js`, `/auth/me` tanpa cookie 401, tryout 200, service active, memory available 389 MB. Tidak ada OOM.

## QA-16 — Regresi akses peserta tryout (Fase 6c)

- Reproduksi sebelum perbaikan: akun `peserta` (permission `tryout.access`, `presentation.read`) memperoleh 403 dari `/api/v1/questions`, yang memicu pesan "Sesi berakhir" di UI.
- Sesudah perbaikan: `/api/v1/tryout/questions?version=v1` → 200 untuk peserta; payload hanya berisi `id`, `stem`, `question_type`, `difficulty`, `category_code`, `category_name` (tanpa kunci jawaban).
- T-05: semua soal ready v1 dari endpoint tryout dapat diambil detailnya dari presentation-service dengan sesi peserta yang sama.
- T-08: peserta tetap ditolak 403 di endpoint CMS `/api/v1/questions`.
- T-07: tanpa sesi, endpoint tryout → 401 dan presentation → 401.
- Verifikasi produksi memakai akun peserta sementara; akun dibersihkan setelah pengujian.

## QA-17 — Checkbox permission RBAC (Fase 6d)

- A-12: `GET /permissions` mengembalikan 9 permission untuk admin; viewer memperoleh 403.
- A-13: role uji berhasil disimpan dengan `presentation.read` + `questions.read` dan terbaca ulang dari `GET /roles`; kode permission palsu ditolak 400; non-admin ditolak 403.
- Proteksi lockout: menghapus `roles.manage` dari role admin ditolak 409.
- P5-14: bundle CMS memuat marker `Simpan Hak Akses` dan `Pilih semua`.
- Verifikasi produksi memakai role uji; role dibersihkan setelah pengujian.

## QA-18 — Ubah password oleh admin (Fase 6e)

- A-14: konfirmasi beda → 400; password <12 karakter → 400; payload valid → 200 dengan `password_changed` dan `sessions_revoked`.
- Login dengan password lama → 401; login dengan password baru → 200.
- Refresh token lama milik pengguna tersebut → 401 setelah sesi dicabut.
- Permintaan ubah password memakai cookie korban yang sudah dicabut → 401; akses admin tetap normal (A-15).
- P5-14: bundle CMS memuat marker `Ubah Password`.
- Verifikasi produksi memakai user uji; user dibersihkan setelah pengujian.

## QA-19 — Permission users.password.write di RBAC (Fase 6f)

- A-12: daftar permission bertambah menjadi 10 kode, termasuk `users.password.write`.
- A-16: role uji tanpa permission tersebut menolak ubah password dengan 403; setelah admin mencentang permission lewat `PUT /roles/{id}/permissions`, permintaan yang sama berhasil 200 dan login dengan password baru berhasil.
- Migrasi `005_user_password_permission.sql` dijalankan dua kali tanpa duplikat mapping.
- Verifikasi produksi mengikuti skenario yang sama; user dan role uji dibersihkan.

## QA-21 — Peserta tryout sebagai identity terpisah (Fase 6i)

- Migrasi `010_tryout_participants.sql` terpasang: tabel `tryout_participants`, `participant_id` di sesi/submission/relasi, dan role `peserta` dinonaktifkan.
- P-01..P-03: admin membuat/update peserta; peserta login dengan email, memperoleh permission `tryout.access` + `presentation.read`, dan tetap 403 di endpoint CMS.
- P-04..P-06: email duplikat 409, validasi password/konfirmasi 400, reset password admin mencabut sesi lama.
- P-07: `POST /api/v1/users` dengan role `peserta` ditolak 400; role lama tetap ada dengan `is_active=false`.
- P-08: nonaktif/hapus peserta membuat login berikutnya gagal 401.
- Regresi: T-03..T-05, TR-05/TR-06, dan U-04..U-08 diperbarui memakai participant ID; seluruh 99 test lolos.

## Rekomendasi

Lolos untuk release gate `REL-02`, `REL-03` (Fase 6b), `REL-04` (Fase 6c), `REL-05` (Fase 6d), `REL-06` (Fase 6e), `REL-07` (Fase 6f), dan `REL-09` (Fase 6g). Tidak ada bug terbuka.
