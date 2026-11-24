# Handoff — FE-37

| Field | Isi |
|---|---|
| Task ID | FE-37 |
| Nama task | Form tryout bersesi, picker prospektus, dan laporan Fase 6u |
| Agent pengirim | PM |
| Agent penerima | Frontend |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `frontend-agent/src/pages/TryoutManagement.jsx`, `frontend-agent/src/pages/TryoutReport.jsx`, `frontend-agent/src/api.js`, `frontend-agent/src/App.jsx` jika perlu rute/alias
- Endpoint / UI: `#/tryouts`, `#/reports/tryout`
- Bukti (log, screenshot, test result): build frontend lolos; form induk/sesi, picker prospektus + search, hapus opsi aktif/kolom `Lembar` dan kolom `Submission` tanpa pengganti, status, durasi per sesi, laporan 7 kolom, tombol Excel, toggle log pelanggaran; Q6U-01…Q6U-11 lolos

## Acceptance Criteria Terpenuhi

- [x] Form induk dengan kartu sesi; tiap sesi tepat satu mapel, lembar, dan durasi CBT sendiri
- [x] Opsi `jadikan sesi aktif` dan kolom `Lembar` hilang; fieldset pemilih lembar tetap ada
- [x] Dialog Peserta Umum menampilkan tab siswa + prospektus dengan form pencarian
- [x] Kolom status menampilkan `terjadwal`/`berlangsung`/`selesai`; kolom `Submission` dihapus tanpa pengganti
- [x] Tabel laporan tepat `Nama|Sekolah|Mapel|Jumlah Soal|Benar|Salah|Nilai`
- [x] Tombol unduh Excel memanggil endpoint BE-40
- [x] Log pelanggaran default tersembunyi dan muncul setelah `Lihat detail`

## Catatan Kendala / Risiko

- Jangan menghapus fieldset `Lembar Soal`; QA lama masih memakai marker tersebut.
- Perubahan status marker/teks perlu sinkron dengan QA-37.
- Konfirmasi pemilik masih diperlukan untuk penghapusan tombol `Aktifkan` di halaman laporan.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
