# Status Board — Fase 3–6 & Tryout

Diperbarui oleh PM setiap hari kerja. Status per 2026-11-24; Fase 3–5 & tryout final 2026-11-21, Fase 6i final 2026-11-22, Fase 6j, 6k, dan 6l final 2026-11-23. Fase 6m (sinkronisasi mapel soal–tryout) final 2026-11-24 dengan `REL-15` **GO** setelah regresi penuh 169/169. Fase 6n (Manajemen Bimbel) final 2026-11-24 dengan `REL-16` **GO**. Fase 6o (alur Buat Tryout & Peserta Umum) final 2026-11-24 dengan `REL-17` **GO**; regresi 142/142, migrasi 020/021/022 terpasang, dan aset produksi terverifikasi. Fase 6p (peserta tryout, detail, hapus relasi, & Prospektus) final 2026-11-24 dengan `REL-18` **GO**; regresi 150/150, migrasi `023` terpasang, bundle `index-CIWSCIZ4.js`, dan aset tryout terverifikasi. Fase 6q (Kelola Peserta dari Daftar Tryout) final 2026-11-24 dengan `REL-19` **GO**, regresi 155/155, bundle `index-D0au7v9d.js`. Fase 6r (Perubahan flow tryout: siswa/prospektus & kredensial) final 2026-11-24 dengan `REL-20` **GO**; regresi 162/162, migrasi `024` terpasang, bundle `index-B10Efnkg.js`. Fase 6s (tryout-scoped login & pemisahan peserta) final 2026-11-24 dengan `REL-21` **GO**; regresi 169/169, migrasi `025` terpasang, bundle `index-CwovVZBt.js`. **Fase 6 ditutup 2026-11-24** dengan seluruh gate `REL-01…REL-21` GO, regresi final 169/169, dan commit `45b8daa`. Sumber backlog: `pm-agent/tasks/phase6-backlog.md`, `pm-agent/tasks/phase6j-backlog.md`, `pm-agent/tasks/phase6n-backlog.md`, `pm-agent/tasks/phase6o-backlog.md`, `pm-agent/tasks/phase6p-backlog.md`, `pm-agent/tasks/phase6r-backlog.md`, `pm-agent/tasks/phase6s-backlog.md`, dan bagian Fase 6k/6l/6m di bawah.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| PM-01 | PM | P0 | done | - | Requirement diturunkan ke task MVP |
| PM-02 | PM | P0 | done | PM-01 | Scope MVP dikunci |
| PM-03 | PM | P1 | done | PM-02 | Serah terima PM→Backend→Frontend→QA tercatat |
| PM-04 | PM | P0 | done | QA-06 | Release gate GO ditandatangani QA |
| BE-01 | Backend | P0 | done | - | `schema.sql` diapply, 9 tabel + view |
| BE-02 | Backend | P0 | done | - | Express + pg pool + dotenv + multer 2.5.0 |
| BE-03 | Backend | P0 | done | BE-01, BE-02 | `/health` 200, DB `up` |
| BE-04 | Backend | P0 | done | BE-03 | 3 mapel wajib |
| BE-05 | Backend | P1 | done | BE-03 | CRUD list/filter/create/detail/update/archive |
| BE-06 | Backend | P0 | done | BE-03 | Upsert kunci + `COALESCE` perbaikan bug QA |
| BE-07 | Backend | P1 | done | BE-03 | Import JSON/CSV/TXT + payload sumber |
| BE-08 | Backend | P1 | done | BE-03..BE-07 | `backend-agent/openapi/openapi.yaml` |
| BE-09 | Backend | P0 | done | BE-03..BE-07 | 19 skenario otomatis, 19 pass |
| FE-01 | Frontend | P0 | done | - | Vite + React 18, 63 paket |
| FE-02 | Frontend | P0 | done | FE-01 | Dashboard + filter mapel/status/search |
| FE-03 | Frontend | P0 | done | BE-03, BE-06 | API client + daftar soal |
| FE-04 | Frontend | P0 | done | BE-04 | Form soal + opsi + kunci |
| FE-05 | Frontend | P0 | done | BE-03 | Upload/import file & payload |
| FE-06 | Frontend | P1 | done | BE-07 | Indikator readiness v1/v2/v3 |
| FE-07 | Frontend | P0 | done | FE-03..FE-05 | Build produksi 151.57 kB |
| FE-08 | Frontend | P2 | backlog | FE-06 | Di luar scope MVP (aksesibilitas lanjutan) |
| QA-01 | QA | P0 | done | PM-01 | `qa-agent/scenarios-mvp.md` (19 skenario) |
| QA-02 | QA | P0 | done | BE-09 | Syntax backend & build frontend lolos |
| QA-03 | QA | P0 | done | FE-05 | API + koneksi DB + seed terverifikasi |
| QA-04 | QA | P0 | done | BE-01 | Uji endpoint positif & negatif |
| QA-05 | QA | P1 | done | QA-02, QA-03 | Uji alur form/import + aset UI |
| QA-06 | QA | P0 | done | QA-02..QA-05 | Release gate: GO, 0 bug tersisa |

