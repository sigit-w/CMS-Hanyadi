# Backlog Fase 3 — Per Agent

Prioritas: `P0` = wajib rilis, `P1` = penting, `P2` = penyiapan fase berikutnya.
Dependency mengacu ke ID task lain. Acceptance criteria (AC) menjadi dasar QA.

## PM Agent

| ID | Task | Prioritas | Dependency | Acceptance Criteria |
|---|---|---|---|---|
| PM-01 | Finalisasi backlog, prioritas, dan owner tiap task | P0 | - | Semua task Fase 3 punya ID, owner, prioritas, AC |
| PM-02 | Aktifkan status board dan format handoff harian | P0 | PM-01 | Status board terisi, template handoff dipakai minimal sekali |
| PM-03 | Review harian progres dan eskalasi blocker | P1 | PM-02 | Blocker tercatat dengan pemilik dan target resolusi |
| PM-04 | Jalankan release gate bersama QA | P0 | QA-06 | Laporan release gate disetujui PM dan QA |

## Backend Agent

| ID | Task | Prioritas | Dependency | Acceptance Criteria |
|---|---|---|---|---|
| BE-01 | Terapkan `db/schema.sql` ke `bank_soal_db` dan verifikasi seed mapel | P0 | - | 3 mapel wajib & 3 source type & 3 versi ada; view `v_question_catalog` bisa diquery |
| BE-02 | Inisialisasi proyek Node.js (Express, `pg` pool, `.env`, logging) | P0 | - | Server start di port lokal, pool maks 5, `/health` menjawab 200 |
| BE-03 | Implement CRUD soal + daftar mapel | P0 | BE-01, BE-02 | Semua endpoint soal/mapel sesuai kontrak, filter & pagination berfungsi |
| BE-04 | Validasi input dan upload file (MIME, ukuran, sanitasi) | P0 | BE-03 | File di atas 5MB/MIME salah ditolak; nama file disanitasi |
| BE-05 | Endpoint pengumpulan eksternal & pencatatan sumber | P1 | BE-03 | `external_collection` tersimpan lengkap dengan referensi & metadata |
| BE-06 | Kelola opsi jawaban dan kunci jawaban | P0 | BE-03 | Kunci sesuai opsi benar; konsistensi `is_correct` & `correct_option_id` terjaga |
| BE-07 | Endpoint penandaan kesiapan multi-versi | P1 | BE-03 | Readiness per `v1`/`v2`/`v3` tersimpan & flag ringkas ter-update |
| BE-08 | Finalisasi OpenAPI + error envelope standar | P1 | BE-03..BE-07 | Spesifikasi sesuai implementasi, kode error konsisten |
| BE-09 | Unit & integration test API | P0 | BE-03..BE-07 | Test lulus untuk happy path dan edge case validasi |

## Frontend Agent

| ID | Task | Prioritas | Dependency | Acceptance Criteria |
|---|---|---|---|---|
| FE-01 | Setup React + Vite + routing + API client | P0 | - | Aplikasi berjalan, base URL API dari `.env` |
| FE-02 | Layout dashboard CMS dan navigasi mapel | P0 | FE-01 | Menu mapel Matematika, Bahasa Indonesia, IPAS tersedia |
| FE-03 | Form input soal manual + opsi + kunci jawaban | P0 | BE-03, BE-06 | Soal bisa dibuat dan disimpan via UI |
| FE-04 | Upload file soal dan daftar sumber | P0 | BE-04 | Upload sukses/gagal ditampilkan, riwayat sumber tampil |
| FE-05 | Filter mapel, pencarian, dan pagination | P0 | BE-03 | Filter kombinasi menghasilkan daftar soal yang benar |
| FE-06 | UI penandaan kesiapan multi-versi | P1 | BE-07 | Validator bisa menandai `v1`/`v2`/`v3` per soal |
| FE-07 | State loading, empty, dan error handling | P0 | FE-03..FE-05 | Tidak ada layar kosong tanpa informasi; error API tampil jelas |
| FE-08 | Kerangka komponen presentasi multi-versi | P2 | FE-06 | Komponen placeholder siap dipakai Fase 4 |

## QA Agent

| ID | Task | Prioritas | Dependency | Acceptance Criteria |
|---|---|---|---|---|
| QA-01 | Finalisasi test plan dan checklist | P0 | PM-01 | Checklist fungsional, data, API, UI siap dipakai |
| QA-02 | Uji kontrak & validasi API | P0 | BE-09 | Semua endpoint diuji termasuk edge case & error code |
| QA-03 | Uji alur UI (input, upload, filter) | P0 | FE-05 | Skenario utama UI lulus tanpa bug P0/P1 |
| QA-04 | Validasi integritas data & schema | P0 | BE-01 | Mapel wajib, kunci jawaban, readiness sesuai aturan |
| QA-05 | Uji regresi ringan & beban kecil | P1 | QA-02, QA-03 | Tidak ada regresi; respons API stabil di resource 2GB |
| QA-06 | Susun laporan release gate | P0 | QA-02..QA-05 | Laporan berisi hasil, bug tersisa, rekomendasi rilis |

## Urutan Eksekusi Disarankan

1. `PM-01`, `BE-01`, `BE-02`, `FE-01`, `QA-01` (paralel)
2. `BE-03` -> kontrak API -> `FE-03`, `FE-04`, `FE-05`
3. `BE-04`, `BE-05`, `BE-06`, `BE-07`, `BE-08`, `BE-09`
4. `FE-06`, `FE-07`, `FE-08`
5. `QA-02`, `QA-03`, `QA-04`, `QA-05`, `QA-06`
6. `PM-02` berjalan sepanjang fase, `PM-04` di akhir
