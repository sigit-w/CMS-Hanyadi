# Checklist — Validasi Data & Edge Case

| ID | Skenario | Hasil (pass/fail) | Bukti |
|---|---|---|---|
| D-01 | Kode mapel unik tepat 4 kapital; seed `MTKA`, `BIND`, `IPAS` | pass | MP-01..MP-06; migrasi `017` |
| D-02 | Stem kosong atau hanya spasi ditolak | | |
| D-03 | Upload soal tanpa sumber tetap memiliki `source_type = manual` | | |
| D-04 | Kunci jawaban minimal salah satu dari `correct_option_id` atau `answer_text` | | |
| D-05 | `correct_option_id` menunjuk opsi milik soal yang sama | | |
| D-06 | `question_options.is_correct` konsisten dengan `answer_keys.correct_option_id` | | |
| D-07 | Opsi dengan `option_key` ganda dalam satu soal ditolak | | |
| D-08 | Status soal hanya lima nilai yang diizinkan | | |
| D-09 | Soal `approved` tanpa kunci jawaban ditolak | | |
| D-10 | Readiness duplikat untuk versi sama tidak dibuat | | |
| D-11 | Nama file berisi karakter khusus disanitasi | | |
| D-12 | Metadata JSON tidak valid ditolak | | |
| D-13 | Constraint FK mencegah soal tanpa mapel | | |
| D-14 | Skema bisa dijalankan ulang tanpa error (`IF NOT EXISTS`, `ON CONFLICT`) | | |
