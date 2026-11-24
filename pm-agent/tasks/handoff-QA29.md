# Handoff — QA-29 (Fase 6o)

| Field | Isi |
|---|---|
| Task ID | QA-29A (review desain) + QA-29 (regresi) |
| Nama task | Review ADR-007, uji Peserta Umum, alur Buat Tryout, login tryout, dan gate REL-17 |
| Agent pengirim | PM |
| Agent penerima | QA |
| Tanggal | 2026-11-24 |
| Status | done — QA-29A go, U-01..U-10 lolos, regresi 142/142, `REL-17` GO |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-007-peserta-umum-tryout.md`, `pm-agent/tasks/phase6o-backlog.md`, `pm-agent/tasks/handoff-BE32.md`, `handoff-FE29.md`, `handoff-TRY12.md`
- Target utama: `qa-agent/tests/phase6o.mjs` (baru), `participants.mjs`, `tryout.mjs`, `tryout-report.mjs`, `auth-rbac.mjs`, `phase5.mjs`, `qa-agent/reports/`
- Endpoint / UI: `POST /participants`, `POST /auth/login`, `POST /tryouts`, halaman CMS Buat Tryout, halaman login tryout
- Bukti baseline: regresi terakhir 132/132 pass (`phase6n-report.md`); fitur Umum/PIN belum ada; `free -h` saat distribusi 1.9 GiB total, 541 MiB available, swap 722 MiB / 3.9 GiB

## Acceptance Criteria

- [ ] QA-29A: review ADR-007 dan rencana migrasi 020/021 selesai sebelum DDL diapply. Tandatakan `go`/`no-go` untuk BE-32 di laporan; bila ada keberatan, kembalikan ke PM untuk amendemen.
- [ ] U-01 — Migrasi: kolom `jenis`, `pin_hash`, `start_at`, `end_at`, tabel `tryout_session_sheets`, dan index/check constraint ada; data existing tetap bisa login email+password.
- [ ] U-02 — Positif Umum: buat Peserta Umum melalui payload baru; PIN 9 digit diterima, `pin_hash` tersimpan, plaintext PIN tidak ditemukan di DB, response, atau log; Nama/Sekolah/WA terbaca benar.
- [ ] U-03 — Negatif Umum: PIN 8/10 digit, PIN non-angka, Nama kosong, Sekolah kosong, WA invalid, dan duplikat Nama (abaikan huruf) ditolak dengan kode error yang jelas.
- [ ] U-04 — Login Umum: Nama + PIN menghasilkan `200`, JWT `account_type='participant'`, `/auth/me` menampilkan Nama, `/tryout/questions` `200`, dan submit ke presentation service `200` sesuai sesi aktif.
- [ ] U-05 — Negatif login: PIN salah 5 kali memicu lockout 15 menit; pesan error netral; login Siswa existing tidak ikut terkunci.
- [ ] U-06 — UI CMS: urutan field, label `Nama Tryout`, `datetime-local`, validasi `end > start`, filter lembar soal per mapel, tombol tambah peserta opsional, opsi A placeholder, opsi B modal, dan tombol generate ulang PIN sesuai ADR-007.
- [ ] U-07 — Tryout tanpa peserta: `POST /tryouts` dengan `participant_ids: []` berhasil; `participant_count=0`; lembar soal tetap menentukan daftar soal sesi aktif.
- [ ] U-08 — Kompatibilitas: payload lama `question_ids` dan minimal satu `participant_ids` pada `TR-05` tetap lolos; regresi lama tidak dimodifikasi kontraknya kecuali marker yang memang berubah.
- [ ] U-09 — UI Tryout: label `Nama atau Email peserta` / `Password atau PIN`, aset `styles.css?v=11` dan `app.js?v=12` terlayani, login Umum dan Siswa sama-sama lolos.
- [ ] U-10 — Regresi & gate: jalankan seluruh suite serial dengan heap dibatasi, 0 bug P0/P1, cleanup fixture `qa_umum_%` dan `qa_%@qa.test`, tulis `phase6o-report.md` dan `phase6o-release-gate.md`, lalu rekomendasikan GO/NO-GO untuk `REL-17`.
- [ ] A-12 tidak berubah karena tidak ada permission baru; bila ada usulan permission baru, kembalikan ke PM, jangan langsung luluskan.
- [ ] Laporkan hasil `free -h` sebelum/sesudah build dan regresi, nomor bundle FE, serta versi aset tryout di laporan.

## Catatan Kendala / Risiko

- QA-29A adalah gate sebelum migrasi; QA-29 final baru dapat dijalankan setelah BE-32, FE-29, dan TRY-12 selesai.
- Hati-hati dengan fixture yang mengubah sesi aktif produksi; ikuti pola backup/restore pada `tryout.mjs` dan `tryout-report.mjs`.
- Jalankan satu proses dengan `NODE_OPTIONS=--max-old-space-size=128` untuk test dan `--max-old-space-size=256` untuk build; jangan paralel. Laporkan bila available memory turun di bawah ~200 MiB.
- Jangan menyimpan PIN plaintext di fixture laporan; gunakan PIN uji yang jelas sebagai fixture dan hapus setelah pengujian.
- `REL-17` terpisah dari `REL-15` yang masih partial; gate ini tidak boleh otomatis mengubah status Fase 6m.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
