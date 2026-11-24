# Handoff — QA-38

| Field | Isi |
|---|---|
| Task ID | QA-38 |
| Nama task | Verifikasi filter/ekspor laporan dan regresi Fase 6v |
| Agent pengirim | PM |
| Agent penerima | QA |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `qa-agent/tests/phase6v.mjs` (baru); pembaruan regresi existing `qa-agent/tests/cbt.mjs`, `qa-agent/tests/tryout.mjs`, `qa-agent/tests/phase6t.mjs`, `qa-agent/tests/phase6u.mjs` bila marker berubah
- Endpoint / UI: `#/reports/tryout`, `GET /api/v1/tryout-sessions?search=`, `GET /api/v1/reports/tryout/export.xlsx?session_id=&tryout_name=`
- Bukti (log, screenshot, test result): QA final `36 tests, 36 pass, 0 fail` untuk `cbt.mjs`, `tryout.mjs`, `phase6t.mjs`, `phase6u.mjs`, `phase6v.mjs`. Q6V-01…Q6V-04 lolos.

## Acceptance Criteria Terpenuhi

- [x] `Q6V-01`: tidak ada marker `Buat Sesi Tryout`, `Sesi Tersedia`, `Jadikan sesi aktif`, `Aktifkan`; import/handler/state terkait hilang; endpoint legacy masih merespons
- [x] `Q6V-02`: input search + tombol `Cari/Filter` menampilkan hanya sesi terpilih; nama induk, nama sesi, mapel tampil; default `Semua sesi`; search sisi server dengan debounce bila data banyak
- [x] `Q6V-03`: unduhan XLSX dengan `tryout_name` hanya mengambil baris induk tryout cocok; `session_id` + `tryout_name` digabung `AND`; permission `tryout_reports.read` tidak berubah; nama file mencerminkan filter
- [x] `Q6V-04`: XLSX memiliki 3 baris judul, header dua level, grup `B|S|NILAI` per mapel, `TOTAL`, `RATA-RATA`, `RANKING`, baris diurutkan dari `TOTAL` menurun, catatan kaki `KETERANGAN` + aturan `B`/`S` + kriteria pengurutan + statistik `MAKSIMAL`/`MINIMAL`/`RATA-RATA` per mapel, tanpa kunci jawaban/pembahasan
- [x] Regresi `REL-24…REL-27` lolos (401 gate netral, debounce violation, submit global per sesi, laporan 7 kolom & log tersembunyi); fixture dibersihkan

## Catatan Kendala / Risiko

- Q6V-01…Q6V-04 lolos termasuk legacy `POST /tryout-sessions` dengan `event_id` valid → 201, wildcard `%`, `_`, `\` di-escape, `limit=201` ditolak, `Cari/Filter` terpisah dari pencarian, AND filter positif `session_id=376&tryout_name=TKA` hanya grup `IPAS`, struktur XLSX sesuai ADR-018, tanpa kunci jawaban.
- Baseline DB final `2|3|3|6|40|5|3`. Fixture pemilik event48/sesi375,376/peserta495,496/attempts76..79 dipertahankan. Risiko diterima: nilai kosong mapel lain = 0 bila peserta tidak terdaftar di semua sesi.

## Tindakan Penerima

- [x] Diterima
