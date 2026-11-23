# Backlog — Fase 6l: Lembar Soal

| Field | Isi |
|---|---|
| Tanggal | 2026-11-23 |
| Pemilik | PM |
| Sumber | Permintaan pemilik proyek (8 poin) + klarifikasi lanjutan |
| Status | D1–D7 final: REL-12/REL-13/REL-14 **GO**. D7/PM-14 menambah filter **tipe soal** di Daftar Soal dan picker Lembar Soal; regresi 129/129, 0 bug P0/P1, bundle `index-BxuKDQvd.js` terdeploy. |
| Prioritas | P1 |

## Requirement Pemilik

1. Menambahkan halaman "Lembar Soal" di bawah menu Manajemen Soal di CMS.
2. Urutan pembuatan: (1) isi Nama Lembar Soal; (2) pilih mapel dari tabel `mapels`; (3) sistem generate kode memakai `mapels.code` yang sudah dibatasi 4 karakter — `LS-<KODE_MAPEL>-mmyy`, mis. kode `MTKA` → `LS-MTKA-1126`; (4) kode bisa diubah manual; (5) sebelum mapel dipilih, soal tidak ditampilkan; (6) soal ditampilkan/filter berdasarkan mapel terpilih dan klik baris soal membuka popup detail seperti Daftar Soal. Keterangan dan waktu pengerjaan tetap angka bebas (bukan preset). **12 karakter dihitung termasuk tanda hubung.**
3. User dapat mengedit data Lembar Soal.
4. Saat create lembar soal, user memilih beberapa soal dari satu mapel yang sama.
5. Satu lembar soal hanya bisa memiliki satu mapel.
6. Satu soal bisa dipakai di beberapa lembar soal; pada soal diberi flag lembar soal mana saja yang memakainya (bisa memakai kode lembar soal).
7. Akses penuh ke seluruh file di `/opt/virtual-office-bank-soal`; tidak perlu meminta ijin akses lagi.
8. Perhatikan penggunaan memori agar tidak OOM.
9. **Amendemen 2026-11-23:** pada Kelola Mapel, field `code` dibatasi hanya 4 karakter alfanumerik kapital, unik, dan kode inilah yang dipakai langsung untuk generate kode lembar soal. Tidak boleh ada pemetaan prefix berdasarkan nama mapel atau fallback `CUST`.
10. **Permintaan baru 2026-11-23 (PM-14/D7):** tambahkan filter tipe soal pada halaman **Daftar Soal** dan pada pemilih soal di halaman **Lembar Soal**. Filter memakai nilai `question_type` yang sudah ada dan tetap bisa digabung dengan filter mapel/status/kata kunci.

## Evaluasi PM

- Perubahan menyentuh schema database, API backend, UI CMS, QA, dan dokumentasi. Tidak ada perubahan yang diminta pada layanan presentation/tryout.
- Poin 7 dan 8 adalah batasan operasional, bukan fitur UI: tanpa service baru, migrasi lewat `psql`, build frontend dengan heap dibatasi, deploy bertahap.
- Seluruh pertanyaan terbuka sudah dijawab lewat D1–D5 (termasuk Q3: waktu pengerjaan berupa angka bebas, bukan preset); ADR-005 sudah ditulis dan diterima sebagai dasar handoff.
- Keputusan turunan yang dituangkan di ADR-005 (amendemen urutan create 2026-11-23): mapel dipilih lebih dulu dari tabel `mapels`, lalu generator mengisi kode; backend memvalidasi mapel terpilih sama dengan mapel seluruh soal; kode hasil edit hanya wajib memenuhi D1 (tepat 12 karakter, huruf/angka/tanda hubung, unik); benturan kode generator diselesaikan manual; picker tidak dirender sebelum mapel dipilih dan klik baris soal membuka popup detail seperti Daftar Soal.
- Amendemen kode mapel 2026-11-23 mengganti aturan prefix: `mapels.code` wajib tepat 4 karakter dan dipakai langsung sebagai prefix `LS-<CODE>-mmyy`; aturan lama berbasis nama mapel/fallback `CUST` tidak dipakai lagi. Pemilik mengonfirmasi migrasi `MTKA/BIND/IPAS`; referensi DB memakai FK `mapel_id`, jadi tidak ada update baris referensi.
- Status "sudah dipakai" (D2) bergantung pada relasi tryout–lembar soal yang belum ada di Fase 6l; sampai relasi itu dibuat, semua lembar soal berstatus belum dipakai dan kode selalu bisa diubah.
- D7 hanya menambah dimensi filter `question_type` pada `GET /questions` dan `GET /question-sheets/question-picker`; tidak mengubah penyimpanan soal, relasi lembar, atau aturan D1–D6.

## Keputusan & Definisi

