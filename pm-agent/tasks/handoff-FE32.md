# Handoff — FE-32

| Field | Isi |
|---|---|
| Task ID | FE-32 |
| Nama task | Detail Kredensial & Pendaftaran Prospektus di CMS |
| Agent pengirim | PM |
| Agent penerima | Frontend |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `frontend-agent/src/pages/TryoutManagement.jsx`, `PesertaManagement.jsx`, `ProspektusManagement.jsx`, `frontend-agent/src/api.js`
- Endpoint / UI: `#/tryouts`, `#/bimbel/siswa`, `#/tryouts/prospektus`
- Bukti (log, screenshot, test result): build produksi Vite sukses, marker QA `PS-01..PS-06`

## Acceptance Criteria Terpenuhi

- [x] Detail peserta menampilkan PIN/Password dari endpoint detail.
- [x] Baris Prospektus diklik membuka detail dan tombol daftar sebagai siswa.
- [x] Status `Bergabung` tampil setelah pendaftaran.
- [x] Validasi form sesuai kontrak backend.

## Catatan Kendala / Risiko

- Gunakan endpoint detail; jangan menampilkan kredensial dari endpoint list.
- Jangan menampilkan password user CMS di UI manajemen user.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
