# Agent Workflow — Virtual Office Bank Soal

## 1. Peran

| Agent | Tanggung Jawab | Artifact Utama |
|---|---|---|
| `pm-agent` | Memecah tugas, menentukan prioritas, memantau progres, mengatur serah terima | `docs/phase3-tasks.md`, `pm-agent/progress/status-board.md`, handoff |
| `backend-agent` | REST API Node.js, koneksi PostgreSQL, validasi input/upload, kunci jawaban | `backend-agent/src/`, `backend-agent/openapi/` |
| `frontend-agent` | Dashboard CMS React, input soal, upload/pengumpulan, filter mapel, daftar soal dengan pagination 20 dan stem non-bold | `frontend-agent/src/` |
| `qa-agent` | Checklist fungsional, validasi data/edge case, uji API & UI, release gate | `qa-agent/checklists/`, `qa-agent/test-cases/`, `qa-agent/reports/` |

## 2. Status Task

| Status | Arti |
|---|---|
| `backlog` | Tercatat di backlog, belum diprioritaskan |
| `ready` | Prioritas dan acceptance criteria jelas, siap diambil |
| `in_progress` | Sedang dikerjakan oleh satu agent |
| `review` | Menunggu peninjauan agent lain / QA |
| `done` | Acceptance criteria terpenuhi |
| `blocked` | Ada hambatan; PM wajib mencatat penyebab dan pemilik resolusi |

Status `review` di atas adalah status **task antar-agent**, bukan status soal. Status soal aktif adalah `approved` (ADR-004/Fase 6j); `draft` dan `review` sudah dihapus.

## 3. Alur Serah Terima

1. **PM** membuat task ID, prioritas, dependency, dan acceptance criteria.
2. **Backend** menulis kontrak API di `backend-agent/openapi/` lebih dulu.
3. **Frontend** mengonsumsi kontrak tersebut untuk membangun UI; tidak boleh menebak bentuk respons.
4. **Backend** menyelesaikan endpoint + test, lalu menandai `review`.
5. **Frontend** menyelesaikan alur UI + test, lalu menandai `review`.
6. **QA** menjalankan checklist API, UI, dan integritas data; membuka bug dengan ID `BUG-xxx`.
7. **PM** melakukan release gate: semua task `done` dan tidak ada bug P0/P1.
8. Jika gagal, task kembali ke agent pemilik dengan catatan QA, bukan langsung ditutup.

## 4. Format Handoff

Template: `pm-agent/tasks/handoff-template.md`

Field wajib:

- Task ID dan nama
- Agent pengirim dan penerima
- Artifact yang diserahkan (path file / endpoint / screenshot)
- Acceptance criteria yang sudah terpenuhi
- Catatan kendala atau risiko
- Status: `review`, `blocked`, atau `done`

## 5. Definition of Done per Agent

**PM**

- Task memiliki ID, prioritas (P0/P1/P2), dependency, dan acceptance criteria.
- Status board diperbarui setiap hari kerja.
- Setiap blocked task memiliki pemilik resolusi dan target waktu.

**Backend**

- Endpoint sesuai kontrak OpenAPI, validasi input aktif, query parametrized.
- Test unit/integrasi lulus, termasuk edge case mapel dan kunci jawaban.
- Error envelope konsisten; tidak ada secret di kode.

**Frontend**

- Alur input manual, upload, dan filter mapel berfungsi end-to-end.
- State loading/error ditangani, validasi form sesuai aturan backend.
- Daftar soal memakai pagination 20 dan stem ditampilkan tanpa bold (ADR-004).

**QA**

- Semua checklist terisi dengan hasil `pass`/`fail` dan bukti.
- Bug dicatat dengan severity, langkah reproduksi, hasil yang diharapkan.
- Laporan release gate ditandatangani oleh QA dan PM.

## 6. Kriteria Bug-Free Sebelum Rilis

- Tidak ada bug `P0` (menggagalkan rilis) atau `P1` (fungsi utama rusak).
- Semua acceptance criteria task Fase 3 berstatus `done`.
- `/health` API mengembalikan 200 dan koneksi ke `bank_soal_db` stabil.
- Integritas data: setiap soal approved memiliki minimal satu opsi benar atau kunci teks, dan mapel termasuk tiga mapel wajib.
- Tidak ada regresi pada alur input, upload, filter, pagination, dan tampilan stem tanpa bold.

## 7. Eskalasi

- Blocker lebih dari 1 hari kerja: PM menggelar keputusan cepat dan mencatat di `pm-agent/decisions/`.
- Konflik kontrak API: keputusan final ada di PM setelah mendengar Backend dan Frontend.
- Perubahan schema: wajib lewat PM dan QA, lalu diperbarui di `db/schema.sql` dan `docs/architecture.md`.