## Fase 4 — Deploy & Hardening

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| DEP-01 | Backend | P0 | done | BE-09 | `bank-soal-api.service` active, `MemoryMax=192M` |
| DEP-02 | Infra | P0 | done | DEP-01 | `api.hanyadi.web.id` → `:8082` via Cloudflare/Nginx |
| DEP-03 | Infra | P0 | done | FE-07 | `cms.hanyadi.web.id` → frontend statis + proxy `/api/` |
| QA-07 | QA | P0 | done | QA-01 | 34 test awal (19 smoke + 15 edge) |
| QA-08 | QA | P0 | done | QA-07 | BUG-04/05/06 selesai; laporan `phase4-report.md` |

## Fase 5 — Multi-versi & Penyajian

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| BE-10 | Backend | P0 | done | BE-01 | `002_presentation_variants.sql` + filter `ready_version` |
| BE-11 | Backend | P0 | done | BE-10 | `bank-soal-presentation.service` `:8083`, `MemoryMax=128M` |
| BE-12 | Backend | P0 | done | BE-11 | Auth `X-Presentation-Key` + `403 VERSION_NOT_READY` |
| FE-09 | Frontend | P1 | done | BE-10 | Virtualisasi daftar + filter "Siap versi" |
| INF-01 | Infra | P1 | done | DEP-02 | gzip + cache immutable aset Vite |
| QA-09 | QA | P0 | done | QA-07, FE-09 | 46 test Fase 5 lolos; `phase5-report.md` |

## Tryout Peserta — 2026-11-21

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| TRY-01 | Frontend | P1 | done | BE-11 | Halaman statis peserta, pilih v1/v2/v3, jawab & lihat pembahasan |
| TRY-02 | Infra | P1 | done | TRY-01 | `tryout.hanyadi.web.id` aktif, proxy presentation/API same-origin |
| TRY-03 | Backend | P0 | done | BE-10 | `003_backfill_missing_variants.sql` + auto-variant saat readiness |
| QA-10 | QA | P0 | done | TRY-03 | 52 test lolos, 21 soal ready v1 → 0 gagal; `tryout-report.md` |
| REL-01 | PM | P0 | done | QA-10 | Release gate tryout: **GO** |

## Fase 6 — Manajemen Role & Login CMS/Tryout — 2026-11-22

Requirement: manajemen role di CMS; CMS dan tryout wajib login. Desain: `pm-agent/decisions/ADR-001-auth-role.md` (review QA via QA-11 sebelum migrasi).

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| PM-05 | PM | P0 | done | - | Requirement dikunci; ADR-001 ditulis |
| PM-06 | PM | P0 | done | PM-05 | Breakdown + AC per agent di `tasks/phase6-backlog.md` |
| PM-07 | PM | P0 | done | PM-06 | Handoff ke Backend, Frontend, Tryout, QA diterbitkan |
| PM-08 | PM | P0 | done | QA-14 | Release gate Fase 6 bersama QA |
| BE-13 | Backend | P0 | done | PM-05, QA-11 | `004_auth_roles.sql`, 5 role seed, admin dari env |
| BE-14 | Backend | P0 | done | BE-13 | Login/refresh/logout/me, cookie HttpOnly domain `.hanyadi.web.id` |
| BE-15 | Backend | P0 | done | BE-13, BE-14 | CRUD role + penugasan role user, guard admin terakhir |
| BE-16 | Backend | P0 | done | BE-14, BE-15 | Middleware auth/RBAC + OpenAPI diperbarui |
| BE-17 | Backend | P0 | done | BE-13..BE-16 | Test auth & RBAC, negatif path |
| FE-10 | Frontend | P0 | done | BE-14 | Login, session guard, refresh, logout |
| FE-11 | Frontend | P0 | done | BE-15 | UI manajemen role & penugasan (admin only) |
| FE-12 | Frontend | P0 | done | BE-16, FE-10 | RBAC navigasi & tombol aksi |
| FE-13 | Frontend | P1 | done | FE-10..FE-12 | Build produksi + regresi UI CMS |
| PRES-01 | Presentation | P0 | done | BE-14 | JWT cookie untuk baca tryout; write tetap `X-Presentation-Key` |
| TRY-04 | Tryout | P0 | done | BE-14 | Login tryout + gate sebelum render soal/pembahasan |
| TRY-05 | Tryout | P0 | done | TRY-04, BE-16, PRES-01 | `credentials: 'include'`, tangani 401/403 |
| TRY-06 | Tryout | P1 | done | TRY-04, TRY-05 | Regresi 52 skenario tryout dengan sesi |
| INF-02 | Infra | P0 | done | BE-14, FE-10, TRY-04 | Proxy `/api/`, CORS credentials, cookie domain, header aman |
| INF-03 | Infra | P1 | done | TRY-04 | Aset statis tryout tidak bocor tanpa login |
| QA-11 | QA | P0 | done | PM-05 | Review ADR-001 + test plan auth/RBAC (gate BE-13) |
| QA-12 | QA | P0 | done | BE-17 | Uji login/logout/refresh, cookie flags, rate limit |
| QA-13 | QA | P0 | done | BE-17, FE-11, FE-12 | Uji matriks 5 role & eskalasi privilege |
| QA-14 | QA | P0 | done | QA-12, QA-13, FE-13, TRY-06, INF-02, INF-03 | Regresi CMS/tryout + laporan release gate |
| REL-02 | PM | P0 | done | QA-14 | Release gate Fase 6: **GO**, deployed 2026-11-22 |

## Fase 6b — Pemisahan Halaman Input Soal & Buat User — 2026-11-22

