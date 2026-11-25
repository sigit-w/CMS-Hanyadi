# Backlog — Fase 6aa: Jenjang Pendidikan di Soal, Lembar, Tryout, & Program Belajar

| Field | Isi |
|---|---|
| Fase | Fase 6aa |
| Gate | `REL-33` |
| Tanggal | 2026-11-25 |
| ADR | `ADR-023` |
| Status | done — implementasi BE/FE/TRY/QA/DOC selesai; regresi 216/216; `REL-33` GO |
| Pemilik | PM |
| Melanjutkan | Fase 6z / `REL-32` GO 2026-11-25; rollback `REL-32`; `REL-01…REL-32` tidak dibuka ulang; Fase 7 tetap dibatalkan |

## Konteks / Masukan Pemilik

Pemilik meminta perubahan menyeluruh berikut:

1. Tambahkan inputan jenjang pendidikan di halaman Buat Soal; skema import data dan file template import juga diubah.
2. Tambahkan filter jenjang pendidikan di halaman Daftar Soal dan pada bagian Daftar Soal di halaman Buat Soal.
3. Flow Lembar Soal menjadi: isi nama → pilih jenjang → pilih mapel → kode otomatis `LS-[kode mapel]-[kode jenjang]-[mmyy]` → isi waktu → isi keterangan → pilih soal sesuai jenjang dan mapel.
4. Daftar Lembar Soal menampilkan jenjang pendidikan.
5. Flow Buat Tryout menjadi: isi nama → pilih jenjang → slug otomatis → pilih tanggal/jam mulai → pilih tanggal/jam selesai → mengikuti aturan dan flow existing.
6. Daftar Tryout membuang kolom jumlah soal dan menggantinya dengan kolom jenjang pendidikan.
7. Kelola Program Belajar menambahkan inputan pilihan jenjang saat membuat program.

Pemeriksaan awal 2026-11-25:

- Master jenjang `SD`/`SMP`/`SMA` dan `GET /api/v1/jenjangs` sudah tersedia dari migrasi `031` (`db/migrations/031_jenjang_dan_kredensial_peserta.sql:14-22`, `backend-agent/src/mapelRoutes.js:138-213`); frontend sudah memakainya untuk siswa, prospektus, peserta tryout, dan laporan.
- `questions`, `question_sheets`, `tryout_events`, dan `program_belajar` belum memiliki `jenjang_id`; generator kode lembar masih `LS-${mapel}-${mmyy}` di `backend-agent/src/questionSheetRoutes.js:24-29`.
- Slug tryout sudah auto di backend (`backend-agent/src/auth.js:17-35`, `backend-agent/src/tryoutRoutes.js:745-759`), tetapi form `frontend-agent/src/pages/TryoutManagement.jsx` masih menampilkan input slug manual.
- Daftar Tryout di `frontend-agent/src/pages/TryoutManagement.jsx:1070-1109` masih memakai header `Soal` dan sel `question_count`.
- Template import `frontend-agent/public/templates/template-soal.csv` dan `template-soal.xlsx` belum memiliki kolom `jenjang`; validator ada di `backend-agent/src/importer.js`.
- Marker QA yang terdampak: `qa-agent/tests/phase6l.mjs`, `phase6x.mjs`, `phase6u.mjs`, `phase6o.mjs`, `phase6z.mjs`, `phase6w.mjs`, dan `nav-bimbel.mjs`.

Keputusan lengkap ada di `pm-agent/decisions/ADR-023-jenjang-pendidikan-soal-lembar-tryout-program.md`.

## Requirement

