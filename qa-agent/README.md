# QA Agent — Quality Assurance

## Fungsi

Menyusun checklist pengujian fungsional, memvalidasi data dan edge case, menguji API dan UI, serta menentukan kriteria *bug-free* sebelum rilis.

## Peta Direktori

| Path | Fungsi |
|---|---|
| `checklists/functional.md` | Checklist alur fungsional utama |
| `checklists/data-validation.md` | Checklist integritas & edge case data |
| `checklists/api-ui.md` | Checklist uji API dan UI |
| `test-cases/phase3.md` | Test case terstruktur Fase 3 |
| `reports/release-gate.md` | Template laporan keputusan rilis |
| `reports/phase6o-report.md` | Laporan QA Fase 6o: ADR-007, U-01..U-10, regresi 142/142 |
| `reports/phase6o-release-gate.md` | Keputusan gate `REL-17` Fase 6o |
| `reports/phase6p-report.md` | Laporan QA Fase 6p: ADR-008, PR-01..PR-08, regresi 150/150 |
| `reports/phase6p-release-gate.md` | Keputusan gate `REL-18` Fase 6p |

## Severity Bug

| Level | Definisi |
|---|---|
| P0 | Menggagalkan rilis: data rusak, API mati, tidak bisa input soal |
| P1 | Fungsi utama terganggu tetapi ada workaround |
| P2 | Kosmetik atau peningkatan kecil |

## Kriteria Bug-Free

- Tidak ada bug P0 dan P1.
- Semua acceptance criteria task Fase 3 `done`.
- `/health` API 200 dan koneksi DB stabil.
- Mapel wajib, kunci jawaban, dan status `approved` konsisten dengan ADR-004; `draft`/`review` ditolak.
- Kontrak Fase 6j: tanpa versi/readiness, pagination 20, stem non-bold; endpoint lama mengembalikan 404.

## Task Fase 3

Lihat `docs/phase3-tasks.md` rentang `QA-01` sampai `QA-06`.
