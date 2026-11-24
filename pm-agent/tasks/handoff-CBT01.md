# Handoff — Mode CBT Lengkap (CBT-01)

| Field | Isi |
|---|---|
| PM | PM-23 |
| ADR | `pm-agent/decisions/ADR-013-mode-cbt.md` |
| Backlog | `pm-agent/tasks/cbt-backlog.md` |
| Gate | REL-23 |
| Status | Selesai; arsip serah terima |

## Keputusan Ringkas

- Mode CBT bersifat opsional per tryout; non-CBT tetap memakai alur lama.
- Skor dihitung server dan hanya muncul di laporan admin.
- Acak soal/opsi deterministik dari seed dan dikonfigurasi admin.
- Satu attempt per `(session_id, participant_id)`; finalize mengunci attempt.
- Fase 7 tidak dibuka.

## BE-38 — Backend

- Backup DB sebelum migrasi: `/tmp/opencode/bank_soal_db-pre027-2026-11-24.dump`.
- Migration: `db/migrations/027_cbt_exam_mode.sql`, idempoten, owner `bank_soal_user`.
- Endpoint: `PATCH /api/v1/tryouts/{id}/cbt`; create/list/detail tryout menyertakan `cbt_*`.
- Laporan: `GET /api/v1/reports/tryout` menyertakan `attempts` dan `violations`.
- Dokumen: `backend-agent/README.md`, `backend-agent/openapi/openapi.yaml`, `db/README.md`, `db/schema.sql`.
- Verifikasi: `node --check` dan QA `CBT-01`, `CBT-03`.

## PRES-05 — Presentation

- Endpoint: `/api/v1/presentation/cbt/attempt/{start,autosave,flag,violation,finalize}` dan `GET .../attempt`.
- Helper: seeded shuffle, deadline enforcement, draft grading, dan submission transaksional.
- Payload peserta tidak mengandung skor, kunci, atau status benar/salah.
- Opsi mengirim `key` asli dan `label` tampilan A/B/C/D.
- Auto-submit saat `violation_count > cbt_max_violations` jika batas aktif.
- Verifikasi: `node --check` dan QA `CBT-02…CBT-05`.

## FE-35 — Frontend CMS

- `TryoutManagement.jsx`: form CBT, dialog **Atur CBT**, kolom **Mode**.
- `TryoutReport.jsx`: tabel **Attempt CBT** dan **Log Pelanggaran**.
- `api.js`: `updateTryoutCbt(id, payload)`.
- Verifikasi: `NODE_OPTIONS=--max-old-space-size=256 npm run build`.

## TRY-17 — Tryout Agent

- Timer, countdown, autosave, flag ragu-ragu, submit akhir, dan lock state.
- Guards: `tab_hidden`, `window_blur`, `fullscreen_exit`, `paste`.
- Non-CBT terdeteksi dari `409 Tryout ini tidak menggunakan mode CBT` dan memakai alur lama.
- Bump aset ke `styles.css?v=14` dan `app.js?v=15`.
- Verifikasi: `node --check app.js` dan QA regresi tryout.

## QA-35 — QA

- File: `qa-agent/tests/cbt.mjs`.
- Skenario:
  - `CBT-01` pengaturan admin tersimpan dan state peserta tanpa skor.
  - `CBT-02` urutan soal/opsi diacak deterministik dengan label tampilan.
  - `CBT-03` autosave, flag, dan violation log tersimpan tanpa feedback.
  - `CBT-04` finalize mengubah draft menjadi submission benar dan mengunci attempt.
  - `CBT-05` deadline terlewat menolak autosave dan finalize.
- Perintah regresi:
  ```sh
  sudo bash -c 'set -a; . /opt/virtual-office-bank-soal/backend-agent/.env; set +a; export QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD"; NODE_OPTIONS=--max-old-space-size=128 npm test'
  ```
- Target: 179/179 lolos, 0 P0/P1.

## DOC-06CBT & REL-23

- Selaraskan ADR-013, backlog, handoff, status board, laporan sistem, QA report, dan release gate.
- Restart service, verifikasi health/CMS/tryout, commit/push, lalu tandai `REL-23 GO`.
