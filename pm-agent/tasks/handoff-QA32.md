# Handoff — QA-32

| Field | Isi |
|---|---|
| Task ID | QA-32 |
| Nama task | Uji Alur Siswa/Prospektus & Kredensial |
| Agent pengirim | PM |
| Agent penerima | QA |
| Tanggal | 2026-11-24 |
| Status | review |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-010-siswa-prospektus-kredensial.md`, `pm-agent/tasks/phase6r-backlog.md`, `qa-agent/tests/phase6r.mjs`
- Endpoint / UI: `POST /participants` (umum), detail peserta, `POST /prospektus/{id}/daftar`, halaman Prospektus
- Bukti (log, screenshot, test result): `qa-agent/reports/phase6r-report.md`, `phase6r-release-gate.md`

## Acceptance Criteria Terpenuhi

- [x] `PS-01`: Umum tersimpan di `prospektus`, bukan `siswa`, dan tetap login.
- [x] `PS-02`: detail menampilkan PIN/password; list tidak membocorkan kredensial.
- [x] `PS-03`: prospek didaftarkan menjadi siswa; `bergabung=true`.
- [x] `PS-04`: password CMS tetap hash dan tidak tampil.
- [x] `PS-05`: integritas participant_id berlaku untuk kedua tabel.
- [x] `PS-06`: marker bundle CMS tersedia.
- [x] `PS-07`: regresi penuh lolos, gate `REL-20 GO`.

## Catatan Kendala / Risiko

- Jalankan test berurutan dengan `NODE_OPTIONS=--max-old-space-size=128`.
- Test lama memakai view `tryout_participants`; pastikan trigger `INSTEAD OF DELETE` bekerja.
- Jangan mengubah sesi aktif produksi tanpa koordinasi PM.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
