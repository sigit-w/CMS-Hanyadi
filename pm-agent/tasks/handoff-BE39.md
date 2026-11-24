# Handoff — BE-39

| Field | Isi |
|---|---|
| Task ID | BE-39 |
| Nama task | Migrasi & API tryout multi-mapel |
| Agent pengirim | PM |
| Agent penerima | Backend |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `db/migrations/029_tryout_multi_mapel.sql`, `backend-agent/src/tryoutRoutes.js`, `backend-agent/src/mapelRoutes.js`, `backend-agent/src/validate.js`
- Endpoint / UI: `POST /api/v1/tryouts` terima `mapel_codes[]`; `GET /api/v1/tryouts` & `GET /api/v1/tryouts/:id` kembalikan `mapels[]` + `mapel_code` legacy; validasi `sheet_ids` terhadap mapel terpilih
- Bukti (log, screenshot, test result): eksplorasi `tryoutRoutes.js:276-309`, `:342-365`, `mapelRoutes.js:62-66`, `db/schema.sql:111`; struktur aktual dikonfirmasi via `information_schema` (`mapel_id` nullable)

## Acceptance Criteria Terpenuhi

- [ ] Tabel `tryout_session_mapels` dengan PK `(session_id, mapel_id)` dan FK cascade; backfill dari `mapel_id` lama + mapel lembar soal
- [ ] `mapel_codes` unik, 1–10, mapel aktif; duplikat → `400 VALIDATION_ERROR`
- [ ] `mapel_code` legacy masih diterima; konflik dengan `mapel_codes` → `400`
- [ ] Rekonsiliasi soal/lembar memakai kumpulan mapel, bukan `mapel_code` tunggal
- [ ] `tryout_count` di `mapelRoutes` dihitung dari junction
- [ ] Backup pre-migrasi dibuat dan dicatat

## Catatan Kendala / Risiko

- `db/schema.sql` tertinggal dari migrasi `021`–`028`; jangan dipakai sebagai sumber kebenaran.
- Kolom `mapel_id` tidak dihapus, hanya tidak jadi sumber penulisan baru.
- Tidak ada perubahan Fase 7.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