Permintaan pemilik proyek: halaman input soal dan halaman create user berada di menu terpisah, tidak digabung dalam satu halaman.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| BE-18 | Backend | P0 | done | BE-15 | `POST /api/v1/users` + validasi password/role/duplikat; OpenAPI diperbarui |
| FE-14 | Frontend | P0 | done | BE-18 | Hash route `#/`, `#/questions/new`, `#/users/new`, `#/roles`; nav terpisah |
| FE-15 | Frontend | P0 | done | FE-14 | `QuestionInput.jsx`, `UserManagement.jsx`, `RoleManagement.jsx`, `Dashboard.jsx` |
| QA-15 | QA | P0 | done | BE-18, FE-15 | 67 test lulus; P5-14 memeriksa marker halaman terpisah |
| REL-03 | PM | P0 | done | QA-15 | Release gate Fase 6b: **GO**, deployed 2026-11-22 |

## Fase 6c — Perbaikan Akses Peserta Tryout — 2026-11-22

Gejala: halaman peserta menampilkan "Sesi berakhir. Silakan masuk kembali." Akar masalah: role `peserta` tidak punya `questions.read`, sehingga daftar soal memakai endpoint CMS `/api/v1/questions` yang mengembalikan 403 dan ditafsirkan UI sebagai sesi habis.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| BE-19 | Backend | P0 | done | BE-14 | Endpoint `GET /api/v1/tryout/questions` dengan `tryout.access`, hanya soal ready + tanpa kunci jawaban |
| TRY-07 | Tryout | P0 | done | BE-19 | UI memakai endpoint tryout; 403 kini dibedakan sebagai "tidak memiliki akses"; aset `?v=4` |
| QA-16 | QA | P0 | done | BE-19, TRY-07 | 68 test lulus; peserta 200 di endpoint tryout, 403 di endpoint CMS |
| REL-04 | PM | P0 | done | QA-16 | Release gate perbaikan peserta: **GO**, deployed 2026-11-22 |

## Fase 6d — Checkbox Permission RBAC — 2026-11-22

Permintaan pemilik proyek: di menu Kelola Role, admin dapat memilih permission mana saja yang diberikan ke role tertentu memakai checkbox.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| BE-20 | Backend | P0 | done | BE-15 | `GET /permissions` + `PUT /roles/{id}/permissions`, proteksi `roles.manage` admin |
| FE-16 | Frontend | P0 | done | BE-20 | Panel checkbox per role, Pilih semua/Kosongkan, Simpan Hak Akses |
| QA-17 | QA | P0 | done | BE-20, FE-16 | 70 test lulus; validasi permission invalid, non-admin 403, admin lockout 409 |
| REL-05 | PM | P0 | done | QA-17 | Release gate checkbox RBAC: **GO**, deployed 2026-11-22 |

## Fase 6e — Ubah Password di Halaman Buat User — 2026-11-22

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| BE-21 | Backend | P0 | done | BE-20 | `PUT /users/{id}/password`, hash scrypt, reset lock, cabut sesi lama |
| FE-17 | Frontend | P0 | done | BE-21 | Panel "Ubah Password Pengguna" + tombol cepat per user di halaman Buat User |
| QA-18 | QA | P0 | done | BE-21, FE-17 | 71 test lulus; password lama 401, baru 200, refresh lama 401 |
| REL-06 | PM | P0 | done | QA-18 | Release gate ubah password: **GO**, deployed 2026-11-22 |

## Fase 6f — Permission Ubah Password di RBAC — 2026-11-22

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| BE-22 | Backend | P0 | done | BE-21 | Permission `users.password.write`, migrasi `005_user_password_permission.sql`, endpoint ubah password memakai permission ini |
| FE-18 | Frontend | P0 | done | BE-22 | Checkbox permission tampil otomatis di Kelola Role; panel Ubah Password disembunyikan jika tanpa permission |
| QA-19 | QA | P0 | done | BE-22, FE-18 | 72 test lulus; 403 sebelum grant, 200 sesudah grant |
| REL-07 | PM | P0 | done | QA-19 | Release gate permission ubah password: **GO**, deployed 2026-11-22 |

## Fase 6g — Manajemen Tryout — 2026-11-22

Permintaan pemilik proyek: menu baru untuk membuat Tryout dengan nama, tanggal, mapel, soal dari mapel tersebut, dan peserta ber-role `peserta`. Desain: `pm-agent/decisions/ADR-002-manajemen-tryout.md`.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| BE-23 | Backend | P0 | done | ADR-002 | `009_tryout_management.sql`, `/api/v1/tryouts`, permission `tryouts.manage` |
| FE-19 | Frontend | P0 | done | BE-23 | Menu `#/tryouts`, form create + daftar TO |
| TRY-08 | Tryout | P0 | done | BE-23 | Filter soal aktif & pengaman submit sesuai daftar TO |
| QA-20 | QA | P0 | done | BE-23, FE-19, TRY-08 | Regresi + skenario Manajemen Tryout |
| REL-08 | PM | P0 | done | QA-20 | Release gate Fase 6g: **GO**, deployed 2026-11-22 |

## Fase 6h — Migrasi Template CMS ke Shadcn — 2026-11-22

