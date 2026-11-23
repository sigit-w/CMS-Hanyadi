# Virtual Office — Bank Soal

Workspace Virtual Office Software House untuk pengelolaan bank soal berbasis PostgreSQL.

## Peta Direktori

| Path | Fungsi |
|---|---|
| `README.md` | Ringkasan proyek dan peta direktori |
| `docs/architecture.md` | Arsitektur sistem, model data, kontrak API, batasan resource |
| `docs/agent-workflow.md` | Peran agent, alur serah terima, definisi selesai, critical-to-release |
| `docs/phase3-tasks.md` | Daftar task terstruktur Fase 3 per agent |
| `db/schema.sql` | Skema awal PostgreSQL (mapel, soal, opsi/kunci, sumber, multi-versi) |
| `db/README.md` | Cara menerapkan skema dan catatan integritas data |
| `pm-agent/` | Backlog, status board, template handoff, log keputusan |
| `backend-agent/` | Implementasi REST API Node.js + validasi + ingestion |
| `frontend-agent/` | Implementasi CMS React (input, upload, filter soal) |
| `qa-agent/` | Checklist pengujian, test case, release gate report |
| `scripts/` | Skrip operasional bersama (dibutuhkan di Fase 3) |

## Prinsip

- Satu sumber kebenaran data: PostgreSQL `bank_soal_db`.
- Kontrak API ditulis lebih dulu oleh backend, dikonsumsi frontend, diverifikasi QA.
- Setiap serah terima memiliki artifact tertulis dan kriteria penerimaan.
- Ramah lingkungan 2 vCPU / 2GB RAM: tanpa service baru di Fase 2, pool koneksi kecil di Fase 3.

Lihat `docs/phase3-tasks.md` untuk pekerjaan yang siap dijalankan.
