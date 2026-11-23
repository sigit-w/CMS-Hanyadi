# Test Case — Fase 3

| ID | Terkait | Prioritas | Langkah | Expected | Aktual | Status |
|---|---|---|---|---|---|---|
| TC-01 | BE-01 | P0 | Jalankan schema.sql, cek mapels & source_types | 3 mapel, 3 tipe sumber, 3 versi | | |
| TC-02 | BE-02 | P0 | Start server, panggil /health | 200, DB up | | |
| TC-03 | BE-03 | P0 | GET /questions?mapel=MTKA&page=1&limit=10 | Hanya soal Matematika (`MTKA`), pagination benar | | |
| TC-04 | BE-04 | P0 | Upload file 6MB | 413, pesan jelas | | |
| TC-05 | BE-05 | P1 | POST /sources/external dengan referensi | Tersimpan dengan metadata | | |
| TC-06 | BE-06 | P0 | Simpan kunci jawaban dengan opsi benar "B" | `is_correct` dan `correct_option_id` = opsi B | | |
| TC-07 | BE-07 | P1 | Patch readiness v1 true, v2 false | Flag ringkas sesuai | | |
| TC-08 | BE-09 | P0 | Jalankan seluruh test API | Semua lulus | | |
| TC-09 | FE-03 | P0 | Buat soal lewat UI | Muncul di daftar soal | | |
| TC-10 | FE-04 | P0 | Upload file lewat UI | Riwayat sumber bertambah | | |
| TC-11 | FE-05 | P0 | Filter mapel + cari + pagination | Hasil sesuai | | |
| TC-12 | FE-06 | P1 | Tandai v1/v2/v3 lewat UI | Tersimpan setelah refresh | | |
| TC-13 | FE-07 | P0 | Submit form kosong | Validasi tampil, tidak ada request | | |
| TC-14 | QA-04 | P0 | Audit kunci jawaban seluruh soal approved | Semua memiliki kunci valid | | |
| TC-15 | QA-05 | P1 | Uji 20 request berturut-turut | Respons stabil, pool tidak habis | | |

## Bug Log

| Bug ID | Task | Severity | Deskripsi | Reproduksi | Owner | Status |
|---|---|---|---|---|---|---|
| | | | | | | |