Permintaan: cek memori, cek sesi opencode lain, tutup sesi lain, migrasi template CMS menggunakan Shadcn dengan hati-hati agar tidak OOM, buat to-do & laporan akhir, update report sistem.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| FE-SHADCN-01 | Frontend | P0 | done | - | Inventarisasi frontend React+Vite; strategi hemat memori (tanpa CLI berat) |
| FE-SHADCN-02 | Frontend | P0 | done | FE-SHADCN-01 | Tailwind 3 + PostCSS + token CSS variable + alias `@` + `components.json` |
| FE-SHADCN-03 | Frontend | P0 | done | FE-SHADCN-02 | Komponen UI Shadcn-style: button/input/textarea/label/card/badge/alert/select/table/checkbox |
| FE-SHADCN-04 | Frontend | P0 | done | FE-SHADCN-03 | Migrasi App, Login, Dashboard, QuestionInput, Role/User/Tryout/System pages |
| FE-SHADCN-05 | Frontend | P0 | done | FE-SHADCN-04 | Build sukses `NODE_OPTIONS=--max-old-space-size=384 npm run build`; tidak ada OOM |
| DOC-SHADCN-01 | PM/Docs | P1 | done | FE-SHADCN-05 | `frontend-agent/MIGRATION-SHADCN-REPORT.md` + update status board |
| FE-SHADCN-06 | Frontend | P0 | done | FE-SHADCN-05 | Redesign total UI: layout sidebar/dashboard responsif, semua halaman restyle Shadcn, build+deploy prod, laporan sistem dipulihkan |

## Fase 6i — Peserta Tryout Terpisah dari User CMS — 2026-11-22

Permintaan pemilik proyek: tabel peserta tryout tersendiri (nama, email, password; admin bisa reset), halaman CRUD di Manajemen Tryout, role `peserta` dihapus dari Buat User, laporan sistem diperbarui.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| BE-24 | Backend | P0 | done | - | `010_tryout_participants.sql`, `/api/v1/participants`, auth participant, penolakan role `peserta` |
| FE-20 | Frontend | P0 | done | BE-24 | Menu `#/tryouts/peserta`, picker peserta di TryoutManagement, filter role di UserManagement |
| TRY-09 | Tryout | P0 | done | BE-24 | Login email, assignment/submission/summary memakai `participant_id` |
| DOC-06I | PM/Docs | P1 | done | BE-24 | OpenAPI, `db/README.md`, laporan sistem sumber + deploy, QA/PM report |
| QA-21 | QA | P0 | done | BE-24, FE-20, TRY-09 | 8 skenario baru; total 99/99 test lolos |
| REL-09 | PM | P0 | done | QA-21 | Release gate Fase 6i: **GO**, deployed 2026-11-22 |

## Fase 6j — Penyederhanaan Soal & Pagination — 2026-11-23

Permintaan pemilik proyek: hapus versi v1/v2/v3 dari soal, soal baru otomatis publish/approve, buang status draft/review, pertanyaan tidak bold, pagination daftar soal default 20, handoff BE/FE/QA dengan deploy setelah GO, dan hemat memori. Desain: `pm-agent/decisions/ADR-004-penyederhanaan-soal.md`.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| PM-09 | PM | P0 | done | - | Requirement dikunci; opsi ADR dikonfirmasi pemilik |
| PM-10 | PM | P0 | done | PM-09 | Breakdown + handoff BE/PRES, FE/TRY, QA/PM |
| BE-25 | Backend | P0 | done | ADR-004 | Migrasi `015` diterapkan; status `approved`; versi/readiness keluar dari API; pagination 20 |
| PRES-02 | Presentation | P0 | done | ADR-004 | Sajikan soal dari tabel inti; gate `status='approved'`; internal `version='v1'` |
| FE-21 | Frontend | P0 | done | BE-25 | UI versi dihapus; filter approved/archived; stem non-bold; pagination Prev/Next |
| TRY-10 | Tryout | P0 | done | PRES-02 | Picker versi dihapus; stem non-bold; aset `?v=10` |
| DOC-06J | PM/Docs | P1 | done | BE-25, FE-21, TRY-10 | OpenAPI, DB/agent docs, checklist, laporan sistem diselaraskan |
| QA-22 | QA | P0 | done | BE-25, PRES-02, FE-21, TRY-10 | ADR disetujui; 118/118 test lolos; T-01/T-02 ditutup; 0 bug P0/P1 |
| REL-10 | PM | P0 | done | QA-22 | Release gate **GO**, deployed 2026-11-23; health/smoke OK, tanpa OOM |

## Fase 6k — Perapian Subdomain & Edit Soal — 2026-11-23

Permintaan pemilik: periksa `api`/`crm`/`office`, samakan subdomain tak terpakai dengan root, hilangkan dashboard CMS dari `api`, buka detail soal saat baris diklik, dan tambahkan kemampuan edit soal; terakhir sinkronkan status board dan laporan sistem.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| INF-04 | Infra | P1 | done | - | `crm`/`office` masuk vhost root di `/etc/nginx/sites-available/hanyadi.web.id:5` dan `:19`; HTTP/HTTPS identik dengan root; backup nginx tersedia |
| INF-05 | Infra | P1 | done | - | Static `frontend-agent/dist` dihapus dari API; `api.hanyadi.web.id/` kini 404 JSON; `/health`, `/presentation-health`, `/api/v1/*` aman |
| FE-22 | Frontend | P1 | done | - | Modal detail dari klik baris; fetch `GET /questions/:id`; tutup via tombol/backdrop/Esc |
| BE-26 | Backend | P1 | done | FE-22 | `PUT /questions/:id` transaksional untuk stem/mapel/tipe/kesulitan/opsi/kunci/pembahasan/gambar; OpenAPI diperbarui |
| FE-23 | Frontend | P1 | done | BE-26 | Form edit di modal dengan pratinjau/ganti gambar, radio/checkbox kunci, jawaban teks; list diperbarui setelah simpan |
| QA-23 | QA | P1 | done | FE-23 | Regresi 118/118 + smoke edit terpisah memakai sesi/soal sementara yang dibersihkan; 0 P0/P1 |
| DOC-06K | PM/Docs | P1 | done | FE-23 | OpenAPI, status board, dan laporan sistem diselaraskan dengan kondisi aktual |
| REL-11 | PM | P1 | done | QA-23 | **GO**, deployed 2026-11-23; nginx/api active, health OK, memori tersedia ~528 MiB, tanpa OOM |

