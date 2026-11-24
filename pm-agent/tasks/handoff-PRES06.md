# Handoff — PRES-06

| Field | Isi |
|---|---|
| Task ID | PRES-06 |
| Nama task | Endpoint submit-all & payload notifikasi |
| Agent pengirim | PM |
| Agent penerima | Presentasi |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `presentation-service/src/routes.js`, `presentation-service/src/auth.js` (jika perlu)
- Endpoint / UI: `POST /api/v1/presentation/attempts/submit-all`, `POST /api/v1/presentation/cbt/attempt/violation`, `GET /api/v1/presentation/questions`
- Bukti (log, screenshot, test result): `routes.js:324` payload attempt, `:591` violation handler; ADR-013 `finalize` transaksional sebagai referensi

## Acceptance Criteria Terpenuhi

- [ ] `submit-all` menerima `{ answers: [{ question_id, answer, answer_text?, answers? }] }` untuk sesi non-CBT aktif
- [ ] Semua `question_id` divalidasi milik sesi; jawaban dinilai server; `tryout_submissions` ditulis dalam satu transaksi
- [ ] Response hanya `submitted_count` + status; **tanpa** `score`, kunci, atau `is_correct`
- [ ] Endpoint lama `/presentation/questions/:id/submit` tetap berfungsi untuk kompatibilitas
- [ ] Response violation menyertakan `type`, `violation_count`, `max_violations`
- [ ] `GET /presentation/questions` tetap bekerja untuk soal lintas mapel dalam satu sesi

## Catatan Kendala / Risiko

- Jangan mengubah perilaku CBT `finalize`, deadline, autosave, atau pengacakan dari ADR-013.
- Jangan memunculkan skor ke payload peserta.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