| ID | Keputusan | Sumber |
|---|---|---|
| D1 | Kode Lembar Soal berpanjang tepat 12 karakter total, tanda hubung ikut dihitung; contoh `LS-IPAS-1126` valid. | Pemilik |
| D2 | Kode wajib unik. **Belum dipakai** = belum ada sesi/submission tryout yang mereferensikan lembar soal; kode boleh diubah dan flag kode pada seluruh soal terkait ikut diperbarui dalam satu transaksi. **Sudah dipakai** = minimal ada satu sesi tryout/submission yang mereferensikan lembar soal; kode dikunci (read-only), perubahan kode dilakukan dengan mengarsipkan lembar lama lalu membuat lembar baru. | PM (definisi diminta pemilik) |
| D3 | Waktu pengerjaan berupa **angka bebas** yang diinput langsung oleh user (bukan preset 60/90/120 dan bukan dropdown), disimpan sebagai integer menit; wajib bilangan bulat positif. Perubahan rentang tidak memerlukan perubahan migrasi. | Pemilik (klarifikasi lanjutan) |
| D4 | Permission RBAC baru `question_sheets.manage` ("Buat, ubah, dan arsipkan lembar soal") didaftarkan di migrasi `016_lembar_soal.sql`, otomatis tampil sebagai checkbox di Kelola Role lewat `GET /permissions`, dan diberikan ke role `admin` serta `editor`. Admin dapat membuat role baru dan memberi permission ini. Picker soal memakai endpoint yang dilindungi permission ini agar role dengan permission ini saja tetap bisa memilih soal. | PM (definisi diminta pemilik) |
| D5 | Hapus = soft delete: set `archived = true` dan `archived_at`; baris serta relasi soal–lembar tetap di database. Daftar default menyembunyikan arsip, filter `status=archived` menampilkannya; flag soal hanya menampilkan kode lembar aktif; lembar arsip tidak bisa dipilih tryout. Tidak ada hard delete dan tidak ada aksi pulihkan di Fase 6l. | Pemilik + PM |
| D6 | **Kode mapel tepat 4 karakter** alfanumerik kapital (`^[A-Z0-9]{4}$`), unik, diinput di Kelola Mapel, dan dipakai langsung sebagai prefix generator lembar soal `LS-<KODE_MAPEL>-mmyy`. Tidak ada pemetaan berdasarkan nama mapel atau fallback `CUST`; kode mapel existing sudah dimigrasikan ke `MTKA/BIND/IPAS` lewat `017_mapel_code_4_char.sql`. | Pemilik (amendemen 2026-11-23) |
| D7 | Filter **tipe soal** tersedia di Daftar Soal dan picker Lembar Soal; nilai yang didukung = `multiple_choice`, `true_false`, `multiple_answer`, `short_answer`, `essay`; pilihan kosong = semua tipe; filter dapat digabung dengan filter lain dan divalidasi backend. | Pemilik (permintaan 2026-11-23) |

## Status Pertanyaan

| # | Pertanyaan | Hasil |
|---|---|---|
| Q1 | Cara menghitung 12 digit kode | Dijawab (D1) |
| Q2 | Unik dan batas ubah kode "setelah dipakai" | Dijawab (D2) |
| Q3 | Bentuk input Waktu pengerjaan | Dijawab (D3): angka bebas, bukan preset 60/90/120 |
| Q4 | Permission RBAC dan role baru | Dijawab (D4) |
| Q5 | Hapus lembar soal dan efek ke flag soal | Dijawab (D5) |

## Acceptance Criteria (draft)

- [x] Migrasi `016_lembar_soal.sql` membuat tabel lembar soal dan relasi banyak-ke-banyak soal–lembar, serta mendaftarkan permission `question_sheets.manage`; `schema.sql` dan `db/README.md` diperbarui.
- [x] Halaman "Lembar Soal" tampil di bawah menu Manajemen Soal dengan form create/edit dan daftar lembar soal, dilindungi `question_sheets.manage` (D4).
- [x] Form urut: nama → pilih mapel dari `mapels` → kode auto-generate memakai `mapels.code` 4 karakter (`LS-<KODE_MAPEL>-mmyy`) dapat diubah manual, unik, tepat 12 karakter → keterangan dan waktu pengerjaan angka bebas (integer menit positif).
- [x] **Amendemen D6:** Kelola Mapel membatasi `code` tepat 4 karakter alfanumerik kapital dan unik; generator Lembar Soal memakai kode tersebut langsung tanpa pemetaan nama/fallback; data mapel existing dimigrasikan ke `MTKA/BIND/IPAS`.
- [x] Edit kode hanya saat lembar belum dipakai (D2); perubahan kode menyebabkan flag kode pada seluruh soal terkait ikut berubah dalam satu transaksi.
- [x] Picker soal tersembunyi sebelum mapel dipilih; setelah itu difilter berdasarkan mapel; klik baris membuka popup detail seperti Daftar Soal; create mewajibkan minimal satu soal dari mapel terpilih; lembar menyimpan tepat satu `mapel_id`.
- [x] Edit data lembar soal beserta daftar soalnya tersimpan melalui endpoint transaksional.
- [x] Aksi hapus melakukan soft delete `archived` (D5); arsip tersembunyi di daftar default, dapat difilter, dan tidak muncul di flag soal.
- [x] Daftar soal menampilkan flag/kode seluruh lembar aktif yang memakai soal tersebut, termasuk soal yang dipakai berulang.
- [x] Checkbox `question_sheets.manage` tampil di Kelola Role, admin dan editor memiliki permission itu, dan admin dapat membuat role baru dengan permission tersebut (D4).
- [x] OpenAPI, test case, laporan QA, status board, dan laporan sistem diperbarui; regresi 126/126 + 0 bug P0/P1.
- [x] Build dan deploy hemat memori (tanpa service baru, heap dibatasi), tidak ada OOM; release gate `REL-12` **GO** untuk implementasi awal dan `REL-13` **GO** untuk D6.
- [x] **D7:** Daftar Soal dan picker Lembar Soal memiliki dropdown filter tipe soal; backend menerima `question_type` pada `GET /questions` dan `GET /question-sheets/question-picker`, menolak nilai di luar daftar, dan regresi 129/129 dengan 0 bug P0/P1.

