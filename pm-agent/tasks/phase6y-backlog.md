# Backlog — Fase 6y: Flow Tryout, Grouping, dan URL Sesi

| Field | Isi |
|---|---|
| Fase | Fase 6y |
| Gate | `REL-31` |
| Tanggal | 2026-11-25 |
| ADR | `ADR-021` |
| Status | BE/FE/TRY/DOC/QA selesai; regresi penuh 199/199; `REL-31` **GO** 2026-11-25 |
| Pemilik | PM |
| Melanjutkan | Fase 6x / `REL-30` (GO); `REL-01…REL-30` tidak dibuka ulang; Fase 7 dibatalkan |

## Konteks / Masukan Pemilik

Pemilik meminta perubahan flow Buat/Daftar Tryout:

1. Tryout hanya sebagai grouping, mirip kondisi existing.
2. URL test yang dibagikan terhubung dengan sesinya, bukan tryoutnya.
3. Fungsi tryout tetap tampak di laporan seperti sekarang.
4. Saat buat tryout minimal harus ada 1 sesi.
5. Untuk membuat sesi harus ada lembar soal yang dipilih.

Pemilik juga meminta PM mencatat dan membuat breakdown task. Lima klarifikasi sudah dijawab 2026-11-25: URL sesi membuka hanya sesi target, URL event lama ditolak dengan jelas, tiap sesi minimal 1 lembar soal dan `question_ids` ditolak, jadwal/CBT/peserta tetap level tryout, serta format laporan tidak diubah. Detail ada di `pm-agent/decisions/ADR-021-flow-tryout-grouping-dan-url-sesi.md`.

Pemeriksaan awal 2026-11-25:

- Frontend sudah memvalidasi minimal satu sesi dan minimal satu lembar soal per sesi di `TryoutManagement.jsx:565-590`.
- Frontend masih menampilkan dan menyalin URL event slug di `TryoutManagement.jsx:43-44`, `:623`, dan `:1283`.
- Backend belum mewajibkan lembar soal: `tryoutRoutes.js:157-234` menerima `question_ids` sebagai alternatif `sheet_ids`.
- `loadEvent()` (`tryoutRoutes.js:266-340`) sudah mengembalikan `session_slug`, sehingga perubahan UI share URL dapat memakai data yang ada.
- `tryout-agent/app.js:61-62` menerima slug dari URL dan `:177-190` menampilkan tab semua sesi; perilaku ini harus diubah menjadi hanya sesi target.
- Perubahan terakhir sudah di-commit dan di-push di `2472d8e`; Fase 6y dimulai dari working tree bersih.

## Requirement

| ID | Requirement | PM | Status | Gate | ADR |
|---|---|---|---|---|---|
| R1 | Tryout menjadi grouping administratif; sesi menjadi unit eksekusi dan URL peserta | PM-29 | done | REL-31 | ADR-021 |
| R2 | URL share Daftar Tryout memakai `sessions.slug`, bukan `tryout_events.slug`, dan membuka hanya sesi target | PM-29 | done | REL-31 | ADR-021 |
| R3 | URL event slug lama ditolak dengan jelas, bukan redirect dan bukan daftar sesi | PM-29 | done | REL-31 | ADR-021 |
| R4 | Create tryout minimal 1 sesi, divalidasi frontend dan backend secara setara | PM-29 | done | REL-31 | ADR-021 |
| R5 | Setiap sesi wajib memilih minimal 1 lembar soal aktif; input `question_ids` ditolak tanpa masa transisi | PM-29 | done | REL-31 | ADR-021 |
| R6 | Fungsi tryout tetap tampak di laporan seperti `REL-28…REL-30`; format XLSX tidak diubah | PM-29 | done | REL-31 | ADR-021 |
| R7 | Jadwal, CBT, dan peserta tetap tryout-level serta diterapkan ke semua sesi | PM-29 | done | REL-31 | ADR-021 |
| R8 | Regresi penuh `REL-24…REL-30` lolos dan fixture QA dibersihkan | PM-29 | done | REL-31 | ADR-021 |
| R9 | OpenAPI, README backend/DB, ADR, backlog, dan status board tersinkron | PM-29 | done | REL-31 | ADR-021 |

## Keputusan

| ID | Keputusan | Alasan | Status |
|---|---|---|---|
| D1 | `tryout_events` tetap grouping; `tryout_sessions` unit eksekusi; tanpa entity baru | Sesuai permintaan dan skema existing | final |
| D2 | URL canonical memakai session slug dan hanya membuka sesi target | Sesuai jawaban Q1/Q2; `sessions.slug` sudah tersedia | final |
| D3 | URL event slug lama ditolak dengan pesan jelas | Sesuai jawaban Q2 | final |
| D4 | Backend mewajibkan minimal satu sesi dan minimal satu sheet per sesi; `question_ids` ditolak | Sesuai jawaban Q3; frontend sudah benar, backend masih longgar | final |
| D5 | Jadwal/CBT/peserta tetap tryout-level | Sesuai jawaban Q4; menghindari perubahan besar pada endpoint participant dan CBT | final |
| D6 | Laporan tetap agregat per tryout/sesi tanpa kolom/filter baru | Sesuai jawaban Q5; menjaga gate `REL-28…REL-30` | final |
| D7 | Gate `REL-31`, rollback `REL-30`, tanpa Fase 7 | Isolasi dari perubahan sebelumnya | final |

