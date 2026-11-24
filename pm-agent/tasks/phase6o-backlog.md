# Backlog — Fase 6o: Alur Buat Tryout & Peserta Umum

| Field | Isi |
|---|---|
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Sumber | Permintaan pemilik proyek 2026-11-24 |
| Status | ADR-007 `accepted`; QA-29A/BE-32/FE-29/TRY-12/QA-29/REL-17 `done` (`REL-17` **GO** 2026-11-24) |
| Prioritas | P0 |
| Serah terima | PM→Backend, Frontend, Tryout, QA |

## Requirement Pemilik

1. User mengisi nama tryout; label diubah menjadi Camel/Title Case.
2. User memilih tanggal dan jam mulai.
3. User memilih tanggal dan jam selesai.
4. User memilih mapel.
5. Tampilkan lembar soal berdasarkan mapelnya saat ini menampilkan soal.
6. Tersedia tombol untuk menambahkan peserta tryout, tetapi peserta tidak wajib diisi.
7. Klik tombol tersebut menampilkan dua pilihan: `A. Peserta Didik` atau `B. Peserta Umum`.
8. `Peserta Didik` diabaikan untuk saat ini; fitur dikembangkan nanti.
9. `Peserta Umum` membuka popup pengisian data peserta.
10. Data Peserta Umum: Nama, Sekolah, PIN, nomor WA orang tua.
11. PIN dibuat otomatis berupa 9 digit random.
12. Nama dan PIN dipakai untuk login di halaman tryout; aturan halaman tryout diubah.

## Evaluasi PM

- Ini bukan perubahan kosmetik: diperlukan migrasi untuk jadwal mulai/selesai, relasi tryout–lembar soal, dan tipe peserta umum dengan PIN.
- Kontrak login dapat tetap `{ username, password }` agar cookie, refresh, JWT, dan presentation service tidak dirombak; maknanya saja yang diperluas.
- Peserta Umum sebaiknya memakai tabel `tryout_participants` yang sudah ada supaya `auth_sessions`, `tryout_session_participants`, dan `tryout_submissions` tetap kompatibel.
- `Peserta Didik` hanya placeholder UI. Alur siswa existing lewat Kelola Siswa dan login email+password tetap berfungsi.
- QA wajib me-review desain dan rencana migrasi sebelum DDL diapply, mengikuti pola QA-11 pada Fase 6.
- Perlu cek `free -h` sebelum build frontend dan regresi; jalankan serial dengan heap dibatasi agar tidak OOM pada VM 1.9 GiB.

## Keputusan & Definisi

| ID | Keputusan | Sumber |
|---|---|---|
| D1 | Label `Nama Tryout`, field tetap `name`; urutan form mengikuti requirement 1–6. | ADR-007 |
| D2 | `start_at`/`end_at` `TIMESTAMPTZ` Asia/Jakarta, `end_at > start_at`, `session_date` diturunkan dari `start_at`. | ADR-007 |
| D3 | UI memakai lembar soal aktif sesuai mapel; backend menyimpan `tryout_session_sheets` dan menurunkan `tryout_session_questions`. | ADR-007 |
| D4 | `question_ids` lama tetap diterima; UI baru mengirim `sheet_ids`. | ADR-007 |
| D5 | `participant_ids` opsional; peserta boleh 0. | ADR-007 |
| D6 | Opsi `A. Peserta Didik` hanya placeholder "Segera hadir". | ADR-007 |
| D7 | Umum = `jenis='umum'` di `tryout_participants`, `pin_hash` scrypt, email null, kelas 0, WA wajib. | ADR-007 |
| D8 | PIN 9 digit dibuat frontend dengan Web Crypto, readonly + generate ulang; backend validasi regex dan hash. | ADR-007 |
| D9 | Nama Umum unik case-insensitive; email tetap unik untuk siswa. | ADR-007 |
| D10 | Login tetap `POST /auth/login`; Umum memakai Nama + PIN, resolusi Umum→Siswa→CMS. | ADR-007 |
| D11 | `authMiddleware` memakai fallback nama, tidak lagi mewajibkan `participant_email`. | ADR-007 |
| D12 | Tryout-agent memakai label `Nama atau Email peserta` / `Password atau PIN`, aset `?v=11`/`?v=12`. | ADR-007 |
| D13 | Migrasi `020_peserta_umum.sql`, `021_tryout_jadwal_lembar.sql`, dan `022_participant_password_nullable.sql`, idempoten, direview QA-29A. | ADR-007 |
| D14 | Tidak ada permission baru; `tryouts.manage`, `tryout.access`, `presentation.read` tetap dipakai. | ADR-007 |

