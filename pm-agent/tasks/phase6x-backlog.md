# Backlog — Fase 6x: Edit Tryout dan Unduh Soal PDF

| Field | Isi |
|---|---|
| Fase | Fase 6x |
| Gate | `REL-30` |
| Tanggal | 2026-11-24 |
| ADR | `ADR-020` |
| Status | done / `REL-30` GO — implementasi, migrasi `032`, QA, dan dokumen selesai |
| Pemilik | PM |
| Melanjutkan | Fase 6w / `REL-29` (GO); gate `REL-30` terpisah; `REL-01…REL-29` tidak dibuka ulang; Fase 7 dibatalkan |

## Konteks / Masukan Pemilik

Pemilik menanyakan mengapa tryout tidak bisa diedit pada halaman Buat/Daftar Tryout, lalu meminta:

1. Kemampuan mengubah tryout yang sudah dibuat.
2. Tombol **Unduh Soal** di halaman Buat/Daftar Tryout: soal saja, hasil PDF.
3. Tombol **Unduh Soal + Kunci** di halaman yang sama: soal beserta kunci jawaban, hasil PDF.

Jawaban PM atas pertanyaan pemilik: tombol `Edit` dan endpoint update memang belum dibuat. `TryoutManagement.jsx:1119-1129` hanya memuat aksi `Kelola Peserta`, `Atur CBT`, dan `Hapus`; `backend-agent/src/tryoutRoutes.js` hanya memuat `PATCH /tryouts/:id/cbt` sebagai satu-satunya update. Status tryout bersifat turunan dari jadwal (`030_tryout_events_and_sessions.sql:78-91`) dan **bukan** penghalang.

Lima pertanyaan terbuka sudah dijawab pemilik 2026-11-24: edit hanya nama dan jadwal (lembar soal yang dipakai hanya ditampilkan), `slug`/URL tidak boleh diubah, permission RBAC baru untuk `soal + kunci` dengan cakupan satu jadwal dipisah per sesi (3 sesi → 3 file PDF), library PDF di backend dengan isi wajib `nama lembar soal`/`kode lembar soal`/`mapel`/`keterangan`, dan tombol unduh ditempatkan per baris Daftar Tryout. Tiga sisa konfirmasi lalu diselesaikan: `Ubah` tersedia di semua status karena tryout bisa diperpanjang, kode permission `tryout_questions.key_export` disetujui, dan PM memutuskan satu ZIP per klik berisi PDF per sesi untuk kedua varian. Detail ada di `pm-agent/decisions/ADR-020-edit-tryout-dan-ekspor-soal-pdf.md`. Implementasi selesai dan terverifikasi 2026-11-24 dengan regresi penuh 194/194 dan gate `REL-30` GO.

## Requirement

| ID | Requirement | PM | Status | Gate | ADR |
|---|---|---|---|---|---|
| R1 | Tombol `Ubah` pada kolom Aksi Daftar Tryout | PM-28 | done | REL-30 | ADR-020 |
| R2 | Form edit hanya mengubah nama dan jadwal, tersedia untuk semua status; sesi/mapel/peserta read-only; lembar soal yang dipakai hanya ditampilkan | PM-28 | done | REL-30 | ADR-020 |
| R3 | `PUT`/`PATCH /tryouts/:id` transaksional, permission `tryouts.manage`, `slug`/URL tidak diubah | PM-28 | done | REL-30 | ADR-020 |
| R4 | Ekspor PDF bersumber dari satu jadwal tryout, dipisah per sesi, dibungkus satu ZIP per klik (3 sesi → 3 PDF dalam 1 ZIP) | PM-28 | done | REL-30 | ADR-020 |
| R5 | Tombol `Unduh Soal` per baris: PDF soal tanpa kunci/pembahasan, memuat nama & kode lembar soal, mapel, keterangan | PM-28 | done | REL-30 | ADR-020 |
| R6 | Tombol `Unduh Soal + Kunci` per baris: PDF soal + kunci dengan isi wajib yang sama | PM-28 | done | REL-30 | ADR-020 |
| R7 | Permission RBAC `tryout_questions.key_export` untuk `Unduh Soal + Kunci`, dapat diberikan ke role mana pun | PM-28 | done | REL-30 | ADR-020 |
| R8 | Library PDF & ZIP di backend; format halaman/font bebas; frontend tanpa library PDF/ZIP baru | PM-28 | done | REL-30 | ADR-020 |
| R9 | Regresi `REL-24…REL-29` tetap lolos | PM-28 | done | REL-30 | ADR-020 |

