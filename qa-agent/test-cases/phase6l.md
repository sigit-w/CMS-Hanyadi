# Test Case — Fase 6l (Lembar Soal)

| ID | Terkait | Prioritas | Langkah | Expected | Aktual | Status |
|---|---|---|---|---|---|---|
| TC-01 | BE-27/BE-28 / L-01 | P0 | `GET /question-sheets/generate-code?mapel=<code>` untuk `MTKA`, `IPAS`, `BIND`, dan dua mapel uji 4 kapital | Prefix = `mapels.code` apa adanya, kode 12 karakter `LS-<KODE>-mmyy`; tanpa mapel `400` | 5/5 kasus generator lolos | Pass |
| TC-02 | BE-27/BE-28 / L-02 | P0 | `POST /question-sheets` dengan `mapel_code` 4 kapital, kode kosong/diisi manual, dan `duration_minutes` 45/75 | `201`; kode kosong di-generate sesuai `mapels.code`; permission `question_sheets.manage` terpenuhi | Sesuai | Pass |
| TC-03 | BE-27 / L-03 | P0 | Kirim kode duplikat/short, `duration_minutes <= 0`, mapel kosong/tidak aktif, dan `mapel_code` tidak cocok dengan soal | `400 VALIDATION_ERROR`, tidak ada baris baru | Sesuai | Pass |
| TC-04 | BE-27 / L-04 | P0 | Buat soal dengan `sheet_code`, lalu `GET /questions` dan `GET /questions/:id` | Field `sheets` tampil di list/detail | Sesuai | Pass |
| TC-05 | BE-27 / L-05 | P0 | Ubah kode lembar soal, cek kembali flag soal | Flag mengikuti kode baru, relasi tetap satu lembar/mapel | Sesuai | Pass |
| TC-06 | BE-27 / L-06 | P1 | Role dengan `question_sheets.manage` tanpa `questions.read` memanggil `GET question-sheets/question-picker?mapel=<code>` | `200`, hanya soal mapel terpilih yang tampil | Sesuai | Pass |
| TC-07 | BE-27 / L-07 | P0 | `DELETE /question-sheets/:id`, cek DB dan detail soal | `archived=true`, `archived_at` terisi, relasi soal tidak hilang, tidak tampil di daftar aktif | Sesuai | Pass |
| TC-08 | BE-27 / L-08 | P1 | `GET /questions?page=5&limit=100` setelah skenario lembar soal | Respons `200`, pagination konsisten, tanpa error N+1/flag | Sesuai | Pass |
| TC-09 | FE-24/FE-25 | P0 | Build Vite dengan `NODE_OPTIONS=--max-old-space-size=256` | Build sukses; bundle mengandung `#/question-sheets`, generator per mapel, dan picker | Sukses, 1610 modul, 258,03 kB JS | Pass |
| TC-10 | FE-24/FE-25 | P0 | Buka menu **Manajemen Soal › Lembar Soal** di CMS | Halaman `#/question-sheets` termuat, daftar aktif/arsip tampil | Bundle hash `index-S-JiNOIO.js` terlayani | Pass |
| TC-11 | FE-24/FE-25 | P0 | Isi form berurutan: nama → pilih mapel → kode otomatis → ubah manual → durasi bebas | Kode 12 karakter dengan prefix `mapels.code`, kode bisa diubah, submit sukses | Bundle marker + L-01/L-02 | Pass |
| TC-12 | FE-24 | P1 | Sebelum mapel dipilih cek area soal; setelah dipilih klik baris soal | Area soal tersembunyi lalu terfilter mapel; klik baris membuka popup detail seperti Daftar Soal; tombol Pilih tetap bekerja | Bundle marker `Pilih mapel terlebih dahulu`, `Detail Soal`, `stopPropagation` | Pass |
| TC-13 | FE-24 / RBAC | P1 | Role tanpa `question_sheets.manage` mengakses halaman/API | Menu/API tidak memberi akses tulis; backend `403` | Ter-cover A-12/A-13/L-06 | Pass |
| TC-14 | QA-24 | P0 | Regresi penuh 13 file test serial, heap 128 MB | 0 fail, tanpa OOM | 126/126 pass, 0 fail | Pass |
| TC-15 | QA-24/QA-25 | P0 | Cek `free -h` sebelum/sesudah build dan regresi | Memori tersedia tidak habis, swap stabil | 557→503 MB (build), 558→345 MB (regresi final), swap 606 MiB stabil | Pass |
| TC-16 | BE-28 / MP-01..MP-06 | P0 | CRUD Kelola Mapel dengan kode 4 kapital, huruf kecil, duplikat, 3/5 karakter, dan non-alfanumerik | Huruf kecil dinormalisasi; duplikat `409`; di luar aturan `400`; kode unik 4 kapital diterima | 6/6 skenario MP lolos | Pass |
| TC-17 | BE-28 / L-01 | P0 | Generator untuk `MTKA/IPAS/BIND` dan dua mapel uji | `LS-<KODE>-mmyy` tepat 12 karakter; tidak ada `CUST`/`BING`/pemetaan nama | 5/5 kasus lolos | Pass |
| TC-18 | BE-28 / regresi | P0 | Verifikasi migrasi `017` dan filter/picker/tryout memakai kode baru | DB `MTKA/BIND/IPAS`; constraint `^[A-Z0-9]{4}$`; FK `mapel_id` konsisten | 3 mapel terverifikasi; 126/126 test lolos | Pass |
| TC-19 | QA-25 | P0 | Cleanup fixture dan health produksi | 0 mapel/user/role/lembar QA tersisa; API/CMS `200` | `qa%` = 0; `index-S-JiNOIO.js` terlayani | Pass |
| TC-20 | BE-29 / S-09a | P1 | `GET /questions?question_type=essay` dan `?mapel=IPAS&question_type=essay` | `200`, hanya essay; kombinasi mapel + tipe konsisten | Sesuai | Pass |
| TC-21 | BE-29 / S-09b | P1 | `GET /questions?question_type=invalid_type` | `400 VALIDATION_ERROR` | Sesuai | Pass |
| TC-22 | BE-29 / L-06a | P1 | Picker dengan `question_type=essay`, `multiple_choice`, dan nilai invalid | `200` untuk tipe valid; essay tampil, multiple_choice tidak; invalid `400 VALIDATION_ERROR` | Sesuai | Pass |
| TC-23 | FE-26/QA-26 | P1 | Build FE dan inspeksi bundle produksi | Dropdown `Semua tipe` hadir; filter Daftar Soal + picker Lembar Soal; regresi 129/129 | `index-BxuKDQvd.js` terlayani, marker `Semua tipe` ditemukan | Pass |

