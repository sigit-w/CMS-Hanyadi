# PM Agent — Project Manager

## Fungsi

Memecah pekerjaan menjadi task, menentukan prioritas dan dependency, memantau progres, serta mengatur alur serah terima antar agent.

## File yang dikelola

| File | Fungsi |
|---|---|
| `tasks/phase3-backlog.md` | Indeks backlog dan aturan prioritas Fase 3 |
| `tasks/phase6-backlog.md` | Backlog & AC Fase 6: manajemen role + login CMS/tryout |
| `tasks/handoff-template.md` | Format serah terima antar agent |
| `tasks/handoff-BE13-17.md` | Serah terima PM→Backend Fase 6 |
| `tasks/handoff-FE10-13.md` | Serah terima PM→Frontend Fase 6 |
| `tasks/handoff-TRY04-06.md` | Serah terima PM→Tryout Fase 6 |
| `tasks/handoff-QA11-14.md` | Serah terima PM→QA Fase 6 |
| `tasks/phase6g-backlog.md` | Backlog & AC Fase 6g: manajemen tryout |
| `tasks/phase6j-backlog.md` | Backlog & AC Fase 6j: penyederhanaan soal & pagination |
| `tasks/phase6l-backlog.md` | Requirement & AC draft Fase 6l: Lembar Soal |
| `tasks/phase6n-backlog.md` | Requirement, keputusan, & AC Fase 6n: Manajemen Bimbel |
| `tasks/handoff-BE31.md` | Serah terima PM→Backend Fase 6n: verifikasi kontrak & dokumentasi |
| `tasks/handoff-FE28.md` | Serah terima PM→Frontend Fase 6n: grup/menu/rute Manajemen Bimbel |
| `tasks/handoff-QA28.md` | Serah terima PM→QA Fase 6n: marker, skenario navigasi, regresi |
| `tasks/phase6o-backlog.md` | Requirement, keputusan, & AC Fase 6o: alur Buat Tryout & Peserta Umum |
| `tasks/handoff-BE32.md` | Serah terima PM→Backend Fase 6o: migrasi, participant umum, jadwal & lembar, auth |
| `tasks/handoff-FE29.md` | Serah terima PM→Frontend Fase 6o: form Buat Tryout & popup Peserta Umum |
| `tasks/handoff-TRY12.md` | Serah terima PM→Tryout Fase 6o: login Nama + PIN |
| `tasks/handoff-QA29.md` | Serah terima PM→QA Fase 6o: review ADR, U-01..U-10, regresi, gate REL-17 |
| `tasks/handoff-BE25-PRES02.md` | Serah terima PM→Backend/Presentation Fase 6j |
| `tasks/handoff-FE21-TRY10.md` | Serah terima PM→Frontend/Tryout Fase 6j |
| `tasks/handoff-QA22-REL10.md` | Serah terima PM→QA/PM Fase 6j |
| `progress/status-board.md` | Papan status seluruh task Fase 3–6 |
| `decisions/adr-template.md` | Template log keputusan |
| `decisions/ADR-001-auth-role.md` | Keputusan auth, model role, dan perubahan schema Fase 6 |
| `decisions/ADR-002-manajemen-tryout.md` | Keputusan model data & enforcement Manajemen Tryout |
| `decisions/ADR-004-penyederhanaan-soal.md` | Keputusan status approved, versi nonaktif, dan pagination Fase 6j |
| `decisions/ADR-006-manajemen-bimbel.md` | Keputusan grup menu, rute, dan permission Manajemen Bimbel Fase 6n |
| `decisions/ADR-007-peserta-umum-tryout.md` | Keputusan alur Buat Tryout, lembar soal, Peserta Umum, PIN, dan login Fase 6o |
| `tasks/phase6p-backlog.md` | Requirement, keputusan, & AC Fase 6p: peserta tryout, detail, hapus relasi, & Prospektus |
| `tasks/handoff-BE33.md` | Serah terima PM→Backend Fase 6p: migrasi 023, endpoint hapus relasi & prospektus |
| `tasks/handoff-FE30.md` | Serah terima PM→Frontend Fase 6p: picker siswa, detail baris, trash icon, & halaman Prospektus |
| `tasks/handoff-TRY13.md` | Serah terima PM→Tryout Fase 6p: verifikasi non-regresi login |
| `tasks/handoff-QA30.md` | Serah terima PM→QA Fase 6p: PR-01..PR-08, regresi, & gate REL-18 |
| `decisions/ADR-008-peserta-tryout-dan-prospektus.md` | Keputusan Default peserta, picker, detail, hapus relasi, & status prospek Fase 6p |
| `tasks/phase6q-backlog.md` | Requirement, keputusan, & AC Fase 6q: kelola peserta dari Daftar Tryout |
| `tasks/handoff-BE34.md` | Serah terima PM→Backend Fase 6q: endpoint lampir peserta ke tryout tersimpan |
| `tasks/handoff-FE31.md` | Serah terima PM→Frontend Fase 6q: hapus helper text & popup Kelola Peserta A/B |
| `tasks/handoff-QA31.md` | Serah terima PM→QA Fase 6q: QP-01..QP-05, regresi, & gate REL-19 |
| `decisions/ADR-009-kelola-peserta-tryout.md` | Keputusan popup Kelola Peserta, target draft/manage, & endpoint attach Fase 6q |
| `tasks/phase6t-backlog.md` | Requirement, keputusan, & AC Fase 6t: tryout multi-mapel & alur peserta |
| `tasks/handoff-BE39.md` | Serah terima PM→Backend Fase 6t: migrasi 029 & API multi-mapel |
| `tasks/handoff-FE36.md` | Serah terima PM→Frontend Fase 6t: form mapel, lembar soal, & picker siswa |
| `tasks/handoff-TRY18.md` | Serah terima PM→Tryout Fase 6t: toast violation & submit global |
| `tasks/handoff-PRES06.md` | Serah terima PM→Presentasi Fase 6t: submit-all & payload violation |
| `tasks/handoff-QA36.md` | Serah terima PM→QA Fase 6t: verifikasi R1–R5 & gate REL-26 |
| `tasks/handoff-DOC07.md` | Serah terima PM→Dokumentasi Fase 6t: arsitektur multi-mapel |
| `tasks/handoff-REL26.md` | Serah terima PM→Release Fase 6t: backup, deploy, & smoke test |
| `decisions/ADR-016-tryout-multi-mapel-dan-alur-peserta.md` | Keputusan multi-mapel, lembar soal, notifikasi, submit global, & picker siswa |
| `tasks/phase6u-backlog.md` | Requirement, keputusan, & AC Fase 6u: tryout bersesi, laporan, & lanjutan sesi |
| `tasks/handoff-BE40.md` | Serah terima PM→Backend Fase 6u: migrasi `030`, API sesi, & ekspor |
| `tasks/handoff-FE37.md` | Serah terima PM→Frontend Fase 6u: form sesi, prospektus, & laporan |
| `tasks/handoff-TRY19.md` | Serah terima PM→Tryout Fase 6u: tab sesi & lanjut/keluar |
| `tasks/handoff-PRES07.md` | Serah terima PM→Presentasi Fase 6u: soal per sesi & deadline |
| `tasks/handoff-QA37.md` | Serah terima PM→QA Fase 6u: verifikasi R1–R11 & gate REL-27 |
| `tasks/handoff-DOC08.md` | Serah terima PM→Dokumentasi Fase 6u: arsitektur & ekspor |
| `tasks/handoff-REL27.md` | Serah terima PM→Release Fase 6u: backup, deploy, & smoke test |
| `decisions/ADR-017-tryout-bersesi-dan-laporan.md` | Keputusan induk–sesi, prospektus, status, laporan, ekspor, & lanjutan sesi |
| `tasks/phase6v-backlog.md` | Requirement, keputusan, & AC Fase 6v: filter dan format laporan tryout |
| `tasks/handoff-BE41.md` | Serah terima PM→Backend Fase 6v: `search` sesi & filter `tryout_name` ekspor |
| `tasks/handoff-FE38.md` | Serah terima PM→Frontend Fase 6v: hapus section, filter sesi, & unduh berfilter |
| `tasks/handoff-QA38.md` | Serah terima PM→QA Fase 6v: `Q6V-01…Q6V-04` & regresi `REL-24…REL-27` |
| `tasks/handoff-DOC09.md` | Serah terima PM→Dokumentasi Fase 6v: README/OpenAPI & arsitektur filter |
| `tasks/handoff-REL28.md` | Serah terima PM→Release Fase 6v: rollback `REL-27`, deploy, & smoke test |
| `decisions/ADR-018-filter-dan-format-laporan-tryout.md` | Keputusan filter sesi, filter nama tryout, ekspor, & format laporan Fase 6v |
| `tasks/phase6w-backlog.md` | Requirement, keputusan, AC, & breakdown Fase 6w: laporan tryout, jenjang pendidikan, & kredensial peserta |
| `decisions/ADR-019-laporan-jenjang-dan-kredensial-peserta.md` | Keputusan hapus teks XLSX, dropdown React/popup tryout, `WAKTU` Jakarta, jenjang, username login, & kredensial WA |
| `tasks/phase6x-backlog.md` | Requirement, AC, & breakdown Fase 6x: edit tryout & unduh soal PDF |
| `decisions/ADR-020-edit-tryout-dan-ekspor-soal-pdf.md` | Keputusan akar masalah edit tryout, endpoint update, & dua ekspor ZIP berisi PDF |
| `tasks/phase6y-backlog.md` | Requirement, AC, & breakdown Fase 6y: grouping tryout, URL sesi, & validasi lembar soal |
| `decisions/ADR-021-flow-tryout-grouping-dan-url-sesi.md` | Keputusan accepted grouping tryout, URL canonical per sesi, & jawaban Q1–Q5 |
| `tasks/phase6z-backlog.md` | Requirement, AC, & breakdown Fase 6z: pemakaian soal, import CSV/XLSX, copy kredensial, & Peserta Umum |
| `decisions/ADR-022-daftar-soal-impor-csv-xlsx-dan-peserta-umum.md` | Keputusan accepted daftar soal, import CSV/XLSX tanpa payload, template, copy kredensial, & jawaban Q1–Q6 |
| `tasks/phase6aa-backlog.md` | Requirement, AC, & breakdown Fase 6aa: jenjang pendidikan di soal, lembar, tryout, & program belajar |
| `decisions/ADR-023-jenjang-pendidikan-soal-lembar-tryout-program.md` | Keputusan accepted backfill `SD`, kode lembar `LS-[mapel]-[jenjang]-[mmyy]`, slug tryout auto, & isolasi `REL-33` |
| `tasks/handoff-BE46.md` | Serah terima PM→Backend Fase 6aa: migrasi `034`, API soal/import/lembar/tryout/program, & OpenAPI |
| `tasks/handoff-FE43.md` | Serah terima PM→Frontend Fase 6aa: form/filter soal, flow lembar & tryout, tabel tryout, & program belajar |
| `tasks/handoff-TRY23.md` | Serah terima PM→Tryout Fase 6aa: verifikasi non-regresi login, URL sesi, submit, & laporan |
| `tasks/handoff-QA43.md` | Serah terima PM→QA Fase 6aa: marker baru, skenario `Q6AA-01…Q6AA-08`, regresi, & cleanup |
| `tasks/handoff-DOC14.md` | Serah terima PM→Dokumentasi Fase 6aa: template CSV/XLSX, OpenAPI, README, & laporan sistem |

