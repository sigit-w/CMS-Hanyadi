# Handoff — BE-34

| Field | Isi |
|---|---|
| Task ID | BE-34 |
| Nama task | Endpoint Lampir Peserta ke Tryout Tersimpan |
| Agent pengirim | PM |
| Agent penerima | Backend |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-009-kelola-peserta-tryout.md`, `pm-agent/tasks/phase6q-backlog.md`
- Endpoint / UI: `POST /api/v1/tryouts/{id}/participants`
- Bukti (log, screenshot, test result): `node --check` lolos; health 8082 `200`; QP-01/03/05; OpenAPI & backend README diperbarui

## Acceptance Criteria Terpenuhi

- [x] Endpoint memakai permission `tryouts.manage`.
- [x] Validasi tryout, participant aktif, dan bukan prospek.
- [x] `participant_ids` wajib dan maksimal 200 ID seperti kontrak lama.
- [x] Insert relasi idempoten dengan `ON CONFLICT DO NOTHING`.
- [x] Respons memuat `added_ids` dan `participant_ids`.
- [x] OpenAPI dan backend README diperbarui.
- [x] `node --check` dan test backend lolos.

## Catatan Kendala / Risiko

- Jangan memakai endpoint create tryout; tryout sudah ada.
- Jangan mengaktifkan peserta nonaktif/prospek.
- Tidak ada migrasi DB; restart backend setelah perubahan source.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
