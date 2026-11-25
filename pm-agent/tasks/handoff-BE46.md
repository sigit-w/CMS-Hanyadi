# Handoff — BE-46

| Field | Isi |
|---|---|
| Task ID | BE-46 |
| Nama task | Jenjang pendidikan pada migrasi, API soal/import, lembar soal, tryout, dan program belajar |
| Agent pengirim | PM |
| Agent penerima | Backend |
| Tanggal | 2026-11-25 |
| Status | review |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-023-jenjang-pendidikan-soal-lembar-tryout-program.md`, `pm-agent/tasks/phase6aa-backlog.md`
- Endpoint / UI: `GET/POST/PUT /questions` dengan `jenjang`; `POST /questions/import`; `/question-sheets/generate-code`, `/question-picker`, CRUD lembar; `POST /tryouts`; CRUD `/program-belajar`
- Bukti: masukan pemilik 2026-11-25 dan pemetaan dampak pada `db/migrations/031_jenjang_dan_kredensial_peserta.sql`, `backend-agent/src/routes.js`, `backend-agent/src/importer.js`, `backend-agent/src/questionSheetRoutes.js`, `backend-agent/src/tryoutRoutes.js`, `backend-agent/src/programBelajarRoutes.js`, `backend-agent/openapi/openapi.yaml`

## Acceptance Criteria Terpenuhi

- [ ] AC1: migrasi `034` menambahkan FK `jenjang_id` ke 4 tabel, backfill `SD`, index, constraint kode lembar baru, dan rebuild `v_question_catalog`
- [ ] AC2: soal create/update/list/filter menerima dan mengembalikan `jenjang_kode`/`jenjang_nama`
- [ ] AC3: importer CSV/XLSX mewajibkan header `jenjang` setelah `mapel` dan menolak nilai di luar `SD|SMP|SMA`
- [ ] AC4: generator kode `LS-${mapel}-${jenjang}-${mmyy}`, picker difilter jenjang + mapel, create lembar menolak soal beda jenjang
- [ ] AC5: tryout create menyimpan `jenjang_id` dan menolak lembar beda jenjang; slug tetap auto
- [ ] AC7: program belajar create/update mewajibkan dan mengembalikan jenjang
- [ ] AC8: OpenAPI sinkron dengan semua kontrak di atas sebelum FE mengonsumsinya

## Catatan Kendala / Risiko

- Backfill `SD` wajib sebelum `SET NOT NULL`; jangan membuat seed jenjang baru.
- `mmyy` kode lembar tetap UTC seperti implementasi sekarang; pola akhir `^LS-[A-Z0-9]{4}-(SD|SMP|SMA)-[0-9]{4}$`.
- `question_count` boleh tetap di response tryout untuk kompatibilitas, tetapi UI tidak menampilkannya.
- Kontrak berubah lebih dulu; frontend tidak boleh menebak bentuk respons.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
