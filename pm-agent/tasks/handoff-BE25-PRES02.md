# Handoff — BE-25 / PRES-02 (Fase 6j)

| Field | Isi |
|---|---|
| Task ID | BE-25, PRES-02 |
| Nama task | Migrasi status & penghapusan versi dari kontrak API; presentation service baca tabel inti |
| Agent pengirim | PM |
| Agent penerima | Backend, Presentation |
| Tanggal | 2026-11-23 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-004-penyederhanaan-soal.md`, `pm-agent/tasks/phase6j-backlog.md`
- Endpoint / UI: `/api/v1/questions`, `/api/v1/questions/:id`, `/api/v1/tryout/questions`, `/api/v1/presentation/questions/:id`, `/submit`, `/attempts/summary`
- Bukti: status board Fase 6i `REL-09` GO; QA `phase6-release-gate.md` 99/99 pass

## Acceptance Criteria Terpenuhi

- [x] Requirement pemilik proyek diturunkan menjadi task ber-ID dengan owner, prioritas, dependency, dan AC.
- [x] Keputusan status kanonik, migrasi data, dan strategi "versi nonaktif, data tetap" ditetapkan di ADR-004.
- [x] Migrasi `015`, backend, dan presentation service selesai; QA 118/118 lolos; REL-10 GO.

## Catatan Kendala / Risiko

- Migrasi `015` wajib dijalankan sebelum restart API/presentation; update `draft`/`review` → `approved` harus idempoten.
- Jangan menghapus tabel versi/varian/kolom `tryout_submissions.version`; tulis konstan `'v1'` secara internal.
- `insertQuestion()` dan import wajib menghasilkan `approved`. `GET /questions` tetap mengembalikan `pagination` dengan `limit` default 20.
- Hilangkan field `readiness`, `ready_version_count`, `is_multi_version_ready` dari response; hapus `ready_version`, `version`, endpoint `/presentation-versions`, `/readiness`, `/variants` dari OpenAPI.
- Presentation service mengganti gate `is_ready` dengan `q.status='approved'`; opsi dan kunci jawaban diambil dari `question_options`/`answer_keys`.
- Jalankan test dengan `NODE_OPTIONS=--max-old-space-size=128` agar tidak OOM.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
