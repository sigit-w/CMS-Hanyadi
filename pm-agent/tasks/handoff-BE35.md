# Handoff — BE-35

| Field | Isi |
|---|---|
| Task ID | BE-35 |
| Nama task | Tabel Siswa/Prospektus, Kredensial & Endpoint Pendaftaran |
| Agent pengirim | PM |
| Agent penerima | Backend |
| Tanggal | 2026-11-24 |
| Status | review |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-010-siswa-prospektus-kredensial.md`, `pm-agent/tasks/phase6r-backlog.md`
- Endpoint / UI: `GET /participants/{id}/detail`, `GET /prospektus/{id}`, `POST /prospektus/{id}/daftar`
- Bukti (log, screenshot, test result): migrasi `db/migrations/024_siswa_prospektus_kredensial.sql`, OpenAPI, `db/README.md`, health 8082 `200`

## Acceptance Criteria Terpenuhi

- [x] Tabel fisik `siswa` dan `prospektus` dengan struktur identik + `bergabung`.
- [x] Peserta Umum dari form tryout tersimpan di `prospektus` dan tetap bisa login.
- [x] Detail mengembalikan password/PIN plaintext; list tidak mengembalikan kredensial.
- [x] Pendaftaran prospek menyalin ke `siswa` dan menandai `bergabung`.
- [x] Password CMS tetap hash scrypt.
- [x] Trigger integritas participant_id berlaku untuk kedua tabel.

## Catatan Kendala / Risiko

- Backup DB wajib sebelum DDL.
- View `tryout_participants` dipertahankan untuk kompatibilitas QA/laporan.
- Plaintext kredensial hanya untuk peserta, bukan user CMS.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