## Acceptance Criteria

- **AC1 (R1):** Daftar Tryout dan form create masih menampilkan tryout sebagai grup; setiap tryout menampilkan daftar sesi. Tidak ada entity/table baru untuk sesi.
- **AC2 (R2):** Kolom dan notifikasi URL peserta menampilkan URL berbasis session slug, termasuk untuk tryout dengan banyak sesi.
- **AC3 (R3):** URL event slug lama ditolak dengan pesan yang jelas, bukan dialihkan dan bukan menampilkan daftar sesi; perilaku tercatat di OpenAPI dan diuji.
- **AC4 (R4):** Form create menolak tryout tanpa sesi; backend mengembalikan 400 untuk payload tanpa `sessions[]` dan untuk `sessions[]` kosong.
- **AC5 (R5):** Setiap sesi tanpa `sheet_ids` aktif ditolak backend dengan pesan yang jelas; payload berbasis `question_ids` ditolak 400.
- **AC6 (R2):** Membuka URL sesi mengarah hanya ke sesi yang dituju; tab sesi lain tidak ditampilkan untuk URL share dan JWT/Presentation scope tidak memberi akses ke sesi lain.
- **AC7 (R6):** UI laporan dan XLSX tetap mengelompokkan hasil per tryout/sesi; tidak ada kolom sesi/slug maupun filter sesi baru.
- **AC8 (R5):** Jadwal, CBT, dan peserta tetap diatur di level tryout dan diterapkan ke semua sesi; endpoint participant dan `PATCH /tryouts/:id/cbt` tidak berubah.
- **AC9 (R8):** Seluruh regresi `REL-24…REL-30` lolos ditambah skenario `Q6Y-01…Q6Y-05`; fixture QA dibersihkan dan tidak menyisakan event/soal QA.
- **AC10 (R9):** OpenAPI, README backend/DB, ADR-021, backlog ini, dan status board tersinkron dengan implementasi final.

## Breakdown Task

| ID | Agent | Deskripsi | AC | Gate | Status | ADR |
|---|---|---|---|---|---|---|
| PM-29 | PM | Mencatat masukan pemilik, Q1–Q5, ADR-021, backlog Fase 6y, status board, dan indeks README | R1–R9 | REL-31 | done | ADR-021 |
| BE-44 | Backend | Samakan validasi create: minimal 1 sesi, minimal 1 sheet per sesi, tolak `question_ids`; tolak URL event slug lama dengan pesan jelas; OpenAPI | AC3–AC5 | REL-31 | done | ADR-021 |
| FE-41 | Frontend | Ganti URL share/daftar dari event slug ke session slug; sinkronkan notifikasi; hapus tampilan tab multi-sesi pada jalur URL share | AC1, AC2 | REL-31 | done | ADR-021 |
| TRY-22 | Tryout | Pastikan slug sesi memetakan ke `tryout_session_id`, JWT scope hanya sesi target, dan URL event lama ditolak jelas | AC3, AC6 | REL-31 | done | ADR-021 |
| QA-41 | QA | Skenario Q6Y create validation, session URL, legacy URL rejection, multi-sesi, laporan; regresi penuh; cleanup fixture QA | AC1–AC9 | REL-31 | done — 199/199 pass, 0 fail | ADR-021 |
| DOC-12 | Dokumentasi | OpenAPI resolver URL dan validasi create, README backend/DB, alur grouping vs sesi, sinkron ADR/backlog/status board | AC10 | REL-31 | done | ADR-021 |
| REL-31 | Release | Backup pre-`REL-31`, deploy, smoke test, rollback ke `REL-30`, gate GO | R1–R9 | REL-31 | done — **GO** 2026-11-25 | ADR-021 |

## Rencana Handoff

Mengikuti pola Fase 6w/6x, handoff development dicatat lewat ADR-021 dan backlog ini; file handoff terpisah belum dibuat:

- `tasks/handoff-BE44.md`
- `tasks/handoff-FE41.md`
- `tasks/handoff-TRY22.md`
- `tasks/handoff-QA41.md`
- `tasks/handoff-DOC12.md`
- `tasks/handoff-REL31.md`

## Risiko & Catatan

- Tautan tryout lama akan berhenti berfungsi; pengumuman penggantian ke tautan sesi menjadi bagian dari rilis.
- Frontend sudah benar untuk minimal sesi dan sheet; risiko utama ada di bypass API melalui `question_ids` atau payload legacy.
- Perubahan pada `tryout-agent` harus memastikan tidak ada kebocoran akses ke sesi lain melalui tab atau JWT scope.
- `QA_ADMIN_PASSWORD` diambil dari `BOOTSTRAP_ADMIN_PASSWORD` pada `backend-agent/.env` tanpa mencetak secret; fixture QA dibersihkan oleh test suite dan sesi aktif baseline dipulihkanmelalui `activeTryoutContext`.
- Format laporan sengaja tidak diubah untuk menjaga `REL-28…REL-30`.
- Gate dan rollback: `REL-31` rollback ke `REL-30`; `REL-01…REL-30` tidak dibuka ulang; Fase 7 tetap dibatalkan.
- Implementasi dibuat di atas working tree bersih pasca-commit `2472d8e`; backup pre-release `/tmp/opencode/bank_soal_db-pre031-2026-11-25.dump`, regresi 199/199, health backend/presentation `200`, dan gate `REL-31` **GO**; perubahan siap di-commit.