## Keputusan

Ringkas; detail, jawaban pemilik, dan alternatif ada di `pm-agent/decisions/ADR-020-edit-tryout-dan-ekspor-soal-pdf.md`.

| ID | Keputusan | Alasan |
|---|---|---|
| D1 | Edit tersedia karena tombol/endpoint memang belum dibuat, bukan karena status | Tidak ada guard status; hanya `PATCH /tryouts/:id/cbt` yang ada |
| D2 | Hanya nama/jadwal yang diedit; lembar soal dipakai ditampilkan read-only; tombol tersedia di semua status | Tryout dapat diperpanjang |
| D3 | Endpoint update baru, `slug` tidak berubah, JWT lama valid | URL tryout sudah dipakai peserta |
| D4 | Dua aksi unduh per baris, PDF dipisah per sesi lalu dibungkus satu ZIP | 3 sesi → 3 PDF dalam 1 ZIP; hindari multi-download yang diblokir browser |
| D5 | Permission RBAC `tryout_questions.key_export` untuk kunci | Disetujui pemilik; hak dapat diberikan ke role mana pun |
| D6 | PDF dan ZIP dibangkitkan backend; isi wajib empat field | Sesuai jawaban pemilik; frontend ringan |
| D7 | Gate `REL-30`, rollback `REL-29`, tanpa Fase 7 | Perubahan terpisah dari Fase 6w |
| D8 | Tidak mengubah XLSX laporan dan tidak mengubah fitur CBT | Menghindari regresi `REL-28`/`REL-29` |

## Acceptance Criteria

- **AC1 (R1):** Daftar Tryout menampilkan tombol `Ubah` di kolom Aksi untuk setiap tryout, berdampingan dengan `Kelola Peserta`, `Atur CBT`, dan `Hapus`.
- **AC2 (R2):** Modal `Ubah` hanya memiliki input aktif untuk nama, tanggal/jam mulai, dan tanggal/jam selesai. Sesi, mapel, dan peserta tampil sebagai teks/daftar read-only; lembar soal yang dipakai ditampilkan beserta nama dan kodenya. Menyimpan tidak membuat tryout baru. Tombol `Ubah` tetap tersedia di status `terjadwal`, `berlangsung`, dan `selesai`.
- **AC3 (R3):** `PUT`/`PATCH /tryouts/:id` mengembalikan 401 tanpa cookie, 403 tanpa `tryouts.manage`, 400 untuk payload invalid, 200 untuk update valid; `slug`/URL tidak berubah; JWT peserta lama tetap diterima.
- **AC4 (R4):** Untuk tryout dengan 3 sesi, setiap tombol unduh menghasilkan satu file ZIP yang berisi 3 PDF (satu per sesi) dengan nama file di dalam ZIP yang mencerminkan tryout, sesi, dan varian. Berlaku sama untuk `Unduh Soal` dan `Unduh Soal + Kunci`.
- **AC5 (R5):** Tombol `Unduh Soal` menghasilkan PDF per sesi berisi soal (teks, gambar, opsi, pernyataan True/False) tanpa kunci jawaban/pembahasan; setiap PDF memuat `nama lembar soal`, `kode lembar soal`, `mapel`, dan `keterangan`; `Content-Type` ZIP untuk respons unduhan dan `application/pdf` untuk setiap PDF di dalamnya.
- **AC6 (R6):** Tombol `Unduh Soal + Kunci` menghasilkan PDF per sesi dengan struktur dan field wajib sama, ditambah kunci jawaban; ZIP dapat diunduh dan setiap PDF di dalamnya dapat dibuka.
- **AC7 (R7):** Tersedia permission RBAC `tryout_questions.key_export` yang bisa dipetakan ke role mana pun; tanpa permission tersebut, `Unduh Soal + Kunci` ditolak 403; role lama tidak otomatis mendapatkannya.
- **AC8 (R8):** Tidak ada dependency PDF/ZIP baru di `frontend-agent`; generator PDF dan ZIP berada di backend.
- **AC9 (R9):** Regresi `REL-24…REL-29` tetap lolos, termasuk login/submit tryout setelah edit dan ekspor XLSX laporan yang tidak berubah.

