# Handoff — DOC-09

| Field | Isi |
|---|---|
| Task ID | DOC-09 |
| Nama task | Dokumentasi filter sesi, filter nama tryout, dan format XLSX Fase 6v |
| Agent pengirim | PM |
| Agent penerima | Dokumentasi |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `backend-agent/README.md`, `backend-agent/openapi/openapi.yaml`, `docs/architecture.md`
- Endpoint / UI: `GET /api/v1/tryout-sessions?search=`, `GET /api/v1/reports/tryout/export.xlsx?session_id=&tryout_name=`, halaman `#/reports/tryout`
- Bukti (log, screenshot, test result): `YAML OK 3.0.3 56`, `git diff --check` OK; README/OpenAPI/arsitektur diperbarui.

## Acceptance Criteria Terpenuhi

- [x] README backend mendokumentasikan parameter `search` pada daftar sesi laporan dan `tryout_name` pada ekspor XLSX
- [x] OpenAPI mencantumkan `search`, `session_id`, `tryout_name`, aturan `ILIKE` case-insensitive/partial, escape wildcard, batas panjang, serta penggabungan `AND`
- [x] Dokumentasi menjelaskan format XLSX baru: 3 baris judul, header dua level, grup `B|S|NILAI` per mapel (nama mapel dinamis), `TOTAL`, `RATA-RATA`, `RANKING`, dan catatan kaki statistik; tidak ada kunci jawaban/pembahasan
- [x] `docs/architecture.md` menjelaskan alur filter: `tryout_sessions` + induk `tryout_events` → pencarian sisi server → tombol `Cari/Filter` → ekspor XLSX
- [x] Catatan kompatibilitas mencantumkan endpoint create/activate legacy yang tetap dipertahankan dan permission `tryout_reports.read` yang tidak diubah
- [x] Contoh tidak memuat kredensial nyata; YAML divalidasi sebelum serah terima

## Catatan Kendala / Risiko

- P2 docs batch 500/nullable dan DISTINCT/title sudah diperbaiki. YAML valid `3.0.3 56`; `git diff --check` OK.
- Risiko diterima terdokumentasi: nilai kosong mapel lain = 0 bila peserta tidak terdaftar di semua sesi; klien legacy wajib mengirim `event_id`/`eventId` yang valid.

## Tindakan Penerima

- [x] Diterima
