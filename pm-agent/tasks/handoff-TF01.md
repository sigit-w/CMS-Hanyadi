# Handoff — True-False Multi-Pernyataan (TF-01)

| Field | Isi |
|---|---|
| PM | PM-22 |
| ADR | `pm-agent/decisions/ADR-012-true-false-multi-pernyataan.md` |
| Backlog | `pm-agent/tasks/true-false-backlog.md` |
| Gate | REL-22 |
| Status | Selesai; arsip serah terima |

## Keputusan Ringkas

- Tipe `true_false` existing diperluas; tidak ada tipe baru.
- `stem`/gambar = konteks bersama; `question_statements` = butir pernyataan.
- Maksimal 5 pernyataan; minimal satu pernyataan benar; soal benar hanya bila semua pernyataan benar.
- Kunci tidak dikirim ke peserta; laporan admin menampilkan `statement_details`.

## BE-37 — Backend

- Buat/check backup DB sebelum migrasi.
- Terraform/DB migration: `db/migrations/026_true_false_statements.sql`, idempoten, owner `bank_soal_user`.
- Validasi: `normalizeStatements`, tolak opsi/kunci pada `true_false`, tolak `statements` pada tipe lain.
- Endpoint: create/update/get questions; answer-key guard; laporan `statement_details`.
- Dokumen: `backend-agent/README.md`, `backend-agent/openapi/openapi.yaml`, `db/README.md`, `db/schema.sql`.
- Verifikasi: `node --check` dan QA `TF-01`, `TF-02`.

## PRES-04 — Presentation

- `approvedQuestion()` mengambil `statements` dengan `is_correct` hanya untuk keperluan server.
- Response GET peserta memakai `{ id, position, text }`.
- Submit menerima `answers` dan memanggil `gradeStatements`.
- Tulis `submission_statement_answers`; rekap tetap satu baris per soal.
- Verifikasi: `node --check` dan QA `TF-03`, `TF-04`.

## FE-34 — Frontend CMS

- `QuestionInput.jsx` dan `Dashboard.jsx` memiliki repeater 1–5 pernyataan.
- Kirim `statements: [{ text, is_correct }]`; jangan kirim opsi/kunci untuk `true_false`.
- Verifikasi: `NODE_OPTIONS=--max-old-space-size=256 npm run build`.

## TRY-16 — Tryout Agent

- Render satu fieldset per pernyataan dengan radio Benar/Salah.
- Validasi semua pernyataan terisi sebelum submit.
- Submit `answers` array; jangan kirim field `answer` untuk `true_false`.
- Bump aset ke `styles.css?v=13` dan `app.js?v=14`.
- Verifikasi: `node --check app.js` dan QA `TF-03`, `TF-04`.

## QA-34 — QA

- File: `qa-agent/tests/true-false-statements.mjs`.
- Skenario:
  - `TF-01` penyimpanan & kunci per butir.
  - `TF-02` validasi negatif.
  - `TF-03` all-correct, kerahasiaan kunci, detail laporan.
  - `TF-04` satu butir salah membuat soal salah.
  - `TF-05` update pernyataan soal existing.
- Perintah regresi:
  ```sh
  sudo bash -c 'set -a; . /opt/virtual-office-bank-soal/backend-agent/.env; set +a; export QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD"; NODE_OPTIONS=--max-old-space-size=128 npm test'
  ```
- Target: 174/174 lolos, 0 P0/P1.

## DOC-06TF & REL-22

- Selaraskan ADR-012, backlog, handoff, status board, laporan sistem, QA report, dan release gate.
- Restart service, verifikasi health/CMS/tryout, commit/push, lalu tandai `REL-22 GO`.
