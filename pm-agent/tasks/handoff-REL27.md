# Handoff — REL-27

| Field | Isi |
|---|---|
| Task ID | REL-27 |
| Nama task | Gate produksi Fase 6u |
| Agent pengirim | PM |
| Agent penerima | Release |
| Tanggal | 2026-11-24 |
| Status | GO |

## Artifact yang Diserahkan

- Path file: `db/migrations/030_tryout_events_and_sessions.sql`, `tryout-agent/index.html`, `pm-agent/progress/status-board.md`
- Endpoint / UI: `#/tryouts`, `#/reports/tryout`, tryout publik `{slug}` per sesi
- Bukti (log, screenshot, test result): gate QA/docs/deploy **GO**; backup `/tmp/opencode/bank_soal_db-pre030-2026-11-24.dump` ada (187958 bytes); migrasi `030` sudah dijalankan; services sehat; regresi 32/32; baseline DB `1|1|1|2|10|1|3`; Fase 6u sudah di-commit dan di-push ke `origin/main` di commit `b9f377a` — `Finalisasi Fase 6u — tryout bersesi dan tutup REL-27` — sesuai permintaan user

## Acceptance Criteria Terpenuhi

- [x] Backup pre-migrasi `030` dibuat dan path-nya dicatat
- [x] Migrasi dijalankan idempoten; owner objek `bank_soal_user`
- [x] Deploy BE/FE/PRES/TRY; `app.js?v=19` ter-serve
- [x] Smoke test: buat tryout 2 sesi berbeda mapel, pilih prospektus, cek status `selesai`, unduh Excel, buka detail pelanggaran, kerjakan sesi 1, lanjut sesi 2, login ulang
- [x] QA-37 lolos; status board `REL-27` diisi GO/NO-GO
- [x] Perubahan di-commit dan di-push ke `origin/main` di `b9f377a` — `Finalisasi Fase 6u — tryout bersesi dan tutup REL-27` — sesuai permintaan user

## Catatan Kendala / Risiko

- Rollback ke `REL-26` tanpa menyentuh Fase 6/6t dan tanpa membuka Fase 7.
- Jangan menaikkan `cbt_max_violations`.
- Pastikan batas akhir induk tidak mengubah kuota violation atau skor historis.
- Empat pertanyaan terbuka ADR-017 tetap tercatat sebagai catatan historis; gate GO mengikuti bukti QA-37, bukan asumsi jawaban.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
