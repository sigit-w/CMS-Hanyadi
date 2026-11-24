# Handoff — FE-31

| Field | Isi |
|---|---|
| Task ID | FE-31 |
| Nama task | Popup Kelola Peserta dengan Alur A/B & Hapus Helper Text |
| Agent pengirim | PM |
| Agent penerima | Frontend |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-009-kelola-peserta-tryout.md`, `pm-agent/tasks/phase6q-backlog.md`
- Endpoint / UI: `addTryoutParticipants`, popup `Kelola Peserta`, target `draft`/`manage`
- Bukti (log, screenshot, test result): build `index-D0au7v9d.js`; QP-02/05; helper text tidak ada di source & bundle

## Acceptance Criteria Terpenuhi

- [x] Helper text lama dihapus dari `TryoutManagement.jsx`.
- [x] Popup Kelola Peserta menampilkan daftar + tombol `A. Peserta Didik` dan `B. Peserta Umum`.
- [x] Target `manage` memanggil endpoint attach dan memuat ulang daftar peserta.
- [x] Target `draft` mempertahankan alur Fase 6p.
- [x] Umum baru dari popup Kelola tetap menampilkan PIN dan langsung terlampir.
- [x] Detail/trash tetap sesuai ADR-008.
- [x] Marker QA dan build heap 256 MB sukses.

## Catatan Kendala / Risiko

- `pesertaDialog` saat ini memakai nilai `choice`, `siswa`, `umum`, `manage`; tambahkan state target, bukan nilai baru bila memungkinkan.
- Jangan mengubah state draft saat target `manage`.
- Pastikan picker menonaktifkan siswa yang sudah terlampir.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
