# Handoff — BE-33

| Field | Isi |
|---|---|
| Task ID | BE-33 |
| Nama task | Migrasi Prospektus & Endpoint Hapus Relasi Tryout |
| Agent pengirim | PM |
| Agent penerima | Backend |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-008-peserta-tryout-dan-prospektus.md`, `pm-agent/tasks/phase6p-backlog.md`
- Endpoint / UI: `023_prospektus_peserta_umum.sql`; `DELETE /api/v1/tryouts/{id}/participants/{participantId}`; `POST /api/v1/participants/{id}/prospek`; `GET /api/v1/prospektus`; `GET /api/v1/participants?prospek=`
- Bukti (log, screenshot, test result): migrasi `023` terpasang, PR-01/PR-04/PR-05/PR-06 lolos, OpenAPI & DB doc diperbarui

## Acceptance Criteria Terpenuhi

- [x] Kolom `prospek`, `prospek_at`, constraint, dan index dibuat idempoten.
- [x] Transaksi hapus relasi membedakan Umum dan Siswa sesuai ADR-008.
- [x] Sesi Umum dicabut saat menjadi prospek.
- [x] Endpoint prospektus dan filter participant mengembalikan kontrak yang disepakati.
- [x] OpenAPI dan `db/README.md` diperbarui.
- [x] `node --check` dan test backend lolos.

## Catatan Kendala / Risiko

- Jangan memakai `DELETE /participants/{id}` untuk menghapus peserta dari tryout.
- `PARTICIPANT_SELECT` perlu ikut mengirim `prospek` dan `prospek_at` agar FE dapat membedakan status.
- Backup DB wajib sebelum migrasi; restart `bank-soal-api` setelah migrasi.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