## Serah Terima (final)

| Task ID | Owner | Prioritas | Dependency | Status |
|---|---|---|---|---|
| PM-11 | PM | P1 | - | done (requirement dicatat) |
| PM-12 | PM | P1 | PM-11 | done (ADR-005 accepted) |
| PM-13 | PM | P1 | PM-12 | done — amendemen D6 dicatat; pemilik mengonfirmasi migrasi `MTKA/BIND/IPAS` |
| BE-27 | Backend | P1 | ADR-005 | done — `tasks/handoff-BE27.md`, migrasi `016`, API aktif |
| FE-24 | Frontend | P1 | BE-27 | done — `tasks/handoff-FE24.md`, build & deploy sukses |
| QA-24 | QA | P1 | BE-27, FE-24 | done — `tasks/handoff-QA24.md`, 126/126 test lolos |
| DOC-06L | PM/Docs | P1 | BE-27, FE-24, QA-24 | done — dokumen/OpenAPI/status board diperbarui |
| REL-12 | PM | P1 | QA-24 | done — **GO** 2026-11-23 untuk implementasi awal |
| BE-28 | Backend | P1 | PM-13 | done — migrasi `017`, validator/generator/filter 4 kapital, OpenAPI/DB docs |
| FE-25 | Frontend | P1 | BE-28 | done — form mapel 4 kapital, label/default diselaraskan, build `index-S-JiNOIO.js` |
| QA-25 | QA | P1 | BE-28, FE-25 | done — fixture 4 kapital, regresi 126/126, 0 bug P0/P1 |
| REL-13 | PM | P1 | QA-25 | done — **GO** 2026-11-23 untuk amendemen D6 |
| PM-14 | PM | P1 | PM-13 | done — D7 (filter tipe soal) dicatat |
| BE-29 | Backend | P1 | PM-14 | done — `question_type` filter di daftar soal & picker, divalidasi backend |
| FE-26 | Frontend | P1 | BE-29 | done — dropdown filter tipe soal di dua halaman, label tipe soal, build `index-BxuKDQvd.js` |
| QA-26 | QA | P1 | BE-29, FE-26 | done — 3 skenario D7, regresi 129/129, 0 bug P0/P1 |
| REL-14 | PM | P1 | QA-26 | done — **GO** 2026-11-23 untuk D7 |

## Handoff Diterbitkan

- `pm-agent/decisions/ADR-005-lembar-soal.md` — dasar keputusan, status `accepted`.
- `pm-agent/tasks/handoff-BE27.md` — migrasi `016`, API, RBAC, flag soal.
- `pm-agent/tasks/handoff-FE24.md` — menu/form/picker/daftar dan flag di CMS.
- `pm-agent/tasks/handoff-QA24.md` — review ADR, regresi + skenario baru, gate `REL-12`.
- Amendemen D6 (kode mapel 4 karakter) sudah tercatat di ADR-005 dan handoff BE-27/FE-24/QA-24, lalu diimplementasikan lewat BE-28/FE-25/QA-25 dengan gate terpisah `REL-13`; `REL-12` tetap GO untuk implementasi awal.
- Amendemen D7 (filter tipe soal) dicatat di backlog ini dan status board, lalu diimplementasikan lewat BE-29/FE-26/QA-26 dengan gate terpisah `REL-14`; `REL-12`/`REL-13` tetap GO.
- Batasan memori berlaku untuk semua handoff: cek `free -h` sebelum/sesudah, test `NODE_OPTIONS=--max-old-space-size=128`, build frontend `256`, tanpa service baru dan tanpa job berat paralel.
