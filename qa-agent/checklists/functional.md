# Checklist — Pengujian Fungsional

| ID | Skenario | Hasil (pass/fail) | Bukti |
|---|---|---|---|
| F-01 | Admin membuat soal Matematika manual dengan 4 opsi dan 1 kunci benar | | |
| F-02 | Admin membuat soal Bahasa Indonesia dengan tipe short_answer dan answer_text | | |
| F-03 | Admin membuat soal IPAS dengan tipe essay dan pembahasan | | |
| F-04 | Upload file soal valid berhasil dan tercatat sebagai `file_upload` | | |
| F-05 | Upload file melebihi 5MB ditolak dengan pesan jelas | | |
| F-06 | Upload MIME tidak diizinkan ditolak | | |
| F-07 | Pengumpulan eksternal tercatat dengan referensi & metadata | | |
| F-08 | Filter mapel menampilkan hanya soal mapel terpilih | | |
| F-09 | Filter kombinasi mapel + status (`approved`/`rejected`/`archived`) + pagination 20 benar | | |
| F-10 | Update soal mengubah `updated_at` lewat trigger | | |
| F-11 | Hapus/arsip soal mengubah status menjadi `archived` | | |
| F-12 | Soal baru (manual & import) otomatis tersimpan `approved`; `draft`/`review` ditolak | | |
| F-13 | Tidak ada pilihan/filter versi; field readiness tidak muncul di respons & UI | | |
| F-14 | View `v_question_catalog` menampilkan data terbaru | | |
| F-15 | Daftar soal CMS memakai pagination 20 dengan total dari `pagination.total` | | |
| F-16 | Stem di daftar CMS dan daftar/detail tryout non-bold (`font-weight: 400`) | | |