Sumber kebenaran backlog Fase 3 ada di `docs/phase3-tasks.md`; Fase 6 ada di `tasks/phase6-backlog.md`; Fase 6j ada di `tasks/phase6j-backlog.md`; Fase 6l ada di `tasks/phase6l-backlog.md`; Fase 6n ada di `tasks/phase6n-backlog.md`; Fase 6o ada di `tasks/phase6o-backlog.md`; Fase 6p ada di `tasks/phase6p-backlog.md`; Fase 6q ada di `tasks/phase6q-backlog.md`; Fase 6t ada di `tasks/phase6t-backlog.md`; Fase 6u ada di `tasks/phase6u-backlog.md`; Fase 6v ada di `tasks/phase6v-backlog.md`; Fase 6w ada di `tasks/phase6w-backlog.md`; Fase 6x ada di `tasks/phase6x-backlog.md`; Fase 6y ada di `tasks/phase6y-backlog.md`; Fase 6z ada di `tasks/phase6z-backlog.md`; Fase 6aa ada di `tasks/phase6aa-backlog.md`. File di direktori ini dipakai untuk mengoperasionalkan backlog tersebut.

Fase 6o final 2026-11-24 dengan `REL-17` **GO**; bukti regresi dan keputusan rilis ada di `qa-agent/reports/phase6o-report.md` dan `qa-agent/reports/phase6o-release-gate.md`. Fase 6p final 2026-11-24 dengan `REL-18` **GO**; bukti regresi 150/150 dan keputusan rilis ada di `qa-agent/reports/phase6p-report.md` dan `qa-agent/reports/phase6p-release-gate.md`. Fase 6q final 2026-11-24 dengan `REL-19` **GO**; bukti regresi 155/155 dan keputusan rilis ada di `qa-agent/reports/phase6q-report.md` dan `qa-agent/reports/phase6q-release-gate.md`. Fase 6 ditutup 2026-11-24 dengan seluruh gate `REL-01…REL-21` GO, regresi final 169/169, dan penutup tercatat di `pm-agent/progress/status-board.md`. Fase 6t final 2026-11-24 dengan `REL-26` **GO**, regresi 21/21, commit `8507105`, dan push ke `origin/main`. Fase 6u final 2026-11-24 dengan `REL-27` **GO** secara gate QA/docs/deploy: regresi `32 tests, 32 pass, 0 fail`, `YAML OK 3.0.3 56`, dan `git diff --check` OK. Migrasi `030` sudah dijalankan, backup pre-`030` ada (187958 bytes), services sehat, baseline DB `1|1|1|2|10|1|3`. Seluruh task Fase 6u `done` dan gate `REL-27` **GO**; perubahan telah di-commit dan di-push ke `origin/main` di commit `b9f377a` — `Finalisasi Fase 6u — tryout bersesi dan tutup REL-27` — sesuai permintaan user. Fase 6v final 2026-11-24 dengan `REL-28` **GO**: QA `36 tests, 36 pass, 0 fail` (`cbt.mjs`, `tryout.mjs`, `phase6t.mjs`, `phase6u.mjs`, `phase6v.mjs`), `Q6V-01…Q6V-04` lolos, DOC `YAML OK 3.0.3 56` dan `git diff --check` OK, services active, `/health` 200, build frontend sukses, backup pre-6v `/tmp/opencode/bank_soal_db-pre6v-2026-11-24.dump` (332248 bytes), rollback ke `REL-27`, tanpa migrasi DB, baseline DB final `2|3|3|6|40|5|3`. Risiko diterima: nilai kosong mapel lain = 0 bila peserta tidak terdaftar di semua sesi; klien legacy wajib mengirim `event_id`/`eventId` yang valid. Gate `REL-01…REL-27` tetap berlaku dan tidak dibuka ulang; Fase 7 tetap dibatalkan. Seluruh perubahan telah di-commit dan di-push ke `origin/main` di commit `425ce3d` — `Finalisasi Fase 6v — filter dan format laporan tryout` — sesuai permintaan user. Fase 6w dicatat 2026-11-24 dengan `ADR-019` dan gate `REL-29`: sepuluh perubahan pada laporan tryout, jenjang pendidikan, dan kredensial peserta, dengan 2 requirement turunan (login via `username` dan filter jenjang). Seluruh pertanyaan awal dan lanjutan di `ADR-019` sudah dijawab pemilik; tidak ada pertanyaan terbuka untuk Fase 6w. Status `backlog` — PM hanya mencatat requirement dan breakdown; development, deploy, dan commit menunggu permintaan terpisah. Fase 6x dicatat 2026-11-24 dengan `ADR-020` dan gate `REL-30`: tombol `Ubah` + endpoint update tryout (akar masalah: tombol/endpoint edit memang belum ada, bukan blokiran status) serta dua unduhan PDF (soal saja dan soal + kunci). Seluruh pertanyaan di `ADR-020` sudah final: `Ubah` tersedia di semua status, permission `tryout_questions.key_export`, ekspor satu ZIP per klik berisi PDF per sesi untuk kedua varian; status `backlog`.

