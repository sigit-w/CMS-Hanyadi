# Handoff — FE-10..FE-13 (Fase 6)

| Field | Isi |
|---|---|
| Task ID | FE-10, FE-11, FE-12, FE-13 |
| Nama task | Login & session guard CMS, UI manajemen role, RBAC UI, build & regresi |
| Agent pengirim | PM |
| Agent penerima | Frontend |
| Tanggal | 2026-11-22 |
| Status | review |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-001-auth-role.md`, `pm-agent/tasks/phase6-backlog.md`
- Endpoint / UI: halaman `/login`, guard CMS, halaman manajemen role & penugasan user
- Bukti (log, screenshot, test result): kontrak OpenAPI akan diserahkan Backend pada `BE-16`

## Acceptance Criteria Terpenuhi

- [x] Requirement, prioritas, dependency, dan AC tercantum di backlog Fase 6.
- [x] Matriks permission role tersedia di ADR-001 sebagai acuan UI.
- [ ] Belum: kontrak OpenAPI final dari `BE-16` — jangan menebak bentuk respons.

## Catatan Kendala / Risiko

- Mulai dari `FE-10` setelah endpoint `/auth/*` tersedia (`BE-14`); `FE-11`/`FE-12` menunggu kontrak `BE-15`/`BE-16`.
- Sembunyikan tombol sesuai permission hanya untuk kenyamanan; pengaman utama ada di middleware backend.
- Semua request memakai `credentials: 'include'`; token tidak boleh disimpan di `localStorage`.
- Jangan regressi alur input/upload/filter/readiness yang sudah rilis di Fase 3–5.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
