# Handoff — BE-27 (Fase 6l)

| Field | Isi |
|---|---|
| Task ID | BE-27 |
| Nama task | Migrasi, API CRUD Lembar Soal, picker soal, flag lembar pada daftar soal, RBAC |
| Agent pengirim | PM |
| Agent penerima | Backend |
| Tanggal | 2026-11-23 |
| Status | review |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-005-lembar-soal.md`, `pm-agent/tasks/phase6l-backlog.md`, `pm-agent/progress/status-board.md`
- Endpoint / UI: `GET/POST /api/v1/question-sheets`, `GET/PUT/DELETE /api/v1/question-sheets/:id`, `GET /api/v1/question-sheets/question-picker`, `GET /api/v1/questions` (field `sheets`)
- Bukti: ADR-005 `accepted`; baseline QA 118/118 lolos dan `REL-11` GO; `free -h` 2026-11-23: 1.9 GiB total, 313 MiB available, swap 623 MiB / 3.9 GiB

## Acceptance Criteria Terpenuhi

- [ ] Migrasi `016_lembar_soal.sql` idempoten membuat `question_sheets`, `question_sheet_questions`, indeks, trigger `updated_at`, dan permission `question_sheets.manage`; `schema.sql` serta `db/README.md` diperbarui.
- [ ] Kode `VARCHAR(12)` unik dengan constraint tepat 12 karakter `^[A-Z0-9-]{12}$`; `GET /question-sheets/generate-code?mapel=<code>` menghasilkan `LS-<KODE_MAPEL>-mmyy` dari `mapels.code` yang tepat 4 karakter (mis. `MTKA` → `LS-MTKA-1126`); tidak ada pemetaan nama/fallback `CUST`; create menerima `mapel_code`, memvalidasinya terhadap mapel soal, dan meng-generate kode bila field kode kosong; kode hasil edit tetap memenuhi constraint.
- [ ] `duration_minutes INTEGER > 0` menerima angka bebas (bukan preset/dropdown 60/90/120).
- [ ] Create/edit transaksional: minimal satu soal, semua `mapel_id` sama dengan `mapel_code` yang dipilih user, `question_sheets.mapel_id` disimpan dari mapel terpilih dan divalidasi ulang saat edit; edit ditolak jika daftar kosong.
- [ ] Perubahan kode saat lembar belum dipakai memperbarui flag seluruh soal terkait dalam satu transaksi; pengecekan "dipakai" sementara selalu `false` karena relasi tryout–lembar belum ada di Fase 6l.
- [ ] `GET /api/v1/questions` mengembalikan `sheets: [{ id, code, name }]` untuk lembar aktif dengan satu query agregat, tanpa N+1; lembar arsip tidak muncul.
- [ ] `DELETE` melakukan soft delete `archived = true` + `archived_at`; filter `status=archived`; tidak ada hard delete.
- [ ] RBAC: permission muncul di `GET /permissions`, diberikan ke `admin` dan `editor`; semua endpoint lembar soal dan picker memakai `authorize('question_sheets.manage')`.
- [ ] OpenAPI diperbarui sesuai kontrak ADR-005; regresi test backend lolos.

## Catatan Kendala / Risiko

- ADR-005 sudah `accepted`; BE-27 dapat dimulai sekarang dan menjadi dependency FE-24/QA-24.
- Jalankan migrasi `016` lewat `psql` sebelum restart API; jangan menambah service baru.
- Gunakan pola `authorize`/`authorizeAny` yang sudah ada di `src/authMiddleware.js`; jangan mengubah kontrak `GET /questions` selain menambah field `sheets`.
- Cek `free -h` sebelum dan sesudah migrasi/test. Jalankan test Node satu proses dengan `NODE_OPTIONS=--max-old-space-size=128`; jangan paralel dengan build frontend. Laporkan jika available memory turun di bawah ~200 MiB.

## Amendemen 2026-11-23 — Kode Mapel 4 Karakter (implementasi BE-28)

- [x] Migrasi `017_mapel_code_4_char.sql` terpasang: `matematika→MTKA`, `bahasa_indonesia→BIND`, `ipas→IPAS`; constraint `mapels_code_4_char` `^[A-Z0-9]{4}$`. Referensi DB memakai FK `mapel_id`, jadi tidak ada update baris referensi.
- [x] `requireMapelCode()` menormalkan huruf kecil ke kapital dan memvalidasi tepat 4 karakter; `GET /question-sheets/generate-code?mapel=<code>` memakai `mapels.code` langsung. `MAPEL_PREFIXES`, `mapelPrefix()`, dan fallback `CUST` dihapus.
- [x] `POST/PUT /question-sheets`, filter/picker/daftar soal, dan tryout memakai `requireMapelCode()`; kode generated otomatis 12 karakter `LS-<CODE>-mmyy`.
- [x] OpenAPI, `db/schema.sql`, `db/README.md`, `backend-agent/README.md`, dan skenario QA diselaraskan; gate tercatat sebagai `REL-13`.

## Amendemen D7 / BE-29 — 2026-11-23

- [x] `GET /api/v1/questions` menerima `question_type` dan menggabungkannya dengan filter `mapel`, `status`, `search` pada query count dan list.
- [x] `GET /api/v1/question-sheets/question-picker` menerima `question_type` bersama `mapel`/`search`; pagination tidak berubah.
- [x] Nilai di luar `QUESTION_TYPES` ditolak `400 VALIDATION_ERROR`; OpenAPI mendokumentasikan parameter dan respons `400`.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