## Fase 6l — Lembar Soal — 2026-11-23

Permintaan pemilik: halaman "Lembar Soal" di bawah Manajemen Soal dengan field nama, kode 12 karakter termasuk tanda hubung (auto-generate, bisa diubah; saran `LS-IPAS-mmyy`), keterangan, dan waktu pengerjaan berupa angka bebas (integer menit, bukan preset 60/90/120); create/edit soal dari satu mapel; satu soal bisa dipakai banyak lembar dan diberi flag kode lembar soal. Keputusan: kode unik dan dikunci setelah dipakai tryout (D2), waktu pengerjaan angka bebas bukan preset (D3), permission baru `question_sheets.manage` (D4), hapus = soft delete `archived` (D5). ADR-005 `accepted` di `pm-agent/decisions/ADR-005-lembar-soal.md`; handoff BE-27/FE-24/QA-24 diterbitkan dengan batasan cek `free -h` sebelum/sesudah dan test/build bergiliran agar tidak OOM. Amendemen urutan create 2026-11-23: urutan create menjadi nama → pilih mapel dari `mapels` → sistem generate kode → kode bisa diubah manual → soal tersembunyi sampai mapel dipilih → picker terfilter mapel dengan popup detail pada klik baris. Requirement lengkap ada di `pm-agent/tasks/phase6l-backlog.md`. Amendemen lanjutan 2026-11-23 (PM-13/D6): field **Kode** di Kelola Mapel dibatasi tepat 4 karakter alfanumerik kapital dan kode itulah yang dipakai langsung sebagai prefix `LS-<KODE>-mmyy`; pemetaan nama/fallback `CUST` tidak dipakai lagi. Ini adalah revisi baru setelah `REL-12`; BE-28/FE-25/QA-25 selesai dan `REL-13` **GO** 2026-11-23 dengan bundle `index-S-JiNOIO.js` serta regresi 126/126. Permintaan lanjutan PM-14/D7: filter tipe soal di Daftar Soal dan picker Lembar Soal selesai lewat BE-29/FE-26/QA-26; gate `REL-14` **GO** 2026-11-23 dengan regresi 129/129 dan bundle `index-BxuKDQvd.js`.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| PM-11 | PM | P1 | done | - | 8 poin requirement dicatat di `tasks/phase6l-backlog.md` |
| PM-12 | PM | P1 | done | PM-11 | Q1–Q5 terjawab; ADR-005 accepted |
| BE-27 | Backend | P1 | done | ADR-005 | Migrasi `016` terpasang; API lembar soal + `sheets` aktif; 8 skenario L lolos |
| FE-24 | Frontend | P1 | done | BE-27 | Menu `#/question-sheets`, urutan create sesuai amendemen, form/picker/daftar/arsip, flag Dashboard; build 256 MB sukses, bundle `index-WRy9fshq.js` (kemudian disusul `index-S-JiNOIO.js` oleh FE-25) |
| QA-24 | QA | P1 | done | BE-27, FE-24 | 126/126 test lolos, 0 fail; 0 bug P0/P1; QA6L-ENV-01/02/03 closed |
| DOC-06L | PM/Docs | P1 | done | BE-27, FE-24, QA-24 | ADR/backlog/handoff, OpenAPI, DB/agent docs, test case, laporan QA, status board diselaraskan dengan amendemen |
| REL-12 | PM | P1 | done | QA-24 | **GO**, 2026-11-23 untuk implementasi sebelum amendemen D6; fixture QA bersih, admin login terverifikasi, tanpa OOM |
| PM-13 | PM | P1 | done | PM-12 | Amendemen D6 dicatat; pemilik mengonfirmasi migrasi `MTKA/BIND/IPAS` |
| BE-28 | Backend | P1 | done | PM-13 | Migrasi `017`, `requireMapelCode()` 4 kapital, generator langsung `LS-<KODE>-mmyy`, OpenAPI/DB doc |
| FE-25 | Frontend | P1 | done | BE-28 | Form Kelola Mapel 4 kapital, label/default `MTKA/BIND/IPAS`; build `index-S-JiNOIO.js` terdeploy |
| QA-25 | QA | P1 | done | BE-28, FE-25 | Fixture 4 kapital, generator per kode mapel, regresi 126/126, 0 bug P0/P1 |
| REL-13 | PM | P1 | done | QA-25 | **GO**, 2026-11-23 untuk amendemen D6; gate terpisah dari `REL-12` |
| PM-14 | PM | P1 | done | PM-13 | D7 dicatat: filter tipe soal di Daftar Soal dan picker Lembar Soal |
| BE-29 | Backend | P1 | done | PM-14 | `question_type` filter di `GET /questions` dan `GET /question-sheets/question-picker`; validasi `QUESTION_TYPES` |
| FE-26 | Frontend | P1 | done | BE-29 | Dropdown filter tipe soal di Daftar Soal dan picker Lembar Soal; bundle `index-BxuKDQvd.js` |
| QA-26 | QA | P1 | done | BE-29, FE-26 | 3 skenario D7 (S-09a/S-09b/L-06a); regresi 129/129, 0 bug P0/P1 |
| REL-14 | PM | P1 | done | QA-26 | **GO** 2026-11-23 untuk D7; tidak otomatis mengubah `REL-13` |

