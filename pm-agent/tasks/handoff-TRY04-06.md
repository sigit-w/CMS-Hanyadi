# Handoff — TRY-04..TRY-06 (Fase 6)

| Field | Isi |
|---|---|
| Task ID | TRY-04, TRY-05, TRY-06 |
| Nama task | Login & gate akses tryout, kredensial cookie, regresi alur tryout |
| Agent pengirim | PM |
| Agent penerima | Tryout |
| Tanggal | 2026-11-22 |
| Status | review |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-001-auth-role.md`, `pm-agent/tasks/phase6-backlog.md`
- Endpoint / UI: halaman login tryout, gate anteseden daftar soal, pembahasan, dan skor
- Bukti (log, screenshot, test result): `qa-agent/reports/tryout-report.md` (52 test lolos sebelum perubahan)

## Acceptance Criteria Terpenuhi

- [x] Requirement login wajib untuk tryout dan matriks `tryout.access` ditetapkan di ADR-001.
- [x] Regresi menjadi AC tersendiri (`TRY-06`) karena tryout sudah rilis (`REL-01`).
- [ ] Belum: endpoint `/auth/*` dari `BE-14` dan verifikasi JWT di `PRES-01`.

## Catatan Kendala / Risiko

- Tanpa sesi aktif, jangan merender daftar soal, opsi, kunci, pembahasan, atau skor — termasuk saat aset statis dibuka langsung.
- Gunakan `credentials: 'include'` untuk request ke API dan presentation service; tangani 401 dengan pesan dan kembali ke login.
- Sesi lintas subdomain bergantung pada cookie `Domain=.hanyadi.web.id` (`INF-02`).
- Koordinasi dengan Infra bila `auth_request` dipakai untuk mengamankan aset statis (`INF-03`).

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
