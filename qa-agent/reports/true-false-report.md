# True-False Multi-Pernyataan — Laporan QA

## Ruang Lingkup

- Tipe `true_false` existing menyimpan 1–5 pernyataan di `question_statements`.
- Penilaian all-correct dan detail jawaban per pernyataan di `submission_statement_answers`.
- Kunci per butir tidak dikirim ke peserta; laporan admin menampilkan `statement_details`.
- Migrasi `026`, owner `bank_soal_user`, validasi create/update, edit soal existing, dan kompatibilitas regresi.

## Eksekusi

- Perintah khusus:
  ```sh
  sudo bash -c 'set -a; . /opt/virtual-office-bank-soal/backend-agent/.env; set +a; export QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD"; NODE_OPTIONS=--max-old-space-size=128 node --test ../qa-agent/tests/true-false-statements.mjs'
  ```
- Perintah regresi:
  ```sh
  sudo bash -c 'set -a; . /opt/virtual-office-bank-soal/backend-agent/.env; set +a; export QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD"; NODE_OPTIONS=--max-old-space-size=128 npm test'
  ```
- Nomor test: `TF-01` sampai `TF-05`.
- Fokus regresi: endpoint lama, login scoped, laporan tryout, multi-jawaban, aset tryout, dan marker UI Fase 6s.

## Hasil

- `TF-01`…`TF-05`: 5/5 lolos.
- Regresi penuh: 174/174 lolos, 0 gagal, 0 P0/P1, tanpa OOM dengan heap 128 MB.
- Perbaikan saat eksekusi:
  - Owner tabel/sequence/view migrasi `026` disesuaikan ke `bank_soal_user`; sebelumnya create soal gagal `42501 permission denied`.
  - Create `true_false` kini menolak `options`/`correct_key`/`correct_keys`.
  - Update pernyataan tanpa mengulang `question_type` tidak lagi menghapus statements.
  - Assertion lama versi aset tryout di `phase6o.mjs` diperbarui ke `styles.css?v=13` dan `app.js?v=14`.
  - `phase6o.mjs` dan `true-false-statements.mjs` lulus dalam regresi penuh.
- Gate rilis tercatat di `true-false-release-gate.md`.
