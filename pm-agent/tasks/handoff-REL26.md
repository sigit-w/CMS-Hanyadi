# Handoff — REL-26

| Field | Isi |
|---|---|
| Task ID | REL-26 |
| Nama task | Gate produksi Fase 6t |
| Agent pengirim | PM |
| Agent penerima | Release |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `db/migrations/029_tryout_multi_mapel.sql`, `tryout-agent/index.html`, `pm-agent/progress/status-board.md`
- Endpoint / UI: `#/tryouts`, tryout publik `https://tryout.hanyadi.web.id/{slug}`
- Bukti (log, screenshot, test result): regresi akhir `21/21 pass, 0 fail` (`CBT-01…06`, `T-01…T-09`, `Q6T-01…06`); baseline DB `1 session | 1 mapel junction | 2 peserta | 10 submission | cbt_max_violations=3`; bundle CMS `assets/index-BrifSTIr.js` memuat `mapel_codes`; tryout publik menyajikan `app.js?v=18`, `Kirim Semua Jawaban`, `Pelanggaran tercatat`, dan `submit-all`; health BE/PRES `200`; YAML OpenAPI valid (`3.0.3`, 52 paths)

## Acceptance Criteria Terpenuhi

- [x] Backup pre-migrasi `029` dibuat dan path-nya dicatat
- [x] Migrasi dijalankan idempoten; owner objek `bank_soal_user`
- [x] Deploy BE/FE/PRES/TRY sesuai handoff; asset `app.js?v=18` ter-serve
- [x] Smoke test: create tryout 2 mapel unik, pilih lembar, buka tryout, lihat toast violation, submit sekali, lihat siswa di picker (dicakup Q6T-01…06 + verifikasi bundle ter-serve)
- [x] QA-36 lolos; status board `REL-26` diisi GO
- [x] Commit perubahan yang masih working-tree sebelum gate

## Catatan Kendala / Risiko

- Rollback ke `REL-25` tanpa menyentuh Fase 6/7.
- Jangan menaikkan `cbt_max_violations`.
- Jangan mengubah status `REL-01…REL-25`.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
