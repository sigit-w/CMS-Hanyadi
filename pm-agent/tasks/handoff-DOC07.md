# Handoff — DOC-07

| Field | Isi |
|---|---|
| Task ID | DOC-07 |
| Nama task | Update dokumentasi arsitektur Fase 6t |
| Agent pengirim | PM |
| Agent penerima | Dokumentasi |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `docs/architecture.md`, `README.md` (bagian endpoint/tryout), `pm-agent/README.md` (indeks sudah diperbarui PM)
- Endpoint / UI: `POST /api/v1/tryouts` (`mapel_codes[]`), `POST /api/v1/presentation/attempts/submit-all`, response violation
- Bukti (log, screenshot, test result): `pm-agent/tasks/phase6t-backlog.md`, `pm-agent/decisions/ADR-016-tryout-multi-mapel-dan-alur-peserta.md`

## Acceptance Criteria Terpenuhi

- [ ] Dokumentasi menjelaskan `tryout_session_mapels` dan kolom `mapel_id` sebagai legacy
- [ ] Endpoint baru `submit-all` dan field `mapel_codes[]` tercantum
- [ ] Catatan bahwa kuota pelanggaran tidak berubah dan notifikasi hanya info
- [ ] Tidak menyebut Fase 7 sebagai fitur aktif

## Catatan Kendala / Risiko

- Selaraskan dengan `ADR-013` untuk CBT dan `ADR-016` untuk perubahan ini.
- Jangan mengubah konvensi PM atau penomoran task.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