## Acceptance Criteria

- [x] Urutan dan label form Buat Tryout sesuai requirement 1–5, dengan validasi `end_at > start_at` dan daftar lembar soal aktif yang benar-benar filter mapel.
- [x] Tryout tersimpan dengan `sheet_ids`, menghasilkan `tryout_session_sheets` dan `tryout_session_questions`; payload lama `question_ids` tetap diterima regresi.
- [x] `Simpan Tryout` berhasil tanpa peserta; `participant_count` boleh `0` dan tidak ada error validasi peserta.
- [x] Tombol `Tambah Peserta Tryout` menampilkan dua opsi; `A. Peserta Didik` hanya menampilkan pesan "Segera hadir" dan tidak menulis DB.
- [x] `B. Peserta Umum` membuka popup dengan Nama, Sekolah, PIN 9 digit otomatis, dan WA orang tua; PIN bisa di-generate ulang dan tampil sebelum submit.
- [x] Peserta Umum tersimpan dengan `jenis='umum'`, `pin_hash`, `email NULL`, `kelas=0`, WA valid; plaintext PIN tidak tersimpan atau tercatat di log.
- [x] Nama Umum duplikat (abaikan huruf), PIN bukan 9 digit, WA invalid, dan Nama/Sekolah kosong ditolak dengan pesan jelas.
- [x] Login tryout dengan Nama + PIN berhasil, menghasilkan sesi participant, bisa mengakses `/tryout/questions`, dan submit soal sesuai sesi aktif.
- [x] Login tryout lama dengan email + password siswa tetap berhasil; akun CMS tidak terpengaruh urutan resolusi.
- [x] PIN salah 5 kali mengunci akun Umum 15 menit; pesan error tidak membocorkan apakah yang salah Nama atau PIN.
- [x] UI tryout menampilkan label baru dan aset `styles.css?v=11`/`app.js?v=12` terlayani dengan benar.
- [x] OpenAPI, DB README, README agent, dan status board diperbarui; regresi penuh lulus tanpa bug P0/P1 sebelum `REL-17` **GO**.

## Serah Terima

| Task ID | Owner | Prioritas | Dependency | Status |
|---|---|---|---|---|
| PM-17 | PM | P0 | - | done — ADR-007, backlog, dan 4 handoff diterbitkan |
| QA-29A | QA | P0 | PM-17 | done — review ADR & rencana migrasi; catatan password_hash nullable dan jadwal legacy ditindaklanjuti |
| BE-32 | Backend | P0 | QA-29A | done — migrasi 020/021/022, participant umum, jadwal & lembar, auth, OpenAPI |
| FE-29 | Frontend | P0 | BE-32 (kontrak) | done — bundle `index-BWwbQxdi.js` terdeploy |
| TRY-12 | Tryout | P0 | BE-32 (kontrak) | done — aset `?v=11`/`?v=12` dan label login baru |
| QA-29 | QA | P0 | QA-29A, BE-32, FE-29, TRY-12 | done — U-01..U-10 lolos, regresi 142/142 |
| REL-17 | PM | P0 | QA-29 | done — **GO** 2026-11-24 |

## Handoff Diterbitkan

- `pm-agent/decisions/ADR-007-peserta-umum-tryout.md` — dasar keputusan, status `accepted`.
- `pm-agent/tasks/handoff-BE32.md` — migrasi, backend, auth, dan dokumentasi.
- `pm-agent/tasks/handoff-FE29.md` — alur form dan popup Peserta Umum di CMS.
- `pm-agent/tasks/handoff-TRY12.md` — aturan login baru di aplikasi tryout.
- `pm-agent/tasks/handoff-QA29.md` — review desain, test plan, regresi, dan input `REL-17`.
- Baseline `free -h` 2026-11-24 saat distribusi: 1.9 GiB total, 541 MiB available, swap 722 MiB / 3.9 GiB. Cek ulang sebelum build/test; jalankan serial dengan heap 128–256 MB.
- Gate: QA-29A lebih dulu, lalu BE-32, lalu FE-29/TRY-12 dapat berjalan paralel selama kontrak sudah disepakati, terakhir QA-29 dan `REL-17`.
