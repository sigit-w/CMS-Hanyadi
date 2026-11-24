# Handoff — TRY-13

| Field | Isi |
|---|---|
| Task ID | TRY-13 |
| Nama task | Verifikasi Non-regresi Aplikasi Tryout |
| Agent pengirim | PM |
| Agent penerima | Tryout |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-008-peserta-tryout-dan-prospektus.md`
- Endpoint / UI: tidak ada perubahan kode; verifikasi login Nama + PIN dan Email + Password
- Bukti (log, screenshot, test result): `git status --short -- tryout-agent` bersih; U-04/U-09 dan T-01..T-08 lolos

## Acceptance Criteria Terpenuhi

- [x] Source `tryout-agent` tidak diubah.
- [x] Smoke login Peserta Umum menggunakan Nama + PIN lolos.
- [x] Smoke login Peserta Siswa menggunakan Email + Password lolos.
- [x] Aset `styles.css?v=11` dan `app.js?v=12` tetap aktif.

## Catatan Kendala / Risiko

- Jangan mengubah sesi aktif produksi saat smoke login.
- Koordinasikan dengan QA-30 agar fixture tidak saling menimpa.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
