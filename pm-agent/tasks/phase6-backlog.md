# Backlog Fase 6 — Manajemen Role & Autentikasi

Requirement (2026-11-22): CMS mendapat fitur lanjutan manajemen role, dan CMS serta tryout wajib login untuk diakses. Keputusan desain ada di `pm-agent/decisions/ADR-001-auth-role.md` (review QA wajib sebelum migrasi).

Status mengikuti `docs/agent-workflow.md`: `backlog`, `ready`, `in_progress`, `review`, `done`, `blocked`. Prioritas: `P0` wajib rilis, `P1` penting, `P2` penyiapan berikutnya. ID melanjutkan status board per 2026-11-21.

## PM Agent

| ID | Task | Prioritas | Dependency | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| PM-05 | Kunci requirement & tulis ADR-001 (auth + model role) | P0 | - | ADR-001 berisi keputusan, matriks permission, alternatif, dan review QA sebagai gate | done |
| PM-06 | Susun breakdown, prioritas, dependency, dan AC Fase 6 per agent | P0 | PM-05 | Semua task punya ID, owner, prioritas, dependency, AC | done |
| PM-07 | Terbitkan handoff PM→Backend/Frontend/Tryout/QA dan pantau dependency | P0 | PM-06 | Empat handoff terisi; blocker tercatat dengan pemilik | done |
| PM-08 | Release gate Fase 6 bersama QA | P0 | QA-14 | Laporan GO/NO-GO ditandatangani PM & QA, tanpa bug P0/P1 | done |

## Backend Agent

