# Handoff — TRY-23

| Field | Isi |
|---|---|
| Task ID | TRY-23 |
| Nama task | Verifikasi non-regresi aplikasi peserta terhadap jenjang baru |
| Agent pengirim | PM |
| Agent penerima | Tryout/Presentation |
| Tanggal | 2026-11-25 |
| Status | review |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-023-jenjang-pendidikan-soal-lembar-tryout-program.md`, `pm-agent/tasks/phase6aa-backlog.md`
- Endpoint / UI: `https://tryout.hanyadi.web.id/{slug}`, login peserta, sesi tryout, submit jawaban, halaman laporan
- Bukti: masukan pemilik 2026-11-25 dan keputusan D8 ADR-023

## Acceptance Criteria Terpenuhi

- [ ] AC8: login peserta tetap memakai username/password atau PIN existing dan tidak berubah karena `jenjang_id` baru
- [ ] AC8: URL sesi berbasis slug tetap berfungsi; URL slug tryout lama tetap ditolak jelas seperti `REL-31`
- [ ] AC8: peserta melihat soal dari lembar yang sudah berjenjang tanpa perlu memilih jenjang di aplikasi peserta
- [ ] AC8: submit global, batas pelanggaran CBT, dan format laporan tidak berubah

## Catatan Kendala / Risiko

- Tidak ada perubahan UI yang diminta di aplikasi peserta; task ini hanya verifikasi dan perbaikan bila regresi muncul.
- Jangan mengubah URL canonical, mekanisme JWT scope per sesi, atau format ekspor laporan.
- Jika ditemukan soal beda jenjang pada satu lembar, laporkan ke BE-46/FE-43, jangan menyembunyikannya di presentation.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
