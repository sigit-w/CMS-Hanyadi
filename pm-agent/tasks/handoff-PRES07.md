# Handoff — PRES-07

| Field | Isi |
|---|---|
| Task ID | PRES-07 |
| Nama task | Pengambilan soal dan attempt per sesi Fase 6u |
| Agent pengirim | PM |
| Agent penerima | Presentation |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `presentation-service/src/routes.js`
- Endpoint / UI: `GET /api/v1/presentation/questions`, `GET /api/v1/presentation/attempts/summary`, `POST /api/v1/presentation/attempts/submit-all`, endpoint CBT existing
- Bukti (log, screenshot, test result): `/presentation/sessions`, soal/attempt per `session_id`, deadline `min(sesi, induk)`, submit-all tanpa skor; gate `ends_at` peserta `410` "Batas akhir tryout telah terlampaui" (`presentation-service/src/auth.js`)

## Acceptance Criteria Terpenuhi

- [x] Endpoint menerima `session_id` dan hanya mengembalikan soal sesi tersebut
- [x] Deadline efektif = `min(waktu_mulai + durasi sesi, ends_at induk)`
- [x] Submit/all dan finalize tetap per sesi; tidak ada jawaban lintas sesi yang diterima
- [x] Response tetap tanpa skor, `is_correct`, atau kunci jawaban
- [x] Endpoint violation tidak diubah; `cbt_max_violations` tidak diubah

## Catatan Kendala / Risiko

- Token/slug lama tetap harus bisa dipetakan ke sesi.
- Jangan merusak transaksi `submit-all` dari `REL-26`.
- Koordinasikan kontrak dengan BE-40 dan TRY-19.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