| ID | Task | Prioritas | Dependency | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| BE-13 | Migrasi `004_auth_roles.sql`: perluas `contributors`, tabel `roles`/`user_roles`/`permissions`/`role_permissions`/`auth_sessions`, seed role + admin bootstrap | P0 | PM-05, QA-11 | Migrasi idempotent; 5 role default ada; password admin dari env, tidak hard-coded; mapping `reviewer`→`validator`, `qa`→`viewer` | done |
| BE-14 | Endpoint auth: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` | P0 | BE-13 | Cookie HttpOnly/Secure/SameSite=Lax/Domain=.hanyadi.web.id; hash bcrypt; refresh berotasi; logout mencabut sesi; 401 untuk kredensial salah | done |
| BE-15 | Endpoint manajemen role & penugasan: CRUD `/roles`, `GET /users`, `GET/POST/DELETE /users/:id/roles` | P0 | BE-13, BE-14 | Hanya `roles.manage`; validasi role aktif; tidak bisa menghapus admin terakhir; perubahan tercatat di `updated_at` | done |
| BE-16 | Middleware `authenticate` + `authorize(permission)` pada semua endpoint CMS, kontrak OpenAPI diperbarui | P0 | BE-14, BE-15 | Tanpa cookie → 401; role salah → 403; semua endpoint Fase 3–5 terlindungi kecuali `/health` & `/auth/login`; OpenAPI mencantumkan security scheme cookie | done |
| BE-17 | Test otomatis auth & RBAC (positif, negatif, eskalasi privilege) | P0 | BE-13..BE-16 | `npm test` lulus, termasuk kasus cookie kadaluarsa, refresh rotasi, dan guard admin terakhir | done |

## Frontend Agent (CMS)

| ID | Task | Prioritas | Dependency | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| FE-10 | Halaman login, session guard, refresh otomatis, logout | P0 | BE-14 | Akses `/` tanpa sesi dialihkan ke `/login`; 401 memicu refresh lalu logout; cookie dikirim dengan `credentials: 'include'` | done |
| FE-11 | UI manajemen role & penugasan role pengguna (admin only) | P0 | BE-15 | Admin bisa buat/ubah/nonaktifkan role dan memberi/cabut role user; non-admin tidak melihat menu | done |
| FE-12 | Terapkan RBAC pada navigasi dan tombol aksi CMS | P0 | BE-16, FE-10 | Tombol create/edit/validasi/manage role tersembunyi sesuai permission; server tetap menolak jika dipaksa | done |
| FE-13 | Build produksi & regresi UI CMS | P1 | FE-10..FE-12 | Build sukses; alur input/upload/filter/readiness tidak regressi | done |

## Presentation Service

| ID | Task | Prioritas | Dependency | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| PRES-01 | Validasi JWT cookie pada endpoint baca tryout; write tetap `X-Presentation-Key` | P0 | BE-14 | Tanpa sesi/role `tryout.access` → 401/403; JWT diverifikasi dengan `AUTH_JWT_SECRET`; endpoint write tidak berubah | done |

## Tryout Agent

| ID | Task | Prioritas | Dependency | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| TRY-04 | Halaman login tryout + gate akses sebelum merender konten | P0 | BE-14 | Tanpa sesi aktif tidak ada daftar soal, pembahasan, atau skor yang tampil; setelah login alur v1/v2/v3 normal | done |
| TRY-05 | Kirim kredensial cookie ke API & presentation service, tangani 401/403 | P0 | TRY-04, BE-16, PRES-01 | Semua `fetch` memakai `credentials: 'include'`; expired session menampilkan pesan dan kembali ke login | done |
| TRY-06 | Regresi alur jawab & pembahasan dengan sesi peserta | P1 | TRY-04, TRY-05 | 52 skenario tryout lulus dengan login; tanpa login semua data ditolak | done |

## Infra

| ID | Task | Prioritas | Dependency | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| INF-02 | Proxy `/api/` + CORS credentials + cookie domain `.hanyadi.web.id` + header keamanan | P0 | BE-14, FE-10, TRY-04 | Login di cms berlaku di tryout; preflight OK; `Secure`/`HttpOnly`/`SameSite` terlihat di browser | done |
| INF-03 | Pastikan aset/statik tryout tidak membocorkan soal tanpa login | P1 | TRY-04 | Halaman kosong/redirect sebelum autentikasi; opsi hardening `auth_request` dicatat bila dipakai | done |

## QA Agent

| ID | Task | Prioritas | Dependency | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| QA-11 | Review ADR-001 & susun test plan auth/RBAC | P0 | PM-05 | ADR disetujui/ditolak tertulis; checklist login, cookie, RBAC, migrasi, regresi siap | done |
| QA-12 | Uji login/logout/refresh, hashing, cookie flags, rate limit | P0 | BE-17 | Kredensial salah, cookie kadaluarsa, refresh reuse, dan brute-force dasar ditolak | done |
| QA-13 | Uji manajemen role & matriks permission lintas role | P0 | BE-17, FE-11, FE-12 | 5 role diuji positif/negatif; eskalasi privilege gagal; admin terakhir terlindungi | done |
| QA-14 | Regresi CMS & tryout + laporan release gate Fase 6 | P0 | QA-12, QA-13, FE-13, TRY-06, INF-02, INF-03 | Laporan berisi hasil, bug tersisa, rekomendasi GO/NO-GO | done |
| REL-02 | Release gate Fase 6 (PM + QA) | P0 | QA-14 | Tidak ada bug P0/P1; tanda tangan PM & QA tercatat | done |

## Fase 6b — Pemisahan Halaman (tambahan pemilik proyek)

| ID | Task | Prioritas | Dependency | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| BE-18 | Endpoint create user + OpenAPI | P0 | BE-15 | `POST /api/v1/users` membuat akun + role, menolak password <12, role invalid, duplikat username/email | done |
| FE-14 | Navigasi & routing terpisah | P0 | BE-18 | Menu Input Soal (`#/questions/new`) dan Buat User (`#/users/new`) berbeda; RBAC tetap berlaku | done |
| FE-15 | Pecah komponen per halaman | P0 | FE-14 | `pages/Dashboard.jsx`, `pages/QuestionInput.jsx`, `pages/UserManagement.jsx`, `pages/RoleManagement.jsx`; form user tidak ada di halaman input soal | done |
| QA-15 | Regresi pemisahan halaman | P0 | BE-18, FE-15 | 67 test lulus; marker bundle memuat judul dan route kedua halaman | done |
| REL-03 | Release gate Fase 6b | P0 | QA-15 | Tidak ada regresi CMS/tryout; deploy produksi tercatat | done |

## Fase 6c — Perbaikan Akses Peserta Tryout

