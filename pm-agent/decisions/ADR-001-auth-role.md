# Decision Log — ADR-001

| Field | Isi |
|---|---|
| ID | ADR-001 |
| Tanggal | 2026-11-22 |
| Pemilik | PM |
| Status | accepted (review QA wajib sebelum migrasi, QA-11) |
| Terkait task | PM-05, BE-13, BE-16, FE-10, TRY-04, PRES-01, INF-02, QA-11 |

## Konteks

Fase 3–5 dan tryout sudah rilis (`REL-01`, status board per 2026-11-21). CMS (`cms.hanyadi.web.id`), API (`api.hanyadi.web.id`), dan tryout (`tryout.hanyadi.web.id`) saat ini dapat diakses tanpa identitas pengguna. Tabel `contributors` sudah ada dengan kolom `role` (`admin`/`editor`/`reviewer`/`qa`) tetapi tidak menyimpan kredensial, tidak ada mekanisme sesi, dan tidak ada manajemen role lewat UI.

Requirement baru (2026-11-22):

1. CMS mendapat fitur lanjutan **manajemen role**: role dibuat/diubah/nonaktifkan dan pengguna dapat diberi atau dicabut role.
2. **CMS dan tryout wajib login** sebelum konten atau data soal dapat diakses.

Perubahan schema wajib melalui PM dan QA (`docs/agent-workflow.md` §7), sehingga keputusan ini ditulis sebelum migrasi.

## Keputusan

1. **Satu entity pengguna**: perluas `contributors` (bukan membuat tabel `users` baru) dengan `email`, `password_hash`, `is_active`, `last_login_at`, `failed_login_count`, `locked_until`. Tambah tabel `roles`, `user_roles`, dan `auth_sessions`. Role default seed: `admin`, `editor`, `validator`, `viewer`, `peserta`. Mapping data lama: `reviewer` → `validator`, `qa` → `viewer`.
2. **Role bersifat many-to-many dan dinamis** (`user_roles`), bukan hard-coded di `contributors.role`. Kolom lama `contributors.role` dipertahankan sebagai kompatibilitas dan disinkronkan dari role utama. Konfigurasi hak akses ada di tabel `permissions` + `role_permissions` agar bisa diubah tanpa deploy.
3. **Autentikasi**: password di-hash dengan `crypto.scrypt` bawaan Node (N=16384, r=8, p=1, salt 16 byte) — amandemen 2026-11-22, menggantikan `bcryptjs`. Login menghasilkan access token JWT HS256 (TTL 15 menit, ditandatangani dengan `AUTH_JWT_SECRET` lewat `node:crypto`) dan refresh token acak (TTL 7 hari, rotasi saat dipakai), keduanya disimpan di cookie `HttpOnly; Secure; SameSite=Lax; Domain=.hanyadi.web.id`. Tidak ada token di `localStorage`. Akun admin awal dibuat dari variabel lingkungan (`BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_EMAIL`) saat migrasi; kredensial tidak pernah ditulis di repository.
4. **Pemisahan akses**:
   - CMS: `admin`, `editor`, `validator`, `viewer` (login wajib).
   - Tryout: `peserta` atau pengguna lain yang memiliki permission `tryout.access` (login wajib).
   - Endpoint tulis variasi presentasi tetap memakai `X-Presentation-Key` untuk komunikasi antar-service; kunci tersebut bukan pengganti login pengguna.
5. **Penegakan aturan di server**: middleware `authenticate` + `authorize(permission)` dipasang di router backend sebelum handler. UI hanya menyembunyikan tombol sebagai kenyamanan, bukan sebagai satu-satunya pengaman. Setiap permintaan tanpa sesi valid diberi `401 UNAUTHORIZED`; sesi valid tanpa permission diberi `403 FORBIDDEN`. Envelope error tetap `{ ok, data|error, meta }`.
6. **Presentation service** memverifikasi JWT cookie yang sama (secret bersama `AUTH_JWT_SECRET`) untuk endpoint baca tryout, tanpa query DB per permintaan; endpoint write tetap dengan `X-Presentation-Key`.
7. **Proxy**: CMS dan tryout tetap memakai proxy `/api/` same-origin. Cookie memakai domain induk `.hanyadi.web.id` agar sesi login dikenali di kedua subdomain. CORS hanya mengizinkan origin `cms.hanyadi.web.id` dan `tryout.hanyadi.web.id` dengan `credentials: true`.

