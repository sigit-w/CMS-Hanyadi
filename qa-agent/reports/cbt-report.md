# Mode CBT Lengkap — Laporan QA

## Ruang Lingkup

- Mode CBT opsional per tryout dengan timer, autosave, flag ragu-ragu, submit akhir, pengacakan deterministik, dan log pelanggaran.
- Satu attempt per peserta/sesi; skor dihitung server saat finalize dan hanya tersedia di laporan admin.
- Fallback alur lama untuk sesi non-CBT.
- Migrasi `027`, owner `bank_soal_user`, konfigurasi admin, endpoint presentation, CMS, tryout-agent, dan regresi penuh.

## Eksekusi

- Perintah khusus:
  ```sh
  sudo bash -c 'set -a; . /opt/virtual-office-bank-soal/backend-agent/.env; set +a; export QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD"; NODE_OPTIONS=--max-old-space-size=128 node --test ../qa-agent/tests/cbt.mjs'
  ```
- Perintah regresi:
  ```sh
  sudo bash -c 'set -a; . /opt/virtual-office-bank-soal/backend-agent/.env; set +a; export QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD"; NODE_OPTIONS=--max-old-space-size=128 npm test'
  ```
- Nomor test: `CBT-01` sampai `CBT-05`.
- Fokus regresi: seluruh alur MVP/Fase 6, login scoped, laporan tryout, multi-jawaban, true-false, aset tryout, dan marker UI Fase 6s.

## Hasil

- `CBT-01`…`CBT-05`: 5/5 lolos.
- Regresi penuh: 179/179 lolos, 0 gagal, 0 P0/P1, tanpa OOM dengan heap 128 MB.
- Perbaikan saat eksekusi:
  - Assertion QA disesuaikan untuk `BIGINT` yang dikembalikan sebagai string oleh lapisan API/DB.
  - Query flag dibatasi ke attempt peserta uji agar tidak menangkap data lain.
  - `finalizeAttempt` di presentation-service kini melepaskan klien pool dalam blok `finally`; sebelumnya kebocoran koneksi memicu `timeout exceeded when trying to connect` setelah beberapa finalize.
  - Aset tryout di `phase6o.mjs` diselaraskan ke `styles.css?v=14` dan `app.js?v=15`.
- Gate rilis tercatat di `cbt-release-gate.md`.