Fase 6w final 2026-11-24 dengan `REL-29` **GO** dan Fase 6x final 2026-11-24 dengan `REL-30` **GO**: `ADR-019`/`ADR-020` diimplementasikan, migrasi `031` (`jenjang` + seed `SD`/`SMP`/`SMA` + `username` peserta) dan `032` (`tryout_questions.key_export`) sudah dijalankan, backup pre-deploy `/tmp/opencode/bank_soal_db-pre6wx-2026-11-24.dump`, regresi penuh 194/194 (0 fail), backend/presentation `/health` OK, `git diff --check` OK, dan build frontend sukses menghasilkan `dist/assets/index-wgOfGZ4O.js` (326.65 kB, gzip 89.75 kB). Perbaikan lanjutan: helper `withQuery` null-safe mencegah error saat dipanggil tanpa parameter dan mencegah `jenjang_id=null` dikirim ke backend, label menu memakai `&` bukan `&amp;`, dan Combobox menutup opsi setelah dipilih, bisa dibuka ulang, serta meneruskan teks yang diketik. Seluruh perubahan masih di working tree dan belum di-commit/di-push; `REL-01…REL-28` tidak dibuka ulang dan Fase 7 tetap dibatalkan.

Fase 6y dicatat 2026-11-25 dengan `ADR-021` **accepted**: URL sesi membuka hanya sesi target, URL event lama ditolak jelas, tiap sesi minimal 1 lembar soal dengan `question_ids` ditolak, jadwal/CBT/peserta tetap tryout-level, dan format laporan tidak diubah. Implementasi BE/FE/TRY/DOC/QA selesai, regresi penuh 199/199 pass, 0 fail, dan `REL-31` **GO** 2026-11-25; perubahan di-commit di `38af84a` (`Finalisasi Fase 6y — grouping tryout, URL sesi, dan tutup REL-31`) dan sesi Fase 6y dinyatakan tutup.

