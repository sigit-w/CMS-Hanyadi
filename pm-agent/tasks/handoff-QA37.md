# Handoff — QA-37

| Field | Isi |
|---|---|
| Task ID | QA-37 |
| Nama task | Verifikasi R1–R11 dan regresi Fase 6u |
| Agent pengirim | PM |
| Agent penerima | QA |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `qa-agent/tests/phase6u.mjs` (baru), pembaruan `qa-agent/tests/tryout.mjs`, `qa-agent/tests/cbt.mjs`, `qa-agent/tests/tryout-report.mjs`, `qa-agent/tests/phase6t.mjs`
- Endpoint / UI: `#/tryouts`, `#/reports/tryout`, tryout publik per sesi
- Bukti (log, screenshot, test result): `qa-agent/tests/phase6u.mjs` Q6U-01…Q6U-11 dibuat; `phase6t.mjs` Q6T-01/03/06 diperbarui; regresi final `32 tests, 32 pass, 0 fail` (`cbt.mjs`, `tryout.mjs`, `phase6t.mjs`, `phase6u.mjs`); bug Q6U-11 gate `ends_at` diperbaiki di `backend-agent/src/authRoutes.js` (login `401`, "Batas akhir tryout sudah terlampaui") dan `presentation-service/src/auth.js` (`410`, "Batas akhir tryout telah terlampaui")

## Acceptance Criteria Terpenuhi

- [x] Q6U-01…Q6U-11 menguji R1–R11 termasuk batas waktu dan login ulang
- [x] Regresi `REL-24`, `REL-25`, `REL-26` lolos tanpa perubahan kuota violation
- [x] Ekspor XLSX dibuka dan differensiasi peserta submit vs belum submit
- [x] Fixture tryout/sesi/peserta/submission dibersihkan; DB baseline kembali
- [ ] Laporan hasil dan release gate dibuat di `qa-agent/reports/` — belum ditemukan; bukti regresi final tercatat di handoff ini dan status board

## Catatan Kendala / Risiko

- Marker lama `Lembar`, status `Aktif`, dan `app.js?v=18` akan berubah; update bersama FE-37/TRY-19.
- Jangan mengubah perilaku 401 netral dan debounce 750 ms.
- Sertakan bukti cleanup pada laporan gate.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
