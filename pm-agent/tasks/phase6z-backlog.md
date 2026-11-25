# Backlog — Fase 6z: Daftar Soal, Impor CSV/XLSX, & Peserta Umum

| Field | Isi |
|---|---|
| Fase | Fase 6z |
| Gate | `REL-32` |
| Tanggal | 2026-11-25 |
| ADR | `ADR-022` |
| Status | done — ADR accepted; implementasi/QA/DOC selesai; regresi 206/206; `REL-32` GO 2026-11-25 |
| Pemilik | PM |
| Melanjutkan | Fase 6 ditutup dengan `REL-32` GO; `REL-01…REL-31` tidak dibuka ulang; Fase 7 dibatalkan |

## Konteks / Masukan Pemilik

Pemilik menutup sesi Fase 6y dan meminta sesi baru untuk halaman Daftar Soal:

1. Setiap baris soal menampilkan angka jumlah pemakaian soal tersebut di lembar soal.
2. Impor soal hanya menerima file CSV dan XLSX.
3. Bagian impor soal memiliki tautan download template; isinya contoh lengkap dan valid untuk dijadikan dasar import.
4. Metode import soal dengan payload dibuang.
5. Pada setiap data siswa/peserta, username dan PIN/password didekatkan dan ada tombol copy ke clipboard agar mudah dishare.
6. Menu `Peserta Tryout` dan nama halamannya diubah menjadi `Peserta Umum`.

Pemilik meminta PM mencatat dan membuat breakdown task serta menanyakan hal yang tidak jelas. Enam klarifikasi sudah dijawab 2026-11-25: angka pemakaian adalah jumlah pemakaian di lembar soal aktif; lembar arsip/dihapus tidak dihitung; pembatasan format dan penolakan payload berlaku di UI + API; template tersedia dalam CSV dan XLSX; kredensial memakai satu tombol copy pasangan di semua tampilan siswa/peserta; perubahan nama mencakup label, judul, rute, dan dokumentasi dengan alias lama tetap redirect. Detail ada di `pm-agent/decisions/ADR-022-daftar-soal-impor-csv-xlsx-dan-peserta-umum.md`.

Pemeriksaan awal 2026-11-25:

- `frontend-agent/src/pages/Dashboard.jsx:366-370` menampilkan baris soal, sumber, dan lembar soal, tetapi belum ada angka pemakaian per soal.
- `backend-agent/src/questionSheetRoutes.js:14-22` mengembalikan `question_count` dan `used_by_tryout` boolean; `:176-190` melampirkan `sheets` ke soal tanpa agregasi pemakaian aktif.
- `frontend-agent/src/pages/QuestionInput.jsx:25-35,121-130,244-263` masih menyediakan mode `File`/`Payload` dan menerima `.json,.csv,.txt`.
- `backend-agent/src/routes.js:502-557` masih menerima `file`, `content`, atau `questions[]` pada import.
- `backend-agent/src/importer.js:81-101` hanya mendeteksi JSON/CSV/TXT; parser XLSX belum ada meski `exceljs` sudah dipakai backend untuk laporan.
- Detail kredensial tersedia di `backend-agent/src/participantRoutes.js:37-47`; tampil di `PesertaManagement.jsx:427-439`, `ProspektusManagement.jsx:198-213`, dan `TryoutManagement.jsx:1104-1118`.
- `frontend-agent/src/App.jsx:50` memakai label `Peserta Tryout` untuk `#/tryouts/prospektus`; `:161-162` merender `ProspektusManagement`.
- Fase 6y sudah selesai dan di-commit di `38af84a`; regresi terakhir 199/199 pass.

## Requirement

| ID | Requirement | PM | Status | Gate | ADR |
|---|---|---|---|---|---|
| R1 | Fase 6y ditutup; Fase 6z / `REL-32` dibuka dengan rollback ke `REL-31` | PM-30 | done | REL-32 | ADR-022 |
| R2 | Setiap baris Daftar Soal menampilkan angka pemakaian pada lembar soal aktif | PM-30 | done | REL-32 | ADR-022 |
| R3 | Impor soal hanya CSV dan XLSX di UI dan API; payload/JSON/TXT ditolak jelas | PM-30 | done | REL-32 | ADR-022 |
| R4 | Tautan download template CSV dan XLSX tersedia dan keduanya valid lengkap | PM-30 | done | REL-32 | ADR-022 |
| R5 | Nama, username, dan PIN/password berdekatan dengan satu tombol copy di semua data siswa/peserta | PM-30 | done | REL-32 | ADR-022 |
| R6 | Menu dan halaman `Peserta Tryout` menjadi `Peserta Umum`, termasuk rute dan alias lama | PM-30 | done | REL-32 | ADR-022 |
| R7 | Regresi penuh `REL-24…REL-31` lolos dengan skenario baru Fase 6z | PM-30 | done | REL-32 | ADR-022 |
| R8 | OpenAPI, README backend/DB, laporan sistem, ADR, backlog, dan status board tersinkron | PM-30 | done | REL-32 | ADR-022 |

## Keputusan

| ID | Keputusan | Alasan | Status |
|---|---|---|---|
| D1 | Tutup Fase 6y; Fase 6z memakai `REL-32`, rollback `REL-31` | Isolasi perubahan dan gate terbaru | final |
| D2 | Angka pemakaian = jumlah lembar soal aktif yang memuat soal | Sesuai jawaban pemilik; arsip tidak dihitung | final |
| D3 | Import CSV/XLSX saja; UI dan API menolak payload, JSON, TXT | Sesuai jawaban pemilik | final |
| D4 | Dua template valid: CSV dan XLSX | Sesuai jawaban pemilik | final |
| D5 | Semua tampilan siswa/peserta memakai pasangan kredensial + satu tombol copy | Sesuai jawaban pemilik; user CMS dikecualikan | final |
| D6 | Rename label, judul, rute, marker, dan docs ke `Peserta Umum`; alias lama redirect | Sesuai jawaban pemilik | final |
| D7 | Format laporan tryout dan gate `REL-24…REL-31` tidak diubah | Menjaga isolasi rilis | final |

