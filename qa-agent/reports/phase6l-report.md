# Laporan QA Fase 6l — Lembar Soal

| Field | Isi |
|---|---|
| Tanggal | 2026-11-23 |
| Task | QA-24/QA-25/QA-26 / REL-12 + REL-13 + REL-14 |
| Desain | ADR-005 (accepted) |
| Lingkungan | API produksi `127.0.0.1:8082`, CMS `https://cms.hanyadi.web.id`, DB produksi |
| Hasil | **129 test, 129 pass, 0 fail** (126 baseline + 3 skenario D7) |
| Bug P0/P1 aplikasi | 0 |
| Rekomendasi | Lihat `qa-agent/reports/phase6l-release-gate.md` |

## Review ADR-005

Hasil review: **disetujui QA tanpa blocker**.

- D1 kode tepat 12 karakter dengan generator `LS-<KODE_MAPEL>-mmyy` dari `mapels.code` 4 kapital (`MTKA/IPAS/BIND` dan mapel uji); unik dan tetap bisa diubah manual sesuai amendemen D6 ADR-005 2026-11-23.
- D2 kode dapat diubah sebelum dipakai; pengecekan “dipakai tryout” sementara selalu `false` karena relasi tryout–lembar belum dirancang. Ini sudah menjadi catatan rilis, bukan bug.
- D3 `duration_minutes` adalah angka bebas, sesuai keputusan pemilik proyek 2026-11-23.
- D4 `question_sheets.manage` diberikan ke `admin` dan `editor`; picker sengaja tidak bergantung pada `questions.read`.
- D5 soft delete `archived=true` + `archived_at` menjaga relasi soal–lembar tetap ada.
- Strategi memori (test 128 MB, build Vite 256 MB, serial) sesuai keterbatasan ~2 GB RAM.

## Lingkungan & Eksekusi

- Migrasi `db/migrations/016_lembar_soal.sql` sudah diterapkan sebelum QA; verifikasi objek DB `2|1|2`. Migrasi D6 `017_mapel_code_4_char.sql` juga sudah diterapkan: `MTKA/BIND/IPAS`, constraint `^[A-Z0-9]{4}$`.
- `bank-soal-api.service` sudah di-restart; `/health` `200` DB up.
- Build FE sudah di-deploy ke `frontend-agent/dist` yang disajikan nginx CMS (root vhost `cms.hanyadi.web.id`).
- Build FE:

  `NODE_OPTIONS=--max-old-space-size=256 npm run build` → sukses, 1610 modul, `index-S-JiNOIO.js` 258,03 kB (gzip 75,16 kB), 3,80 s. CMS menyajikan hash ini dari `frontend-agent/dist`.

- Regresi penuh (urutan serial, password tidak dicatat):

  `set -a; source backend-agent/.env; set +a; QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD" QA_UI_BASE=https://cms.hanyadi.web.id NODE_OPTIONS=--max-old-space-size=128 npm test -- --test-concurrency=1`

- QA memakai kredensial bootstrap dari `backend-agent/.env` (password sudah diselaraskan dengan permintaan pemilik proyek). Tidak ada akun admin QA sementara; `qa6l_admin_7e93c9ef` dan `/tmp/opencode/qa6l-admin.env` sudah dihapus. Login admin produksi terverifikasi `200 roles=["admin"]`.
- Setelah D6, verifikasi DB: `qa%` mapel = 0, user/role `qa6l%|qa6j%|qa_mapel%` = 0, lembar QA = 0; hanya 3 mapel produksi `MTKA/BIND/IPAS` yang tersisa.

## Detail Test

| Grup | Jumlah | Hasil |
|---|---:|---|
| Auth/RBAC A-01..A-17 | 17 | pass |
| Mapel MP-01..MP-06 | 6 | pass |
| Multi-jawaban MA-01..MA-02 | 2 | pass |
| Edge S-20..S-34 | 15 | pass |
| Smoke S-01..S-19 | 19 | pass |
| Peserta P-01..P-09 | 9 | pass |
| Fase 5 P5-01..P5-14 | 14 | pass |
| Fase 6j J-01..J-10 | 10 | pass |
| **Fase 6l L-01..L-08 (baru)** | **8** | **pass** |
| Manajemen soal M-01..M-03 | 3 | pass |
| Laporan tryout TR-01..TR-06 | 6 | pass |
| Tryout T-01..T-08 | 8 | pass |
| Upload & grading U-01..U-09 | 9 | pass |
| **Total** | **126** | **126 pass, 0 fail** |

## Skenario Baru (L-01..L-08)

1. **L-01** permission `question_sheets.manage` dan generator langsung dari `mapels.code`: `MTKA`/`IPAS`/`BIND` serta dua mapel uji 4 kapital, 12 karakter; tanpa `?mapel=` ditolak `400`.
2. **L-02** create lembar soal memakai `mapel_code`; kode kosong di-generate sesuai mapel dan `duration_minutes=75` (angka bebas) → `201`.
3. **L-03** kode dup/short, durasi `0`, mapel kosong/tidak aktif, dan `mapel_code` tidak cocok dengan soal ditolak `400`.
4. **L-04** `sheets` tampil di list dan detail soal setelah lembar dipakai.
5. **L-05** ubah kode → flag soal ikut berubah, relasi tetap satu lembar per mapel.
6. **L-06** role dengan `question_sheets.manage` tanpa `questions.read` tetap bisa memakai picker, yang hanya mengembalikan soal mapel terpilih.
7. **L-07** hapus lembar → soft delete, `archived_at` terisi, relasi soal tidak hilang.
8. **L-08** pagination besar tetap `200` dan konsisten.

