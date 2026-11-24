# Backlog — True-False Multi-Pernyataan

| Field | Isi |
|---|---|
| PM | PM-22 |
| Status | accepted — diimplementasikan |
| Gate | REL-22 |
| ADR | `pm-agent/decisions/ADR-012-true-false-multi-pernyataan.md` |

## Requirement Pemilik

| ID | Requirement |
|---|---|
| R12 | Tipe `true_false` bisa memuat beberapa pernyataan Benar/Salah dalam satu soal. |
| R13 | Soal dinyatakan benar hanya bila semua pernyataan benar. |
| R14 | Laporan admin menampilkan jawaban dan kunci per pernyataan. |
| R15 | Maksimal 5 pernyataan per soal. |

## Keputusan Pemilik

| ID | Keputusan |
|---|---|
| D7 | Ubah tipe `true_false` existing, bukan buat tipe baru. |
| D8 | `stem`/gambar menjadi konteks bersama; pernyataan menjadi baris turunan. |
| D9 | Penilaian all-or-nothing. |
| D10 | Laporan per butir wajib tersedia untuk admin. |

## Breakdown Task

| Task ID | Owner | Prioritas | Dependency | Scope |
|---|---|---|---|---|
| PM-22 | PM | P0 | - | ADR-012, backlog, keputusan D7–D10, handoff |
| BE-37 | Backend | P0 | ADR-012 | Migrasi `026`, owner/sequence/view, validasi statements, create/update/get, answer-key guard, OpenAPI, laporan per butir |
| FE-34 | Frontend | P0 | BE-37 (kontrak) | Repeater pernyataan di Buat Soal dan Detail/Edit Soal; build produksi |
| TRY-16 | Tryout | P0 | BE-37, PRES-04 | Fieldset Benar/Salah per pernyataan; submit `answers`; bump aset |
| PRES-04 | Presentation | P0 | BE-37 | Hilangkan kunci dari payload peserta; `gradeStatements`; simpan detail submission |
| QA-34 | QA | P0 | BE-37, FE-34, TRY-16, PRES-04 | `TF-01…TF-05`, regresi penuh, laporan & gate |
| DOC-06TF | PM/Docs | P1 | QA-34 | ADR, backlog, handoff, status board, laporan sistem, release gate |
| REL-22 | PM | P0 | QA-34, DOC-06TF | Deploy, verifikasi produksi, commit/push |

## Acceptance Criteria

### BE-37
- [x] Backup pre-migrasi dibuat dan migration `026` idempoten.
- [x] `question_statements` dan `submission_statement_answers` memiliki FK cascade dan constraint position 1–5.
- [x] Owner tabel/sequence/view baru adalah `bank_soal_user`.
- [x] Create/update `true_false` memakai `statements`; field opsi/kunci ditolak.
- [x] `GET /questions/{id}` mengembalikan kunci per pernyataan untuk admin.
- [x] `v_question_catalog` menyediakan `statement_count` dan `correct_statement_count`.
- [x] Laporan tryout menyediakan `statement_details`.
- [x] OpenAPI dan `db/README.md` diperbarui.

### FE-34
- [x] Form Buat Soal memiliki repeater 1–5 pernyataan dengan radio Benar/Salah.
- [x] Detail/Edit Soal dapat mengubah pernyataan soal `true_false` existing.
- [x] Tampilan non-`true_false` tidak berubah.
- [x] Build Vite sukses memakai heap 256 MB.

### TRY-16
- [x] Peserta melihat teks pernyataan tanpa kunci.
- [x] Peserta wajib memilih Benar/Salah untuk setiap pernyataan.
- [x] Submit mengirim `answers: [{statement_id, value}]`.
- [x] Aset di-bump ke `styles.css?v=13` dan `app.js?v=14`.

### PRES-04
- [x] Payload soal peserta tidak mengandung `is_correct`, `correct`, atau `statement_text`.
- [x] `gradeStatements` menerapkan all-correct.
- [x] Detail jawaban per butir tersimpan di `submission_statement_answers`.
- [x] Rekap tetap satu baris per soal dan tidak memberi feedback ke peserta.

### QA-34
- [x] `TF-01…TF-05` lolos.
- [x] Regresi penuh 174/174 lolos, 0 gagal, 0 P0/P1.
- [x] Fixture dihapus otomatis.
- [x] Release gate `REL-22` didokumentasikan.
