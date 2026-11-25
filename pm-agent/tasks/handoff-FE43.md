# Handoff — FE-43

| Field | Isi |
|---|---|
| Task ID | FE-43 |
| Nama task | Jenjang pendidikan pada Buat Soal, Daftar Soal, Lembar Soal, Tryout, dan Program Belajar |
| Agent pengirim | PM |
| Agent penerima | Frontend |
| Tanggal | 2026-11-25 |
| Status | review |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-023-jenjang-pendidikan-soal-lembar-tryout-program.md`, `pm-agent/tasks/phase6aa-backlog.md`
- Endpoint / UI: halaman Buat Soal, Daftar Soal, Lembar Soal, Buat/Daftar Tryout, Kelola Program Belajar
- Bukti: masukan pemilik 2026-11-25 dan pemetaan pada `frontend-agent/src/pages/QuestionInput.jsx`, `Dashboard.jsx`, `QuestionSheets.jsx`, `TryoutManagement.jsx`, `ProgramBelajarManagement.jsx`, `frontend-agent/src/api.js`, serta template `frontend-agent/public/templates/template-soal.csv|xlsx`

## Acceptance Criteria Terpenuhi

- [ ] AC2: select Jenjang tersedia di form Buat Soal; filter jenjang tersedia di Daftar Soal dan bagian Daftar Soal pada halaman Buat Soal; payload dan query memakai kontrak BE-46
- [ ] AC3: tautan template tetap tersedia dan pesan error import menyebut kolom `jenjang`
- [ ] AC4: urutan field Lembar Soal sesuai request; kode disabled sampai jenjang + mapel terisi; picker memakai jenjang + mapel; Daftar Lembar Soal memiliki kolom Jenjang
- [ ] AC5: urutan field Tryout sesuai request; slug menjadi auto-readonly dan tidak dikirim manual; validasi jenjang sebelum jadwal; opsi lembar mengikuti jenjang tryout
- [ ] AC6: header Daftar Tryout mengganti `Soal` dengan `Jenjang`; status filter dan tombol copy ikon existing tidak berubah
- [ ] AC7: form dan tabel Program Belajar menampilkan jenjang dari `GET /api/v1/jenjangs`
- [ ] AC8: build frontend lolos dan marker QA baru terpenuhi

## Catatan Kendala / Risiko

- Semua opsi jenjang harus berasal dari `GET /api/v1/jenjangs`; jangan hardcode daftar di komponen.
- Filter Daftar Soal harus dikirim ke API agar pagination dan total konsisten, bukan filter client-side saja.
- Kode lembar berubah otomatis saat jenjang/mapel berubah dan harus meng-clear pilihan soal lama.
- Tombol salin URL Daftar Tryout hasil revisi terakhir memakai satu ikon `Copy`; jangan kembali ke tombol per sesi.
- Popup Atur CBT sudah dihapus dari Daftar Tryout; jangan memunculkannya kembali.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