Fase 6z dicatat 2026-11-25 dengan `ADR-022` **accepted**: Daftar Soal menampilkan jumlah pemakaian pada lembar aktif, import dibatasi CSV/XLSX dengan template valid dan tanpa payload, kredensial siswa/peserta ditampilkan berpasangan dengan tombol copy, serta `Peserta Tryout` diganti `Peserta Umum` dengan alias lama tetap redirect. Requirement R1–R8, AC, dan breakdown PM-30/BE-45/FE-42/QA-42/DOC-13/REL-32 ada di `tasks/phase6z-backlog.md`. Implementasi BE/FE/QA/DOC selesai, regresi penuh 206/206 pass dan 0 fail, build frontend sukses menghasilkan `index-C_etU5Vw.js`, backup pre-`REL-32` tersedia di `/tmp/opencode/bank_soal_db-pre032-2026-11-25.dump`, dan gate `REL-32` **GO** dengan rollback ke `REL-31`; perubahan belum di-commit. Revisi lanjutan memindahkan `Kelola Peserta` dari popup ke halaman `#/tryouts/{id}/peserta` bergaya Peserta Umum dengan form inline A/B.

Fase 6aa dicatat 2026-11-25 dengan `ADR-023` **accepted**: jenjang pendidikan ditambahkan ke soal, import/template, lembar soal, tryout, dan program belajar; kode lembar berubah menjadi `LS-[mapel]-[jenjang]-[mmyy]`; slug tryout tetap auto; kolom `Soal` di Daftar Tryout diganti `Jenjang`. Requirement R1–R8, AC, dan breakdown PM-31/BE-46/FE-43/TRY-23/QA-43/DOC-14/REL-33 ada di `tasks/phase6aa-backlog.md`. Handoff ke Backend, Frontend, Tryout, QA, dan Dokumentasi diterbitkan. Implementasi BE/FE/TRY/QA/DOC selesai, migrasi `034` terpasang setelah backup `/tmp/opencode/bank_soal_db-pre034-2026-11-25.dump`, regresi penuh 216/216 pass dan 0 fail, build frontend sukses menghasilkan `index-H1JcLzJU.js`, health API OK, dan gate `REL-33` **GO** dengan rollback ke `REL-32`; perubahan belum di-commit.

## Ritme Kerja

1. Pastikan setiap task punya ID, owner, prioritas, dependency, dan acceptance criteria.
2. Update `progress/status-board.md` setiap hari kerja.
3. Untuk setiap serah terima, salin `tasks/handoff-template.md` dan isi lengkap.
4. Eskalasi blocker lebih dari 1 hari kerja lewat `decisions/adr-template.md`.
5. Di akhir Fase 3, jalankan release gate bersama QA (`PM-04`).

## Prioritas

- `P0`: wajib selesai sebelum rilis.
- `P1`: penting, boleh menyusul jika tidak menghambat P0.
- `P2`: penyiapan Fase 4.