## Fase 6m — Sinkronisasi Mapel Soal & Tryout — 2026-11-23

Gejala: setelah mapel soal diubah dan disimpan, soal tidak muncul di `tryout.hanyadi.web.id` meski statusnya `approved` dan mapelnya sama dengan sesi aktif. Akar masalah: daftar tryout hanya memuat soal yang tercatat di `tryout_session_questions` untuk sesi aktif, sementara perubahan `mapel_id` tidak menyentuh keanggotaan sesi; filter Daftar Soal CMS juga tetap memakai mapel lama sehingga soal seolah hilang.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| PM-15 | PM | P1 | done | - | Temuan QA dicatat; ruang lingkup: backend, CMS, tryout, data terdampak, dokumentasi |
| BE-30 | Backend | P1 | done | PM-15 | `PUT /questions/:id` merekonsiliasi keanggotaan sesi tryout aktif saat mapel berubah (hapus dari sesi mapel lama, tambah ke sesi mapel baru) dalam satu transaksi; select `mapel_id` ditambahkan pada query soal |
| FE-27 | Frontend | P1 | done | BE-30 | Filter mapel Daftar Soal disesuaikan otomatis setelah simpan; daftar soal Manajemen Tryout dimuat ulang saat halaman mendapat fokus; build `index-CFDLsDdb.js` terdeploy |
| TRY-11 | Tryout | P1 | done | BE-30 | Daftar soal peserta dimuat ulang saat jendela mendapat fokus; aset `app.js?v=11` |
| DATA-06M | Backend/PM | P1 | done | BE-30 | Rekonsiliasi data existing: soal id 950 ditambahkan ke sesi aktif 29 (`position=2`); query daftar tryout peserta kini mengembalikan id 950 dan 144 |
| QA-27 | QA | P1 | done | BE-30, FE-27, TRY-11, DATA-06M | Verifikasi statis (`node --check`), build frontend sukses, simulasi SQL transaksional dengan rollback, health API 200. Regresi penuh final 169/169 dijalankan dengan `QA_ADMIN_PASSWORD` dari secret store; fixture dibersihkan |
| DOC-06M | PM/Docs | P1 | done | QA-27 | Status board dan laporan sistem diperbarui dengan gejala, akar masalah, perbaikan, serta batasan verifikasi |
| REL-15 | PM | P1 | done | QA-27 | Deploy aktif 2026-11-23 (backend direstart, frontend/tryout ter-update); gate **GO** 2026-11-24 setelah regresi penuh 169/169 |

## Fase 6n — Manajemen Bimbel — 2026-11-24

Permintaan pemilik: pindahkan **Kelola Siswa** dari grup Manajemen Tryout dan **Kelola Program Belajar** dari grup Setting ke menu tersendiri bernama **Manajemen Bimbel**. Perubahan hanya navigasi CMS; tidak ada schema, endpoint, atau permission baru. Keputusan tercatat di `pm-agent/decisions/ADR-006-manajemen-bimbel.md`; requirement lengkap di `pm-agent/tasks/phase6n-backlog.md`.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| PM-16 | PM | P1 | done | - | ADR-006 accepted; backlog + handoff BE-31/FE-28/QA-28 diterbitkan |
| BE-31 | Backend | P1 | done | PM-16 | Kontrak & permission terverifikasi (`401` tanpa cookie, guard source), tidak ada perubahan kode backend |
| FE-28 | Frontend | P1 | done | PM-16 | Grup `Manajemen Bimbel`, hash `#/bimbel/siswa` & `#/bimbel/program-belajar`, alias rute lama; bundle `index-CXNjTfX_.js` terdeploy |
| QA-28 | QA | P1 | done | BE-31, FE-28 | Marker P5-14/A-12/S-17 diselaraskan; N-01..N-03; regresi 132/132, 0 bug P0/P1 |
| REL-16 | PM | P1 | done | QA-28 | **GO** 2026-11-24; deploy frontend ke produksi, backend tidak direstart |

## Fase 6o — Alur Buat Tryout & Peserta Umum — 2026-11-24