| ID | Requirement | PM | Status | Gate | ADR |
|---|---|---|---|---|---|
| R1 | Migrasi `034` menambahkan FK `jenjang_id` ke soal, lembar soal, tryout, dan program belajar; data lama di-backfill `SD`; constraint kode lembar diperbarui | PM-31 | done | REL-33 | ADR-023 |
| R2 | Buat Soal menyediakan input jenjang; API soal menerima/mengembalikan jenjang; filter jenjang tersedia di Daftar Soal dan bagian Daftar Soal di Buat Soal | PM-31 | done | REL-33 | ADR-023 |
| R3 | Skema import CSV/XLSX dan kedua file template menyertakan kolom `jenjang` dengan nilai `SD`/`SMP`/`SMA` dan contoh valid | PM-31 | done | REL-33 | ADR-023 |
| R4 | Lembar Soal memakai urutan nama → jenjang → mapel → kode otomatis `LS-[mapel]-[jenjang]-[mmyy]` → waktu → keterangan → picker soal; Daftar Lembar Soal menampilkan jenjang | PM-31 | done | REL-33 | ADR-023 |
| R5 | Buat Tryout memakai urutan nama → jenjang → slug auto → mulai → selesai → aturan existing; lembar wajib searah jenjang tryout | PM-31 | done | REL-33 | ADR-023 |
| R6 | Daftar Tryout mengganti kolom `Soal` dengan `Jenjang` tanpa mengubah status filter, tombol salin URL, dan kolom lain | PM-31 | done | REL-33 | ADR-023 |
| R7 | Kelola Program Belajar menambahkan pilihan jenjang pada form create/update dan kolom jenjang pada tabel | PM-31 | done | REL-33 | ADR-023 |
| R8 | OpenAPI, README backend/DB, laporan sistem, marker QA, regresi penuh, dan backup pra-rilis tersinkron sebelum `REL-33` GO | PM-31 | done | REL-33 | ADR-023 |

## Keputusan

| ID | Keputusan | Status |
|---|---|---|
| D1 | Fase 6aa / `REL-33`; rollback `REL-32`; gate lama tidak dibuka ulang; Fase 7 tetap dibatalkan | final |
| D2 | Pakai master jenjang existing `SD`/`SMP`/`SMA`; tidak membuat seed baru; backfill data lama ke `SD` | final |
| D3 | Jenjang wajib pada soal dan import; kolom `jenjang` disisipkan setelah `mapel` di CSV/XLSX | final |
| D4 | Kode lembar `LS-${mapel}-${jenjang}-${mmyy}`, mmyy tetap UTC; picker difilter jenjang + mapel | final |
| D5 | Slug tryout tetap auto dari backend; input manual slug dihapus dari UI | final |
| D6 | Kolom `Soal` di Daftar Tryout diganti `Jenjang`; `question_count` boleh tetap di API tetapi tidak tampil | final |
| D7 | Tidak mengubah login peserta, URL sesi, format laporan, kredensial, dan gate `REL-24…REL-32` | final |

## Acceptance Criteria

- **AC1 (R1):** Migrasi `034` terpasang, `jenjang_id` tidak null pada keempat tabel, index terbentuk, panjang/constraint `code` lembar mendukung `LS-MTKA-SD-1126`, dan `v_question_catalog` mengekspos `jenjang_kode`/`jenjang_nama`.
- **AC2 (R2):** Form Buat Soal memiliki select Jenjang sebelum Mapel; `POST /questions`, `PUT /questions/:id`, `GET /questions?jenjang=SD` berfungsi; filter jenjang tampil di Dashboard dan bagian Daftar Soal pada halaman Buat Soal.
- **AC3 (R3):** Template CSV dan XLSX memiliki 19 header dengan `jenjang` setelah `mapel`, contoh baris memakai `SD`/`SMP`/`SMA`, dan keduanya lolos import tanpa diedit. Header tanpa `jenjang` ditolak dengan pesan `VALIDATION_ERROR` yang jelas.
- **AC4 (R4):** Kode lembar tidak aktif sebelum jenjang dan mapel dipilih, berubah otomatis saat keduanya berubah, mengikuti regex `^LS-[A-Z0-9]{4}-(SD|SMP|SMA)-[0-9]{4}$`, dan picker hanya menampilkan soal dengan jenjang + mapel yang sama. Daftar Lembar Soal menampilkan kolom Jenjang.
- **AC5 (R5):** Form Buat Tryout tidak lagi memiliki input slug manual; slug otomatis muncul setelah nama diisi; jenjang wajib dipilih sebelum jadwal; lembar soal yang jenjangnya berbeda ditolak UI dan API.
- **AC6 (R6):** Header Daftar Tryout persis berisi `Jenjang` menggantikan `Soal`, sel menampilkan kode/nama jenjang, dan status filter plus tombol copy ikon hasil revisi sebelumnya tetap berfungsi.
- **AC7 (R7):** Form dan tabel Program Belajar menampilkan jenjang; create/update tanpa jenjang ditolak; data lama tetap terbaca setelah backfill.
- **AC8 (R8):** Skenario QA baru `Q6AA-01…Q6AA-08` lolos, regresi penuh 216/216 (0 fail, tidak lebih rendah dari baseline 206), `git diff --check` dan build frontend lolos, OpenAPI/README/ADR/backlog/status board sinkron, serta backup pra-`REL-33` tersedia.