## Bug Log

| Bug ID | Task | Severity | Deskripsi | Reproduksi | Owner | Status |
|---|---|---|---|---|---|---|
| QA6L-ENV-01 | QA-24 | P2 | Test lama mengasumsikan username `admin`, permission tanpa `question_sheets.manage`, UI dilayani API, dan aset tryout `?v=9` | Regresi pertama 7 fail dari 126 | QA | Closed — test diselaraskan dengan konfigurasi QA dan kontrak Fase 6l |
| QA6L-ENV-02 | QA-24 | P1 | A-08 lama mencabut role admin terakhir dari user `admin` (id 1) | Run regresi pertama | QA | Closed — guard diubah; role admin dipulihkan |
| QA6L-ENV-03 | QA-24 | P2 | After-hook `phase6l.mjs` mengirim array cleanup sebagai beberapa parameter (`08P01`) | Run amendemen pertama: 8 test pass, hook fail | QA | Closed — `ANY($1::text[])` memakai satu parameter array; fixture terverifikasi 0 |
| QA6L-ENV-04 | QA-25 | P2 | Fixture `phase6j.mjs` masih memakai kode mapel `qa6j_<suffix}` sehingga 10 test gagal di `before` hook | Regresi D6 pertama: 116/126 pass | QA | Closed — fixture diubah ke kode 4 kapital `QDxx`; regresi ulang 126/126 |
| QA7-ENV-01 | QA-26 | P2 | Regresi D7 pertama dijalankan tanpa `QA_ADMIN_PASSWORD` di shell sehingga 125/129 test gagal di helper login | Run regresi D7 pertama: 4/129 pass | QA | Closed — ulang dengan `source backend-agent/.env` dan `QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD"`; 129/129 pass |
