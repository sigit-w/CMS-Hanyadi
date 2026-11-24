# Handoff — BE-32 (Fase 6o)

| Field | Isi |
|---|---|
| Task ID | BE-32 |
| Nama task | Migrasi jadwal & lembar tryout, Peserta Umum dengan PIN, dan penyesuaian auth |
| Agent pengirim | PM |
| Agent penerima | Backend |
| Tanggal | 2026-11-24 |
| Status | done — migrasi 020/021/022 diapply, backend direstart, QA 142/142 |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-007-peserta-umum-tryout.md`, `pm-agent/tasks/phase6o-backlog.md`
- Target utama: `db/migrations/020_peserta_umum.sql`, `db/migrations/021_tryout_jadwal_lembar.sql`, `db/README.md`
- Target kode: `backend-agent/src/participantRoutes.js`, `authRoutes.js`, `authMiddleware.js`, `tryoutRoutes.js`, `validate.js`
- Target dokumen: `backend-agent/openapi/openapi.yaml`, `backend-agent/README.md`
- Bukti: `tryout_sessions` saat ini hanya punya `session_date DATE` (`db/schema.sql:89-99`); `tryout_participants.email NOT NULL` (`db/migrations/010_tryout_participants.sql:4`); login mencari participant by email (`authRoutes.js:92-111`); `authMiddleware.js:28` menolak participant tanpa email; `POST /tryouts` mewajibkan `question_ids`/`participant_ids` (`tryoutRoutes.js:86-149`)

## Acceptance Criteria

- [ ] QA-29A menandatangani review ADR-007 dan rencana DDL sebelum migrasi diapply; jangan menjalankan DDL sebelum gate ini.
- [ ] `020_peserta_umum.sql` idempoten: menambah `jenis` (`'siswa'|'umum'`, default `'siswa'`), `pin_hash`, `ALTER email DROP NOT NULL`, mengganti unique index email menjadi partial `WHERE email IS NOT NULL`, menambah partial unique `lower(nama) WHERE jenis='umum'`, serta check constraint WA/PIN/email bersyarat.
- [ ] `021_tryout_jadwal_lembar.sql` idempoten: menambah `start_at`, `end_at` (`TIMESTAMPTZ`, backfill dari `session_date` zona `Asia/Jakarta`, `end > start`), membuat `tryout_session_sheets (session_id, sheet_id)` dengan FK CASCADE, dan backfill relasi dari data lama bila memungkinkan.
- [ ] `POST /api/v1/participants` menerima `jenis='umum'` dengan `nama`, `sekolah`, `pin`, `wa_orang_tua`; menyimpan `pin_hash` memakai `hashPassword()` yang sudah ada, `email NULL`, `kelas=0`, `program_belajar_id NULL`, dan tidak pernah menyimpan/mengembalikan plaintext PIN.
- [ ] Validasi Umum: PIN tepat `/^\d{9}$/`, Nama/Sekolah/WA wajib, WA mengikuti format existing, duplikat Nama Umum menghasilkan `409 CONFLICT`; siswa existing tetap wajib email+password+kelas.
- [ ] `POST /api/v1/tryouts` menerima `start_at`, `end_at`, `sheet_ids`, dan `participant_ids` opsional; `session_date` diturunkan dari `start_at`; validasi `end_at > start_at`.
- [ ] `sheet_ids` divalidasi aktif dan mapelnya sama dengan `mapel_code`; dalam satu transaksi, backend mengisi `tryout_session_sheets` dan menurunkan `question_sheet_questions` ke `tryout_session_questions` dengan urutan `position` yang stabil.
- [ ] Payload lama `question_ids` tetap diterima dan berperilaku seperti sebelum Fase 6o; regresi `TR-05` tidak perlu diubah kontraknya.
- [ ] `participant_ids` boleh kosong/tidak ada; constraint `requireIds()` tidak dipakai untuk peserta pada alur baru.
- [ ] `findLoginAccount()` di `authRoutes.js` menyelesaikan identitas dengan urutan Umum (Nama+PIN) → Siswa (Email+Password) → contributor CMS; verifikasi PIN memakai `verifyPassword(pin, pin_hash)`.
- [ ] `sessionPayload()` dan `authMiddleware.js` memakai fallback `nama` untuk `username`/`display_name` dan tidak lagi menolak participant tanpa email; JWT tetap `account_type='participant'`, roles/permissions lama.
- [ ] Tidak ada permission baru dan tidak ada perubahan pada presentation service; cookie, refresh, logout, dan lockout 5x/15 menit tetap berlaku untuk Umum.
- [ ] OpenAPI mendokumentasikan `jenis`, `pin`, `wa_orang_tua`, `start_at`, `end_at`, `sheet_ids`, `participant_ids` opsional, serta makna `username`/`password` saat login; `db/README.md` mencatat 020/021.
- [ ] Backend direstart setelah migrasi, health `200`, dan bukti verifikasi dikirim ke QA-29.

## Catatan Kendala / Risiko

- Jangan membuat endpoint `/participant/login` atau tabel participant terpisah; ADR-007/D10/D11 mengharuskan jalur participant existing.
- Jangan mencatat PIN plaintext di log, response error, atau laporan. Jangan memakai email dummy untuk Umum.
- Partial unique index Nama hanya untuk `jenis='umum'`; sengaja tidak unik lintas siswa/CMS. Urutan resolusi login sudah mengatasi tabrakan.
- Backfill `start_at`/`end_at` harus menutup seluruh baris existing agar `SET NOT NULL` tidak gagal. Siapkan rollback transaksional/backup sebelum apply.
- Koordinasikan nama field `sheet_ids` dan bentuk payload dengan FE-29; koordinasikan pembacaan JWT participant dengan TRY-12.
- Cek `free -h` sebelum apply/verifikasi. Baseline distribusi: 541 MiB available, swap 722 MiB / 3.9 GiB.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
