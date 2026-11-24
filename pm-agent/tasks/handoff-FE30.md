# Handoff — FE-30

| Field | Isi |
|---|---|
| Task ID | FE-30 |
| Nama task | Picker Peserta Didik, Detail, Trash Icon & Halaman Prospektus |
| Agent pengirim | PM |
| Agent penerima | Frontend |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-008-peserta-tryout-dan-prospektus.md`, `pm-agent/tasks/phase6p-backlog.md`
- Endpoint / UI: `removeTryoutParticipant`, `getProspektus`, `#/tryouts/prospektus`, label `Kelola Siswa`
- Bukti (log, screenshot, test result): bundle `index-CIWSCIZ4.js`, PR-02/PR-03/PR-06 lolos, build heap 256 MB sukses

## Acceptance Criteria Terpenuhi

- [x] Siswa tidak tampil default di daftar peserta tryout.
- [x] Dialog A menampilkan siswa aktif dengan tombol `Pilih`; dialog B tetap seperti Fase 6o.
- [x] Baris peserta terlampir klik → dialog detail.
- [x] Tidak ada checkbox pada daftar peserta terlampir; icon `Trash2` tersedia.
- [x] Notifikasi hapus berbeda untuk Umum dan Siswa.
- [x] Menu Prospektus berada di grup Manajemen Tryout dan menampilkan data dari `GET /prospektus`.
- [x] Marker `phase5.mjs` disesuaikan; build sukses dengan heap 256 MB.

## Catatan Kendala / Risiko

- `TryoutManagement.jsx` masih meng-import `Checkbox` untuk Lembar Soal dan `Jadikan sesi aktif`; jangan menghapus import tersebut.
- Data siswa tetap dimuat di state untuk picker/detail, hanya tidak dirender sebelum dipilih.
- Jangan memanggil `deleteParticipant`; pakai `removeTryoutParticipant`.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