Permintaan pemilik: ubah halaman Buat Tryout menjadi Nama Tryout (Camel/Title Case) → tanggal & jam mulai → tanggal & jam selesai → mapel → lembar soal sesuai mapel; tombol tambah peserta tidak wajib dengan pilihan `A. Peserta Didik` (ditunda) atau `B. Peserta Umum` (popup Nama, Sekolah, PIN 9 digit acak, WA orang tua). Nama + PIN dipakai login di halaman tryout. Keputusan lengkap di `pm-agent/decisions/ADR-007-peserta-umum-tryout.md`; requirement dan AC di `pm-agent/tasks/phase6o-backlog.md`. QA-29A wajib me-review desain dan rencana migrasi sebelum DDL diapply.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| PM-17 | PM | P0 | done | - | ADR-007 accepted; backlog + handoff BE-32/FE-29/TRY-12/QA-29 diterbitkan |
| QA-29A | QA | P0 | done | PM-17 | Review ADR-007 & rencana migrasi 020/021; catatan perbaikan ditindaklanjuti di 022 dan endpoint legacy |
| BE-32 | Backend | P0 | done | QA-29A | Migrasi `020`/`021`/`022`, participant umum, jadwal & lembar soal, auth, OpenAPI; backend direstart |
| FE-29 | Frontend | P0 | done | BE-32 (kontrak) | Urutan form baru, picker lembar soal, peserta opsional, popup Umum & generator PIN; bundle `index-BWwbQxdi.js` |
| TRY-12 | Tryout | P0 | done | BE-32 (kontrak) | Login `Nama atau Email` / `Password atau PIN`, aset `?v=11`/`?v=12` terverifikasi |
| QA-29 | QA | P0 | done | QA-29A, BE-32, FE-29, TRY-12 | U-01..U-10 lolos; regresi 142/142, 0 bug P0/P1 |
| REL-17 | PM | P0 | done | QA-29 | **GO** 2026-11-24; terpisah dari `REL-15` yang kini ikut final **GO** |

## Fase 6p — Peserta Tryout, Detail, Hapus Relasi & Prospektus — 2026-11-24

Permintaan pemilik: siswa tidak tampil default di Buat Tryout; tombol tambah peserta membuka `A. Peserta Didik` / `B. Peserta Umum`; baris peserta terlampir diklik untuk detail; hapus pakai icon keranjang sampah, bukan checkbox; Umum yang dikeluarkan masuk halaman Prospektus; Siswa hanya terlepas dari tryout; label `Kelola Siswa Tryout` → `Kelola Siswa`; deploy/commit/push. Keputusan lengkap di `pm-agent/decisions/ADR-008-peserta-tryout-dan-prospektus.md`; requirement dan AC di `pm-agent/tasks/phase6p-backlog.md`.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| PM-18 | PM | P0 | done | - | ADR-008 accepted; backlog + handoff BE-33/FE-30/TRY-13/QA-30 diterbitkan |
| BE-33 | Backend | P0 | done | PM-18 | Migrasi `023`, endpoint hapus relasi, `POST /participants/{id}/prospek` untuk draft, `GET /prospektus`, filter `?prospek=`, OpenAPI |
| FE-30 | Frontend | P0 | done | BE-33 (kontrak) | Picker siswa, detail baris, trash icon, halaman/menu Prospektus, label `Kelola Siswa`; bundle `index-CIWSCIZ4.js` |
| TRY-13 | Tryout | P1 | done | BE-33 (kontrak) | Tanpa perubahan kode; login Umum & Siswa lolos |
| QA-30 | QA | P0 | done | BE-33, FE-30, TRY-13 | PR-01..PR-08 lolos; regresi 150/150; `phase6p-report.md` |
| REL-18 | PM | P0 | done | QA-30 | **GO** 2026-11-24; health/aset produksi terverifikasi |

## Fase 6q — Kelola Peserta dari Daftar Tryout — 2026-11-24

Permintaan pemilik: hapus helper text `Data siswa tidak ditampilkan sampai dipilih melalui A. Peserta Didik.` dari Buat Tryout; popup `Kelola Peserta` pada Daftar Tryout juga menampilkan daftar peserta dan dua tombol `A. Peserta Didik` / `B. Peserta Umum` dengan alur yang sama seperti form Buat Tryout; perbarui laporan sistem sebelum commit/push. Keputusan lengkap di `pm-agent/decisions/ADR-009-kelola-peserta-tryout.md`; requirement dan AC di `pm-agent/tasks/phase6q-backlog.md`.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| PM-19 | PM | P0 | done | - | ADR-009 accepted; backlog + handoff BE-34/FE-31/QA-31 diterbitkan |
| BE-34 | Backend | P0 | done | ADR-009 | `POST /tryouts/{id}/participants` idempoten; OpenAPI/backend README; health 8082 `200` |
| FE-31 | Frontend | P0 | done | BE-34 (kontrak) | Helper text hilang; popup Kelola Peserta A/B; target `draft`/`manage`; bundle `index-D0au7v9d.js` |
| QA-31 | QA | P0 | done | BE-34, FE-31 | QP-01..QP-05 lolos; regresi 155/155; laporan & gate `REL-19 GO` |
| DOC-06Q | PM/Docs | P1 | done | FE-31, QA-31 | `laporan-sistem/index.html` diperbarui ke Fase 6q, 155/155, REL-19 |
| REL-19 | PM | P0 | done | QA-31, DOC-06Q | **GO** 2026-11-24; deploy & verifikasi produksi selesai; commit `a143409` |

## Fase 6r — Perubahan Flow Tryout: Siswa/Prospektus & Kredensial — 2026-11-24