| ID | Task | Prioritas | Dependency | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| BE-19 | Endpoint daftar soal khusus peserta | P0 | BE-14 | `GET /api/v1/tryout/questions?version=v1` hanya soal `is_ready=true`, Permission `tryout.access`, tidak mengembalikan kunci/pembahasan | done |
| TRY-07 | Perbaiki alur list tryout & pesan error | P0 | BE-19 | UI tidak memakai `/questions`; 403 ditampilkan sebagai "Akun Anda tidak memiliki akses tryout."; aset `?v=4` | done |
| QA-16 | Regresi peserta | P0 | BE-19, TRY-07 | 68 test lulus; peserta bisa list + baca soal, tetap 403 di endpoint CMS | done |
| REL-04 | Release gate perbaikan peserta | P0 | QA-16 | Produksi terverifikasi dengan akun peserta; tidak ada regresi CMS | done |

## Fase 6d — Checkbox Permission RBAC

| ID | Task | Prioritas | Dependency | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| BE-20 | API daftar & update permission role | P0 | BE-15 | `GET /permissions` mengembalikan 9 permission; `PUT /roles/{id}/permissions` mengganti seluruh mapping secara atomik; kode invalid 400; admin wajib menyimpan `roles.manage` (409 jika dihapus) | done |
| FE-16 | UI checkbox hak akses per role | P0 | BE-20 | Menu Kelola Role menampilkan daftar role + checkbox permission bergrup; ada Pilih semua/Kosongkan dan tombol Simpan Hak Akses | done |
| QA-17 | Regresi RBAC checkbox | P0 | BE-20, FE-16 | 70 test lulus; non-admin 403; perubahan langsung terbaca backend | done |
| REL-05 | Release gate checkbox RBAC | P0 | QA-17 | Produksi terverifikasi, OpenAPI diperbarui, tidak ada regresi | done |

## Fase 6e — Ubah Password (Admin)

| ID | Task | Prioritas | Dependency | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| BE-21 | Endpoint ubah password user | P0 | BE-15 | `PUT /users/{id}/password` hanya admin; min 12 karakter; konfirmasi cocok; hash scrypt; reset failed login & cabut sesi lama | done |
| FE-17 | UI ubah password | P0 | BE-21 | Di halaman Buat User tersedia pilihan pengguna, password baru, konfirmasi, dan tombol Ubah Password | done |
| QA-18 | Regresi ubah password | P0 | BE-21, FE-17 | 71 test lulus; login password lama 401, baru 200; refresh lama 401 | done |
| REL-06 | Release gate ubah password | P0 | QA-18 | Produksi terverifikasi & OpenAPI diperbarui | done |

## Fase 6f — Permission Ubah Password di RBAC

| ID | Task | Prioritas | Dependency | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| BE-22 | Permission `users.password.write` | P0 | BE-21 | Migrasi idempotent `005_user_password_permission.sql`; permission otomatis tampil di `GET /permissions`; endpoint password memakai permission ini, bukan hanya `roles.manage` | done |
| FE-18 | RBAC & UI ubah password | P0 | BE-22 | Checkbox `users.password.write` tersedia di Kelola Role; panel/tombol Ubah Password hanya tampil bila user memiliki permission | done |
| QA-19 | Regresi permission password | P0 | BE-22, FE-18 | 72 test lulus; user tanpa permission 403, setelah permission diberikan 200 | done |
| REL-07 | Release gate permission password | P0 | QA-19 | Produksi terverifikasi, OpenAPI & README DB diperbarui | done |

## Urutan Eksekusi

1. `PM-05` → `QA-11` (review ADR, gate schema) → `BE-13`.
2. `BE-13` → kontrak OpenAPI `BE-14`/`BE-15`/`BE-16` → paralel `FE-10`, `TRY-04`, `PRES-01`, `INF-02`.
3. `FE-11`, `FE-12`, `TRY-05`, `INF-03` setelah kontrak final.
4. `BE-17`, `FE-13`, `TRY-06` → `QA-12`, `QA-13` → `QA-14` → `REL-02`.

## Definition of Done Fase 6

- CMS dan tryout menolak akses tanpa login; sesi diperbarui otomatis dan logout mencabut akses.
- Admin dapat mengelola role dan menugaskan/cabut role pengguna lewat UI; perubahan segera berlaku di server.
- Matriks permission ADR-001 teruji untuk kelima role, termasuk penolakan eskalasi privilege.
- Alur tryout yang sudah rilis (`REL-01`) tidak regressi setelah login wajib.
- Tidak ada secret di repository; cookie aman dan OpenAPI mencerminkan implementasi.
- QA menandatangani laporan dan PM melakukan release gate `GO`.
