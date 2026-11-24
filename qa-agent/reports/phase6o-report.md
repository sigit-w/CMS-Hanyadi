# Laporan QA — Fase 6o: Alur Buat Tryout & Peserta Umum

| Field | Isi |
|---|---|
| Tanggal | 2026-11-24 |
| Task | QA-29A (review desain) → QA-29 (regresi) |
| ADR | ADR-007 `accepted` |
| Suite | `qa-agent/tests/phase6o.mjs` + seluruh regresi `npm test` |
| Hasil | 142/142 pass, 0 fail |
| Memori | Build FE heap 256 MB; regresi heap 128 MB; tanpa OOM |
| Bug P0/P1 setelah perbaikan | 0 |
| Rekomendasi | **GO** untuk `REL-17` |

## Review QA-29A

Review ADR-007 dan rencana migrasi dilakukan sebelum DDL final diapply. Migrasi `020` dan `021` di-dry-run dengan `BEGIN … ROLLBACK`, lalu diapply dengan backup `/tmp/opencode/bank_soal_fase6o_pre_20261124_085046.sql`.

Dua temuan P1 selama review/eksekusi:

| ID | Temuan | Perbaikan | Status |
|---|---|---|---|
| QA6O-BUG-01 | `tryout_participants.password_hash` masih `NOT NULL`, sehingga pembuatan Peserta Umum mengembalikan `500`. | `020` disesuaikan dan migrasi idempoten `022_participant_password_nullable.sql` diapply. | fixed |
| QA6O-BUG-02 | Endpoint legacy `POST /tryout-sessions` belum mengisi `start_at`/`end_at` setelah `021`, sehingga sesi lama mengembalikan `500`. | `tryoutReportRoutes.js` kini menurunkan rentang 00:00–23:59 Asia/Jakarta dari `session_date`. | fixed |

Keduanya sudah diverifikasi ulang lewat U-02/U-05 dan regresi J-10/TR-01..TR-06. Tidak ada bug P0/P1 yang tersisa.

## Skenario Fase 6o

| ID | Skenario | Hasil |
|---|---|---|
| U-01 | Kolom `jenis`, `pin_hash`, `start_at`, `end_at`, tabel `tryout_session_sheets`, dan `password_hash` nullable terpasang. | pass |
| U-02 | Admin membuat Peserta Umum: `jenis='umum'`, `email NULL`, `kelas=0`, WA valid, `pin_hash scrypt`, plaintext PIN tidak dikembalikan. | pass |
| U-03 | PIN bukan 9 digit, WA invalid, Nama kosong, dan Nama Umum duplikat ditolak (`400`/`409`). | pass |
| U-04 | Login Nama + PIN sukses; `/auth/me` mengembalikan username Nama dan permission `tryout.access`/`presentation.read`; `/tryout/questions` `200`. | pass |
| U-05 | PIN salah 5 kali mengunci akun Umum; percobaan ke-6 `429`; pesan error netral. | pass |
| U-06 | Marker form CMS sesuai ADR-007: urutan field, lembar soal per mapel, peserta opsional, popup dan generator PIN. | pass |
| U-07 | Tryout tanpa peserta tersimpan dari `sheet_ids`; `tryout_session_sheets` dan `tryout_session_questions` terisi. | pass |
| U-08 | Payload lama `question_ids` tetap diterima dan Peserta Umum bisa menjadi `participant_ids`. | pass |
| U-09 | Label login tryout baru dan aset `styles.css?v=11`/`app.js?v=12` terlayani. | pass |
| U-10 | OpenAPI dan `db/README.md` memuat kontrak serta migrasi Fase 6o. | pass |

## Regresi & Deploy

- Perintah: `NODE_OPTIONS=--max-old-space-size=128 npm test` dari `backend-agent/`.
- Hasil: `1..142`, `pass 142`, `fail 0`, `duration_ms ≈ 11.988`.
- Build FE: `NODE_OPTIONS=--max-old-space-size=256 npm run build`; bundle `index-BWwbQxdi.js` (276,95 kB).
- Backend direstart setelah perubahan kode: `bank-soal-api active`; health API dan presentation `200`.
- Static produksi terverifikasi: CMS mengembalikan bundle baru; tryout mengembalikan label dan versi aset baru.
- Fixture QA bersih: `qa_email=0`, `qa_umum=0`, `qa_tryout=0`.

## Kesimpulan

Seluruh AC Fase 6o terpenuhi. Alur Buat Tryout memakai lembar soal dan jadwal baru, Peserta Umum dengan PIN dapat dibuat serta login, payload lama tetap kompatibel, dan regresi penuh lolos tanpa OOM. QA merekomendasikan `REL-17` **GO**.
