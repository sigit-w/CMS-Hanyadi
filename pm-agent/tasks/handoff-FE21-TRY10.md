# Handoff — FE-21 / TRY-10 (Fase 6j)

| Field | Isi |
|---|---|
| Task ID | FE-21, TRY-10 |
| Nama task | CMS: hapus UI versi + pagination 20 + stem non-bold; Tryout: hapus picker versi + stem non-bold |
| Agent pengirim | PM |
| Agent penerima | Frontend, Tryout |
| Tanggal | 2026-11-23 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-004-penyederhanaan-soal.md`, `pm-agent/tasks/phase6j-backlog.md`
- Endpoint / UI: `#/` (Daftar Soal), halaman tryout peserta
- Bukti: kontrak backend Fase 6i (99/99 test lolos) sebelum perubahan Fase 6j

## Acceptance Criteria Terpenuhi

- [x] Requirement tampilan dan pagination dinyatakan dalam AC backlog.
- [x] Kontrak BE-25/PRES-02 dikonsumsi; build CMS sukses; tryout `?v=10`; QA 118/118 lolos.

## Catatan Kendala / Risiko

- Tunggu kontrak BE-25/PRES-02 sebelum menghapus pemanggilan `getVersions()`, `setReadiness()`, dan parameter `version`.
- Filter status CMS hanya menampilkan `approved` dan `archived`; jangan tampilkan `draft`/`review`.
- Stem di `Dashboard.jsx` jangan memakai `font-medium`; di tryout ganti `<strong>` dengan elemen biasa dan set `font-weight: 400` pada CSS daftar/detail.
- Pagination CMS: kirim `page`/`limit=20`; ganti virtual scroll dengan kontrol halaman Prev/Next, reset ke halaman 1 saat filter berubah.
- Build produksi memakai `NODE_OPTIONS=--max-old-space-size=256` secara bergiliran; jangan parallel dengan test/build lain.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