Permintaan pemilik: (1) pilihan `B. Peserta Umum` di halaman Buat Tryout menyimpan ke tabel `prospektus` dengan struktur sama seperti `siswa`; (2) popup/detail siswa atau peserta menampilkan password/PIN; (3) baris Prospektus diklik menampilkan detail dan tombol `Daftarkan sebagai Siswa`, lalu data disimpan ke `siswa` dan prospektus ditandai `bergabung`. Pemilik mengonfirmasi refactor penuh, kredensial peserta plaintext, dan Umum tetap bisa login. Keputusan lengkap di `pm-agent/decisions/ADR-010-siswa-prospektus-kredensial.md`; requirement dan AC di `pm-agent/tasks/phase6r-backlog.md`.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| PM-20 | PM | P0 | done | - | ADR-010 accepted; backlog + handoff BE-35/FE-32/TRY-14/QA-32 diterbitkan |
| BE-35 | Backend | P0 | done | PM-20 | Migrasi `024`, rename `siswa`, tabel `prospektus`, view kompatibilitas, trigger FK, endpoint detail & daftar; OpenAPI/DB doc; health 200 |
| FE-32 | Frontend | P0 | done | BE-35 (kontrak) | Detail peserta di Buat Tryout & Kelola Siswa, halaman Prospektus interaktif, tombol `Daftarkan sebagai Siswa`; bundle `index-B10Efnkg.js` |
| TRY-14 | Tryout | P1 | done | BE-35 (kontrak) | Tanpa perubahan kode; login Umum & Siswa tetap lolos lewat view/kredensial baru |
| QA-32 | QA | P0 | done | BE-35, FE-32, TRY-14 | PS-01..PS-07 lolos; regresi 162/162; bug 500 detail diperbaiki; laporan & gate `REL-20 GO` |
| DOC-06R | PM/Docs | P1 | done | FE-32, QA-32 | Status board, laporan sistem, backend README, DB README, QA/PM docs diselaraskan |
| REL-20 | PM | P0 | done | QA-32, DOC-06R | **GO** 2026-11-24; backend direstart, bundle CMS terdeploy, commit & push ke `origin/main` |

## Fase 6s — Tryout-Scoped Login & Pemisahan Peserta — 2026-11-24

Permintaan pemilik: (1) peserta/siswa yang tidak terdaftar di sebuah tryout tidak boleh login ke halaman tryout; tryout perlu penanda unik berupa path `/{slug}` dan URL bisa dicopy dari Manajemen Tryout; (2) Kelola Siswa tidak boleh menampilkan peserta tryout dan harus dipisahkan dari pendaftaran manual; (3) pendaftaran dari tryout hanya disimpan di `prospektus`, tombol eksplisit di halaman Prospektus yang boleh menyalin ke `siswa`; data konversi REL-20 di-rollback. Analisis dan keputusan ada di `pm-agent/decisions/ADR-011-tryout-scoped-login-dan-pemisahan-siswa.md`; requirement, breakdown, dan keputusan D1–D6 ada di `pm-agent/tasks/phase6s-backlog.md`.

| Task ID | Owner | Prioritas | Status | Dependency | Catatan |
|---|---|---|---|---|---|
| PM-21 | PM | P0 | done | - | ADR-011 accepted; backlog & keputusan D1–D6 dicatat; handoff BE-36/FE-33/TRY-15/PRES-03/QA-33 diterbitkan |
| BE-36 | Backend | P0 | done | ADR-011 | Migrasi `025`, slug tryout, binding session/JWT, `GET /siswa`, `GET /tryouts/{id}/participants`; hapus tryout membersihkan sesi terikat |
| FE-33 | Frontend | P0 | done | BE-36 (kontrak) | Field `URL Tryout` + tombol Salin, Kelola Siswa murni `siswa`, picker peserta tryout terpisah, Prospektus eksplisit; bundle `index-CwovVZBt.js` |
| TRY-15 | Tryout | P0 | done | BE-36 (kontrak) | Baca path `/{slug}`, kirim `tryout_slug`, blok login tanpa marker; aset `styles.css?v=12`/`app.js?v=13` |
| PRES-03 | Presentation | P0 | done | BE-36 (kontrak) | Pakai `tryout_session_id` dari JWT, bukan sesi aktif global; submission/soal mengikuti binding |
| QA-33 | QA | P0 | done | BE-36, FE-33, TRY-15, PRES-03 | QS-01…QS-07 lolos; regresi 169/169, 0 P0/P1; `phase6s-report.md` |
| DOC-06S | PM/Docs | P1 | done | FE-33, QA-33 | OpenAPI, README backend/DB, ADR-011, backlog, status board, laporan sistem, gate `REL-21 GO` diselaraskan |
| REL-21 | PM | P0 | done | QA-33, DOC-06S | **GO** 2026-11-24; health/aset produksi terverifikasi; commit & push ke `origin/main` |

## Penutup Fase 6 — 2026-11-24

Fase 6 dinyatakan selesai. Seluruh sub-fase 6i–6s telah final dan seluruh gate `REL-01…REL-21` berstatus **GO**; `REL-15` difinalisasi memakai bukti regresi penuh 169/169 yang sama dengan `REL-21`. Catatan `REL-15 partial` di ADR dan laporan gate lama dipertahankan sebagai catatan historis pada saat gate tersebut diterbitkan.

| Aspek | Status akhir |
|---|---|
| Regresi | 169/169 lolos, 0 gagal, 0 P0/P1 |
| Gate | `REL-01…REL-21` **GO**, tidak ada gate partial |
| Deploy | Migrasi `025` terpasang; CMS `index-CwovVZBt.js`/`index-D_wAgUtB.css`; tryout `styles.css?v=12`/`app.js?v=13`; health API, presentation, CMS, tryout 200 |
| Dokumen | ADR-001…ADR-011, backlog Fase 6/6j/6n/6o/6p/6r/6s, QA report & release gate, status board, dan laporan sistem tersinkron |
| VCS | Implementasi Fase 6s di commit `45b8daa`; penutup Fase 6 dicatat di commit terpisah |