## Breakdown Task

| ID | Agent | Deskripsi | AC | Gate | Status | ADR |
|---|---|---|---|---|---|---|
| PM-28 | PM | Mencatat pertanyaan pemilik, jawaban akar masalah, ADR-020, backlog, status board, indeks README | R1–R9 | REL-30 | done | ADR-020 |
| BE-43 | Backend | `PATCH /tryouts/:id` hanya nama/jadwal tanpa mengubah `slug`; migrasi `032` permission `tryout_questions.key_export`; `GET /tryouts/:id/questions.zip` dan `/questions-with-keys.zip` berisi PDF per sesi dari `backend-agent/src/tryoutExport.js`; OpenAPI/DB doc | R3–R8 | REL-30 | done | ADR-020 |
| FE-40 | Frontend | Tombol `Ubah` + form hanya nama/jadwal dengan tampilan lembar soal read-only; tombol `Unduh Soal` dan `Unduh Soal + Kunci` per baris; api client unduhan satu ZIP per aksi; build `index-wgOfGZ4O.js` | R1, R2, R5–R8 | REL-30 | done | ADR-020 |
| TRY-21 | Tryout | Verifikasi login dan submit peserta lewat regresi penuh; JWT lama tetap valid | AC3, AC9 | REL-30 | done | ADR-020 |
| QA-40 | QA | Skenario `Q6X-01…Q6X-04` + regresi penuh 194/194; edit di semua status, ZIP berisi PDF per sesi, permission `tryout_questions.key_export`, kebocoran kunci; fixture dibersihkan | R1–R9 | REL-30 | done | ADR-020 |
| DOC-11 | Dokumentasi | OpenAPI endpoint edit/PDF, migrasi permission RBAC, README backend/DB, alur ekspor ZIP per sesi, ADR/backlog/status board tersinkron | R3–R8 | REL-30 | done | ADR-020 |
| REL-30 | Release | Backup `/tmp/opencode/bank_soal_db-pre6wx-2026-11-24.dump`, deploy, smoke test, rollback ke `REL-29`, gate **GO** | R1–R9 | REL-30 | done / GO | ADR-020 |

## Rencana Handoff

Handoff development dicatat melalui ADR-020, backlog ini, dan status board; file handoff terpisah tidak dibuat pada iterasi ini:

- `tasks/handoff-BE43.md`
- `tasks/handoff-FE40.md`
- `tasks/handoff-TRY21.md`
- `tasks/handoff-QA40.md`
- `tasks/handoff-DOC11.md`
- `tasks/handoff-REL30.md`

## Risiko & Catatan

- Semua keputusan ADR-020 final: `Ubah` tersedia di semua status, permission `tryout_questions.key_export`, satu ZIP per klik berisi PDF per sesi untuk kedua varian.
- Mengubah jadwal mengubah status turunan (`selesai`/`terjadwal`/`berlangsung`); QA wajib menguji perpanjangan waktu di status `selesai` maupun `berlangsung`.
- Satu klik menghasilkan satu ZIP; hindari beberapa unduhan otomatis yang dapat diblokir browser.
- Permission RBAC baru tidak otomatis melekat ke role existing; perlu langkah penugasan saat deploy.
- Stack PDF/ZIP dibangkitkan internal di `backend-agent/src/tryoutExport.js` tanpa dependency baru; build frontend dan backend tetap sukses.
- Varian soal saja dan soal + kunci wajib diuji terpisah untuk mencegah kebocoran kunci jawaban.
- Implementasi dan QA selesai; seluruh perubahan masih di working tree dan belum di-commit/di-push. Gate `REL-30` GO berdasarkan regresi penuh 194/194, migrasi `032`, build, dan health checks.