## Matriks Hak Akses (minimum)

| Permission | admin | editor | validator | viewer | peserta |
|---|---|---|---|---|---|
| `cms.access` | ✓ | ✓ | ✓ | ✓ | — |
| `questions.read` | ✓ | ✓ | ✓ | ✓ | — |
| `questions.write` (create/update/archive/import) | ✓ | ✓ | — | — | — |
| `questions.review` (status & answer key) | ✓ | — | ✓ | — | — |
| `readiness.write` | ✓ | — | ✓ | — | — |
| `roles.manage` / `users.roles.manage` | ✓ | — | — | — | — |
| `tryout.access` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `presentation.read` (tryout) | ✓ | ✓ | ✓ | ✓ | ✓ |

Guard tambahan: pengguna tidak boleh mencabut role `admin` dari dirinya sendiri jika ia adalah admin terakhir yang aktif.

## Konsekuensi

- Migrasi baru `db/migrations/004_auth_roles.sql` wajib dibuat oleh Backend dan ditinjau QA (`QA-11`) sebelum diterapkan.
- Semua endpoint CMS yang sudah ada berubah kontraknya: butuh cookie sesi dan permission baru. OpenAPI harus diperbarui (`BE-16`) sebelum Frontend dan Tryout mengonsumsi.
- Tidak ada dependency npm baru: hashing memakai `crypto.scrypt`, JWT HS256 dan parsing cookie memakai modul `node:crypto` bawaan. Dipilih untuk mengurangi jejak memori saat build/deploy pada kondisi `available` RAM hanya ~299MB (cek 2026-11-22).
- Sesi yang dicabut baru kedaluwarsa maksimal 15 menit (TTL access token); logout langsung mencabut baris `auth_sessions` dan menghapus cookie.
- QA harus menguji negatif path: tanpa cookie, cookie kadaluarsa, role salah, eskalasi privilege, dan regresi alur tryout yang sudah rilis.
- Jika review QA menolak desain ini, PM membuka ADR-002 dan task terkait ditandai `blocked`, bukan diteruskan oleh agent.

## Alternatif yang Dipertimbangkan

- **Tabel `users` terpisah dari `contributors`**: ditolak karena menciptakan dua sumber identitas dan memaksa migrasi semua kolom `created_by`/`updated_by`/`validated_by`.
- **Role statis `CHECK` di `contributors.role`** (perpanjangan schema lama): ditolak karena manajemen role butuh perubahan data tanpa migrasi dan tidak bisa multi-role.
- **Simpan JWT di `localStorage`**: ditolak karena rentan XSS; dipilih cookie `HttpOnly`.
- **Semua baca tryout lewat proxy backend**: ditolak karena menambah beban API yang sudah melayani CMS; verifikasi JWT di presentation service lebih ringan untuk RAM 2GB.

## Amandemen 2026-11-22

| Field | Isi |
|---|---|
| ID | ADR-001-A1 |
| Pemilik | PM |
| Status | accepted, disetujui QA-11 |

Perubahan: implementasi kriptografi memakai modul bawaan `node:crypto` (`scrypt` + HMAC-SHA256) tanpa package npm baru. Alasan: pemeriksaan memori sebelum eksekusi menunjukkan `available` 299MB dari 1935MB total, dengan dua proses opencode memakai ~1,1GB; menghindari `npm install` menurunkan risiko OOM. Kontrak, cookie, TTL, matriks permission, dan kewajiban review QA tidak berubah.
