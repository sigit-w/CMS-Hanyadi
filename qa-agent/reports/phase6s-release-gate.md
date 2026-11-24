# REL-21 — Release Gate Fase 6s

| Item | Status |
|---|---|
| Migrasi `025_tryout_slug_login_scope.sql` | Terpasang & idempoten |
| Login participant scoped | Lulus |
| Binding session/JWT | Lulus |
| Pemisahan siswa/prospektus/peserta tryout | Lulus |
| Konversi eksplisit Prospektus | Lulus |
| Regresi penuh | Lulus — 169/169, 0 gagal, 0 P0/P1 |
| Bundle frontend & tryout-agent | Lulus — `index-CwovVZBt.js`, `app.js?v=13`, `styles.css?v=12` |
| Hapus tryout dengan sesi terikat | Lulus — `auth_sessions` dibersihkan lebih dulu |

Keputusan: **REL-21 GO**

Catatan: `REL-20` tetap menjadi catatan historis Fase 6r dan tidak diubah. Regresi dijalankan dengan `NODE_OPTIONS=--max-old-space-size=128 npm test`; health API/presentation dan aset produksi terverifikasi.