Verifikasi FE tambahan: bundle produksi `index-S-JiNOIO.js` mengandung marker urutan form (`1. Nama Lembar Soal`, `2. Mapel`, `3. Kode Lembar Soal`), pesan `Pilih mapel terlebih dahulu untuk menampilkan soal.`, `Detail Soal`, `question-sheets/generate-code` dengan query `mapel`, dan `question-sheets/question-picker`. QA tidak menjalankan browser automation; validasi UI dilakukan melalui build + inspeksi bundle + API test yang sesuai.

## Resource & Memori

| Metrik | Nilai |
|---|---|
| Available memory sebelum build FE | 557 MB |
| Available memory sesudah build FE | 503 MB |
| Available memory sebelum regresi akhir | 558 MB |
| Available memory sesudah regresi akhir | 345 MB |
| Swap free sebelum → sesudah regresi | 606 MiB → 606 MiB |
| Durasi regresi | 9,5 detik |
| OOM / restart tak sengaja | Tidak ada |

Regresi awal Fase 6l menemukan 7 failure akibat test harness stale, bukan bug aplikasi. Perbaikan test: `QA_ADMIN_USERNAME` dipakai oleh A-03/A-04/A-05/A-06; A-08 hanya menguji guard saat tepat satu admin aktif; A-12 memasukkan `question_sheets.manage`; S-17 membaca `QA_UI_BASE`; T-01 menerima versi aset tryout apa pun. Setelah amendemen alur create, after-hook `phase6l.mjs` sempat gagal karena parameter cleanup salah (`bind message supplies 4 parameters...`); cleanup sudah diperbaiki menjadi satu parameter array dan fixture sementara dibersihkan. Regresi D6 pertama menemukan 10 failure di `phase6j.mjs` karena fixture `qa6j_<suffix>` melanggar aturan 4 kapital; fixture diubah ke `QDxx`, lalu regresi akhir 126/126 pass.

## Temuan

- **QA6L-ENV-01 — P2, closed.** Test lama mengasumsikan username `admin`, permission tanpa `question_sheets.manage`, UI dilayani API, dan aset tryout `?v=9`. Semua sudah diselaraskan; tidak ada perubahan kode aplikasi yang diperlukan.
- **QA6L-ENV-02 — P1, closed.** Run regresi pertama mencabut role `admin` dari user `admin` (id 1) karena A-08 mengasumsikan user 1 adalah satu-satunya admin. A-08 sudah diubah untuk menguji guard hanya saat tepat satu admin aktif; role/password admin dipulihkan lewat seed bootstrap dan login terverifikasi. Tidak ada data aplikasi lain yang terpengaruh.
- **QA6L-ENV-03 — P2, closed.** After-hook `phase6l.mjs` mengirim array cleanup sebagai beberapa parameter sehingga PostgreSQL menolak `08P01`; 8 skenario L tetap pass. Query diubah menjadi `ANY($1::text[])` dengan satu parameter array, lalu fixture sementara diverifikasi 0 baris.
- **QA6L-ENV-04 — P2, closed.** Regresi D6 pertama 116/126 karena `phase6j.mjs` membuat mapel uji dengan kode `qa6j_<suffix>` yang ditolak validator 4 kapital. Fixture diubah menjadi `QDxx`; regresi ulang 126/126 dan 0 bug aplikasi.
- **Catatan rilis D2.** `used_by_tryout` selalu `false` sampai ada relasi tryout–lembar di fase berikutnya. Tidak blocker karena sesuai ADR-005.
- Tidak ada bug P0/P1 pada kode aplikasi yang ditemukan selama regresi.

## Kesimpulan

Seluruh 126 test lolos, termasuk 8 skenario Fase 6l dan amendemen D6 generator per kode mapel. Build CMS sukses (`index-S-JiNOIO.js`) dan marker UI hadir di bundle produksi. Gate `REL-12` tetap **GO** untuk implementasi awal; gate `REL-13` untuk D6 juga **GO** (lihat `phase6l-release-gate.md`).

## Amendemen D7 / QA-26 — Filter Tipe Soal — 2026-11-23

| Field | Isi |
|---|---|
| Lingkup | `question_type` filter di `GET /questions` dan `GET /question-sheets/question-picker`; dropdown di Daftar Soal dan picker Lembar Soal |
| Build FE | `NODE_OPTIONS=--max-old-space-size=256 npm run build` → sukses, 1610 modul, `index-BxuKDQvd.js` 259,23 kB (gzip 75,40 kB), 3,85 s |
| Regresi akhir | `129 test, 129 pass, 0 fail`, 9,95 s, serial, heap 128 MB |
| Bug P0/P1 aplikasi | 0 |
| Marker produksi | CMS `https://cms.hanyadi.web.id` menyajikan `index-BxuKDQvd.js`; bundle mengandung `Semua tipe`; API `/health` `200` DB up |

Skenario baru:

1. **S-09a** `GET /questions?question_type=essay` mengembalikan hanya essay; kombinasi `mapel=IPAS&question_type=essay` tetap konsisten dan menyertakan soal uji.
2. **S-09b** `question_type=invalid_type` ditolak `400 VALIDATION_ERROR`.
3. **L-06a** picker dengan `question_type=essay` menyertakan soal uji dan hanya essay; `multiple_choice` tidak menyertakannya; nilai invalid ditolak `400 VALIDATION_ERROR`.

Regresi D7 pertama menghasilkan 4/129 pass karena variabel QA belum diekspor di shell (`QA_ADMIN_PASSWORD` kosong), bukan bug aplikasi. Ulang dengan prosedur `source backend-agent/.env` + `QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD"` menghasilkan 129/129 pass. Memori tersisa setelah build/regresi ≈ 528 MB, swap stabil, tanpa OOM. Gate `REL-14` **GO**; `REL-12`/`REL-13` tidak berubah.
