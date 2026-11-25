# REL-32 — Release Gate Fase 6z

| Item | Status |
|---|---|
| ADR-022 dan backlog R1–R8 | Selesai |
| Tidak ada migrasi skema baru | Lulus — skema tetap `002…032` |
| `usage_count` lembar aktif | Lulus — `GET /questions` dan Dashboard |
| Impor CSV/XLSX-only | Lulus — payload/JSON/TXT ditolak `400 VALIDATION_ERROR` |
| Template CSV dan XLSX | Lulus — keduanya menghasilkan 4 soal valid |
| Kredensial berpasangan | Lulus — `username` + password/PIN, tombol copy menyalin nama + kredensial, hash tidak diekspos |
| Rename `Peserta Umum` | Lulus — judul/menu/hash/marker QA; alias lama redirect |
| Halaman `Kelola Peserta` per tryout | Lulus — `#/tryouts/{id}/peserta`, tabel gabungan, form inline A/B, tanpa popup manage |
| Skenario `Q6Z-01…Q6Z-07` | Lulus — 7/7 |
| Regresi penuh | Lulus — 206/206, 0 gagal, 0 cancelled, 0 skipped, 0 P0/P1 |
| Build frontend | Lulus — `index-C_etU5Vw.js`, `index-C3qyrjbW.css` |
| Health layanan | Lulus — API 200, presentation 200, CMS 200, tryout 200 |
| Dokumentasi PM/ADR/README/laporan sistem | Tersinkron |
| Backup pre-`REL-32` | Tersedia — `/tmp/opencode/bank_soal_db-pre032-2026-11-25.dump` |

Keputusan: **REL-32 GO**

Catatan: rollback `REL-32` memakai dump pre-`REL-32` dan kembali ke `REL-31`; `REL-01…REL-31` tidak dibuka ulang dan Fase 7 tetap dibatalkan. Perubahan Fase 6z masih berada di working tree dan belum di-commit. Detail eksekusi dan perbaikan regresi ada di `phase6z-report.md`.
