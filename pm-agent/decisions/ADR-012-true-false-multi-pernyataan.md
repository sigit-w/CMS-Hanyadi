# Decision Log — ADR-012

| Field | Isi |
|---|---|
| ID | ADR-012 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | PM-22, BE-37, FE-34, TRY-16, PRES-04, QA-34, DOC-06TF, REL-22 |
| Melanjutkan | Fase 6 sudah ditutup; ini fitur baru di luar `REL-01…REL-21` |

## Konteks

Pemilik meminta tipe soal `true_false` yang semula hanya satu pernyataan bisa memuat beberapa pernyataan Benar/Salah dalam satu soal. Contoh: satu ringkasan cerita di `stem`, lalu beberapa pernyataan yang dinilai satu per satu.

Keputusan pemilik:

1. Penilaian **all-correct**: soal hanya benar bila semua pernyataan berjawaban benar.
2. Mengubah tipe `true_false` yang sudah ada, bukan membuat tipe soal baru.
3. Laporan admin menampilkan jawaban, kunci, dan status per butir pernyataan.
4. Maksimal 5 pernyataan per soal.

Kondisi sebelum perubahan: `true_false` memakai `question_options` dan `answer_keys` seperti pilihan ganda, sehingga tidak ada tempat untuk kunci per butir maupun jawaban peserta per butir. Data produksi saat pengambilan keputusan: 0 soal dan 0 submission `true_false`; 186 esai, 182 pilihan ganda, dan 1 multi-jawaban.

## Keputusan

1. **Model data.** Migrasi `026_true_false_statements.sql` menambah:
   - `question_statements(id, question_id, position, statement_text, is_correct, explanation)` dengan `position` 1–5 dan `UNIQUE (question_id, position)`.
   - `submission_statement_answers(id, submission_id, statement_id, answer, is_correct)` dengan `UNIQUE (submission_id, statement_id)`.
   - Kolom `statement_count` dan `correct_statement_count` pada view `v_question_catalog`.
   - Object migrasi dimiliki oleh `bank_soal_user` agar konsisten dengan tabel lama; migration yang dijalankan sebagai `postgres` wajib mengubah owner/sequence/view di akhir skrip.
2. **Sumber teks.** `questions.stem` dan `questions.image_url` tetap menjadi cerita/konteks bersama. Setiap pernyataan disimpan di `question_statements.statement_text`.
3. **Kunci.** `true_false` tidak memakai `question_options`, `correct_key`, `correct_keys`, atau `answer_keys`. Field tersebut ditolak saat create/update. Endpoint `PUT /questions/{id}/answer-key` juga menolak `true_false`.
4. **Payload create/update.** Soal `true_false` memakai:
   ```json
   {
     "stem": "Ringkasan cerita",
     "question_type": "true_false",
     "statements": [
       { "text": "Pernyataan pertama", "is_correct": true, "explanation": "opsional" },
       { "text": "Pernyataan kedua", "is_correct": false }
     ]
   }
   ```
   `text`/`statement_text`, `position`, `is_correct`/`correct`, dan `explanation` diterima oleh normalizerBackend; UI mengirim `text` dan `is_correct`.
5. **Validasi.** Minimal 1 dan maksimal 5 pernyataan; semua teks wajib; minimal satu `is_correct=true`. Tipe lain tidak boleh mengirim `statements`. Perubahan ke `true_false` dari tipe lain wajib mengirim `statements`; perubahan keluar dari `true_false` menghapus statements.
6. **APIadmin.** `GET /questions/{id}` mengembalikan `statements` lengkap dengan `is_correct` dan `explanation`. `GET /tryout/questions` dan view katalog menyertakan jumlah pernyataan tanpa membocorkan kunci ke peserta.
7. **APIpeserta.** `GET /api/v1/presentation/questions/{id}` mengembalikan `statements: [{ id, position, text }]` tanpa `is_correct`. Submit memakai `answers: [{ statement_id, value: "true"|"false" }]`; booleans juga diterima oleh grader. Semua pernyataan harus dijawab.
8. **Penilaian.** `gradeStatements` membandingkan setiap jawaban dengan `is_correct`. Soal benar hanya bila semua detail benar. Rekap `tryout_submissions` tetap menyimpan satu baris per soal; detail per butir masuk `submission_statement_answers`. Nilai `answer` pada rekap berupa JSON ringkas `[{statement_id,value}]`.
9. **Laporan.** `GET /api/v1/reports/tryout` menambah `statement_details` pada tiap baris detail: `statement_id`, `statement`, `position`, `user_answer`, `correct_answer`, `is_correct`. `correct_answer` ringkas memakai daftar teks pernyataan yang benar, dipisahkan `; `, sebelum fallback ke kunci teks/opsi.
10. **UI.** CMS Buat Soal dan Detail/Edit Soal memakai repeater 1–5 pernyataan dengan radio Benar/Salah. Tryout-agent menampilkan satu fieldset per pernyataan dan mengirim `answers` array. Aset tryout di-bump ke `styles.css?v=13` dan `app.js?v=14`.
11. **Gate.** `REL-22` dibuat sebagai gate khusus fitur ini. Fase 6 dan `REL-01…REL-21` tidak dibuka ulang.

## Konsekuensi

- Import soal belum menerima `statements`; fitur ini hanya untuk input manual CMS dan API langsung.
- migration `026` harus tetap idempoten dan mengatur owner karena dijalankan oleh user `postgres` pada lingkungan produksi.
- Peserta tidak menerima umpan balik benar/salah saat submit; detail hanya tersedia di laporan admin.
- QA mencakup validasi negatif, all-or-nothing, kerahasiaan kunci, detail laporan, dan update soal existing.
- Backup `pre026` dibuat sebelum migrasi; rollback data tidak otomatis di luar penghapusan soal uji.

## Alternatif yang Dipertimbangkan

- **Tipe soal baru `true_false_multi`**: ditolak; pemilik ingin tipe existing diperluas.
- **Satu baris `questions` per pernyataan**: ditolak; konteks cerita akan duplikat dan skor per soal sulit dijaga.
- **Menyimpan jawaban per butir hanya di JSON `tryout_submissions.answer`**: ditolak; laporan butuh relasi dan constraint ke pernyataan.
- **penilaian sebagian benar**: ditolak; pemilik memilih all-correct.
