# REL-23 — Release Gate Mode CBT Lengkap

| Item | Status |
|---|---|
| Backup DB pre-027 | Lulus — `/tmp/opencode/bank_soal_db-pre027-2026-11-24.dump` |
| Migrasi `027_cbt_exam_mode.sql` | Terpasang & idempoten; owner `bank_soal_user` |
| Konfigurasi CBT admin & `PATCH /tryouts/{id}/cbt` | Lulus |
| Timer, deadline, autosave, flag, dan finalize | Lulus |
| Acak deterministik soal/opsi/pernyataan | Lulus |
| Kerahasiaan skor/kunci dari peserta | Lulus |
| Log pelanggaran & auto-submit | Lulus |
| Laporan `attempts` dan `violations` | Lulus |
| Fallback tryout non-CBT | Lulus — regresi alur lama 174 test existing |
| Regresi penuh | Lulus — 179/179, 0 gagal, 0 P0/P1 |
| Bundle frontend & tryout-agent | Lulus — `index-B81gEIYV.js`, `index-D_wAgUtB.css`, `app.js?v=15`, `styles.css?v=14` |
| Health produksi | Lulus — API 8082, presentation 8083, CMS, tryout |

Keputusan: **REL-23 GO**

Catatan: gate ini adalah fitur baru setelah Fase 6 dan `REL-22` ditutup. `REL-01…REL-22` tidak dibuka ulang dan tetap GO. Fase 7 tidak dibuka; laporan sistem slide Fase 7 tetap menjadi catatan historis/runbook. Regresi dijalankan dengan `NODE_OPTIONS=--max-old-space-size=128 npm test`; build frontend memakai heap 256 MB tanpa OOM.