## Acceptance Criteria

- **AC1 (R1):** Status board dan README menandai Fase 6y tutup pada `38af84a` serta Fase 6z / `REL-32` sebagai sesi aktif berikutnya.
- **AC2 (R2):** `GET /api/v1/questions` mengembalikan angka pemakaian per soal dari lembar aktif; Dashboard menampilkan angka tersebut pada setiap baris, termasuk setelah pagination/filter.
- **AC3 (R3):** UI import hanya menawarkan file CSV/XLSX; mode Payload dan format JSON/TXT tidak ada. Backend menolak `content`, `questions[]`, dan ekstensi selain `.csv`/`.xlsx` dengan `400 VALIDATION_ERROR`.
- **AC4 (R4):** Tautan template CSV dan XLSX tersedia pada kartu import; kedua file berisi contoh lengkap dan valid serta lolos import tanpa perubahan.
- **AC5 (R5):** Semua daftar/detail siswa, prospektus, dan peserta tryout menampilkan username bersebelahan dengan PIN/password; satu tombol copy menyalin `Nama: ...`, `username: ...`, dan `PIN/password: ...`. Kredensial tidak muncul di endpoint publik/user CMS.
- **AC6 (R6):** Menu dan nama halaman/dialog memakai `Peserta Umum`; hash/route baru aktif, hash/route lama tetap redirect, marker QA dan dokumentasi diperbarui.
- **AC7 (R7):** Skenario `Q6Z-01…Q6Z-07` lolos dan regresi penuh tidak menurunkan hasil 199/199 baseline.
- **AC8 (R8):** OpenAPI, README backend/DB, laporan sistem, ADR-022, backlog, dan status board sesuai implementasi final.

## Breakdown Task

| ID | Agent | Deskripsi | AC | Gate | Status | ADR |
|---|---|---|---|---|---|---|
| PM-30 | PM | Menutup Fase 6y, mencatat masukan pemilik, klarifikasi Q1–Q6, ADR-022, backlog Fase 6z, status board, dan README | R1–R8 | REL-32 | done | ADR-022 |
| BE-45 | Backend | Agregasi `usage_count` lembar aktif per soal; parser/validator CSV+XLSX; tolak payload/JSON/TXT; kontrak kredensial terautorisasi; OpenAPI | AC2, AC3, AC5 | REL-32 | done | ADR-022 |
| FE-42 | Frontend | Kolom pemakaian di Dashboard; UI import CSV/XLSX + template; copy kredensial berpasangan; rename menu/judul/rute + alias | AC2, AC3, AC4, AC5, AC6 | REL-32 | done | ADR-022 |
| QA-42 | QA | Skenario `Q6Z-01…Q6Z-07`, regresi penuh `REL-24…REL-31`, cleanup fixture, laporan dan rekomendasi gate | AC7 | REL-32 | done — 206/206 pass, 0 fail | ADR-022 |
| DOC-13 | Dokumentasi | File template CSV/XLSX, OpenAPI, README backend/DB, laporan sistem, sinkron ADR/backlog/status board | AC4, AC8 | REL-32 | done | ADR-022 |
| REL-32 | Release | Backup pre-`REL-32`, deploy, smoke test, rollback ke `REL-31`, gate GO | R1–R8 | REL-32 | done — **GO** 2026-11-25; backup `/tmp/opencode/bank_soal_db-pre032-2026-11-25.dump` | ADR-022 |

## Rencana Handoff

Mengikuti pola Fase 6y, handoff development dicatat lewat ADR-022 dan backlog ini; file handoff terpisah belum dibuat:

- `tasks/handoff-BE45.md`
- `tasks/handoff-FE42.md`
- `tasks/handoff-QA42.md`
- `tasks/handoff-DOC13.md`
- `tasks/handoff-REL32.md`

## Risiko & Catatan

- Mengubah kontrak import dapat memutus klien lama yang mengirim payload; oleh karena itu error harus jelas dan tercatat di OpenAPI.
- Parser XLSX harus memakai library yang sudah ada (`exceljs`) dan memvalidasi header/baris contoh template agar tidak ada file template yang lolos di UI tetapi gagal di backend.
- Kredensial plaintext sensitif: pastikan hanya peran CMS berpermission yang melihat/copy dan tidak ada plaintext pada log atau endpoint peserta.
- Rename rute perlu menjaga bookmark lama; QA harus menguji alias dan memastikan tidak ada marker lama tersisa di bundle.
- QA memakai `QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD"` dari `backend-agent/.env` tanpa mencetak secret; sesi aktif baseline dipulihkan oleh helper QA.
- Revisi lanjutan dalam sesi yang sama: `Kelola Peserta` dari tryout tersimpan sekarang memakai halaman `#/tryouts/{id}/peserta` (bukan popup), dengan tabel gabungan dan form inline A/B; alur draft Buat Tryout tidak berubah.
- Gate `REL-32` rollback ke `REL-31`; `REL-01…REL-31` tidak dibuka ulang; Fase 7 tetap dibatalkan.
- Status akhir 2026-11-25: BE-45/FE-42/QA-42/DOC-13 selesai, regresi penuh 206/206 pass dan 0 fail, build frontend sukses menghasilkan `index-C_etU5Vw.js`, health backend/presentation OK, backup pre-`REL-32` tersedia, dan gate `REL-32` **GO**. Perubahan masih berada di working tree dan belum di-commit.
