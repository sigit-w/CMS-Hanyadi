# REL-22 — Release Gate True-False Multi-Pernyataan

| Item | Status |
|---|---|
| Backup DB pre-026 | Lulus — `/tmp/opencode/bank_soal_db-pre026-2026-11-24-125305.dump` |
| Migrasi `026_true_false_statements.sql` | Terpasang & idempoten; owner `bank_soal_user` |
| Validasi 1–5 pernyataan & minimal satu benar | Lulus |
| Penilaian all-correct & detail per butir | Lulus |
| Kerahasiaan kunci di presentation-service | Lulus |
| Laporan `statement_details` | Lulus |
| Edit soal `true_false` existing | Lulus |
| Regresi penuh | Lulus — 174/174, 0 gagal, 0 P0/P1 |
| Bundle frontend & tryout-agent | Lulus — `index-BGo4m3U1.js`, `index-D_wAgUtB.css`, `app.js?v=14`, `styles.css?v=13` |
| Health produksi | Lulus — API 8082, presentation 8083, CMS, tryout |

Keputusan: **REL-22 GO**

Catatan: gate ini adalah fitur baru setelah Fase 6 ditutup. `REL-01…REL-21` tidak dibuka ulang dan tetap GO. Fase 7 tidak dibuka; laporan sistem slide Fase 7 tetap menjadi catatan historis/runbook. Regresi dijalankan dengan `NODE_OPTIONS=--max-old-space-size=128 npm test`; build frontend memakai heap 256 MB tanpa OOM.