## Breakdown Task

| ID | Agent | Deskripsi | AC | Gate | Status | ADR |
|---|---|---|---|---|---|---|
| PM-31 | PM | ADR-023, backlog Fase 6aa, status board, README, dan handoff ke BE/FE/TRY/QA/DOC | R1–R8 | REL-33 | done | ADR-023 |
| BE-46 | Backend | Migrasi `034`, API soal/filter, importer, lembar soal + generator kode, tryout, program belajar, OpenAPI | AC1, AC2, AC3, AC4, AC5, AC7, AC8 | REL-33 | done | ADR-023 |
| FE-43 | Frontend | Form/filter soal, template link, flow Lembar Soal, flow Tryout + tabel, Program Belajar | AC2, AC3, AC4, AC5, AC6, AC7, AC8 | REL-33 | done | ADR-023 |
| TRY-23 | Tryout | Verifikasi non-regresi login, URL sesi, submit, dan pemakaian lembar berjenjang | AC8 | REL-33 | done | ADR-023 |
| QA-43 | QA | Update marker `phase6l/x/u/o/z/w`, `nav-bimbel`, skenario `Q6AA-01…Q6AA-08`, regresi penuh, cleanup fixture | AC8 | REL-33 | done | ADR-023 |
| DOC-14 | Dokumentasi | Template CSV/XLSX, OpenAPI, README backend/DB, laporan sistem, sinkronisasi ADR/backlog/status board | AC3, AC8 | REL-33 | done | ADR-023 |
| REL-33 | Release | Backup pra-rilis, deploy, smoke test, rollback ke `REL-32`, gate GO | R1–R8 | REL-33 | done / GO | ADR-023 |

## Rencana Handoff

Handoff development dicatat lewat ADR-023, backlog ini, dan file berikut:

- `tasks/handoff-BE46.md`
- `tasks/handoff-FE43.md`
- `tasks/handoff-TRY23.md`
- `tasks/handoff-QA43.md`
- `tasks/handoff-DOC14.md`
- Handoff `REL-33` tidak dibuat terpisah; hasil gate dicatat di status board dan backlog ini.

## Risiko & Catatan

- Backfill `SD` harus dilakukan sebelum `SET NOT NULL`; QA wajib memastikan tidak ada baris dengan `jenjang_id` null pada keempat tabel.
- Format kode lembar lama `LS-[mapel]-[mmyy]` harus diganti di validator, UI, test, dan contoh; jangan menyimpan dua format aktif.
- Kolom `jenjang` pada template CSV dan XLSX harus berurutan identik; XLSX adalah file biner/XML yang perlu diverifikasi sebagai fixture import, bukan sekadar rename.
- Perubahan filter soal menyentuh pagination; filter harus dikirim ke backend agar total dan halaman berikutnya konsisten.
- `question_count` boleh tetap dikembalikan API untuk kompatibilitas, tetapi tidak boleh tampil di Daftar Tryout.
- QA dilarang memakai helper cleanup berbasis `created_at` yang bisa menghapus data operasional baru; pakai fixture dengan prefix uji dan cleanup eksplisit.
- QA memakai kredensial admin dari `backend-agent/.env` tanpa mencetak secret; jangan commit `.env`, backup DB, atau file `/tmp/opencode/*`.
- Gate `REL-33` memakai rollback `REL-32`; tidak membuka ulang gate sebelumnya dan tidak mengubah format laporan tryout.
- Final 2026-11-25: migrasi `034` terpasang setelah backup `/tmp/opencode/bank_soal_db-pre034-2026-11-25.dump`; regresi penuh 216/216 lolos, 0 fail; build frontend sukses menghasilkan `index-H1JcLzJU.js`; health API OK; gate `REL-33` **GO**. Perubahan masih berada di working tree dan belum di-commit.
