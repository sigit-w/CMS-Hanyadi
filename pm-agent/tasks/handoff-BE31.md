# Handoff — BE-31 (Fase 6n)

| Field | Isi |
|---|---|
| Task ID | BE-31 |
| Nama task | Verifikasi kontrak & dokumentasi endpoint Siswa dan Program Belajar untuk grup Manajemen Bimbel |
| Agent pengirim | PM |
| Agent penerima | Backend |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-006-manajemen-bimbel.md`, `pm-agent/tasks/phase6n-backlog.md`, `pm-agent/progress/status-board.md`; target dokumentasi `backend-agent/README.md` dan `backend-agent/openapi/openapi.yaml` bila perlu
- Endpoint / UI: `GET/POST/PUT/DELETE /api/v1/participants`, `GET/POST/PUT/DELETE /api/v1/program-belajar`; UI CMS grup `Manajemen Bimbel` (FE-28)
- Bukti: commit `3597617` sudah berisi endpoint dan permission saat ini; baseline `free -h` 2026-11-24: 1.9 GiB total, 673 MiB available, swap 687 MiB / 3.9 GiB

## Acceptance Criteria Terpenuhi

- [x] Mengonfirmasi tidak ada perubahan schema, endpoint, format respons `{ ok, data, meta }`, atau validasi yang diminta untuk Fase 6n.
- [x] Mengonfirmasi `Kelola Siswa` tetap memakai `tryouts.manage` pada `/api/v1/participants` dan `Kelola Program Belajar` tetap memakai `program_belajar.manage` pada `/api/v1/program-belajar`.
- [x] Mengonfirmasi tidak ada permission baru `bimbel.manage`, sehingga tidak ada perubahan `GET /permissions`, Kelola Role, atau tabel `role_permissions`.
- [x] Dokumentasi backend/OpenAPI tidak menyiratkan bahwa endpoint dipindah ke namespace `/bimbel`; perubahan hanya pada pengelompokan menu CMS.
- [x] Jika dokumentasi perlu dirapikan, perubahan bersifat teks saja dan tidak memerlukan migrasi atau restart API khusus.
- [x] Hasil verifikasi dicatat singkat di laporan/task backend dan dikirim ke QA sebagai input QA-28.

## Catatan Kendala / Risiko

- BE-31 adalah task verifikasi, bukan task implementasi. Jangan menambah rute alias `/bimbel/*` di backend; alias hanya berada di hash route frontend sesuai ADR-006/D2.
- Jangan menyentuh aplikasi tryout atau presentation service; keduanya tidak termasuk lingkup perubahan.
- Koordinasikan dengan FE-28 bila ada ketidaksesuaian nama permission di UI; keputusan final ada di PM sesuai ADR-006/D3.

## Hasil Verifikasi 2026-11-24

- Query DB produksi: `program_belajar.manage` dan `tryouts.manage` tetap ada; `program_belajar`, `program_belajar_schedules`, dan `tryout_participants.program_belajar_id` tetap terpasang (`t|t|t`).
- `GET /health` → `200`; `GET /api/v1/participants` dan `GET /api/v1/program-belajar` tanpa cookie → `401`, menunjukkan guard permission masih aktif.
- Sumber `participantRoutes.js:11` memakai `authorize('tryouts.manage')`; `programBelajarRoutes.js:10` memakai `authorize('program_belajar.manage')`. Tidak ada perubahan kode backend yang dibutuhkan.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
