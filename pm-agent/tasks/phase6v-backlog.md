# Backlog — Fase 6v: Filter dan Format Laporan Tryout

| Field | Isi |
|---|---|
| Fase | Fase 6v |
| Gate | `REL-28` |
| Tanggal | 2026-11-24 |
| ADR | `ADR-018` |
| Status | done — REL-28 GO |
| Pemilik | PM |
| Melanjutkan | Fase 6u / `REL-27`; `REL-01…REL-27` tidak dibuka ulang; Fase 7 tetap dibatalkan |

## Konteks / Masukan Pemilik

Pemilik meminta empat perubahan pada halaman laporan tryout:

1. Hapus section **Buat Sesi Tryout** dan section **Sesi Tersedia**.
2. Buat filter yang isinya sesi tryout; pertimbangkan pencarian teks bila data sudah terlalu banyak; sediakan tombol **Cari/Filter**.
3. Tambahkan filter berdasarkan **nama tryout** saat mengunduh laporan tryout.
4. Sesuaikan format laporan dengan contoh file XLSX pemilik.

Contoh format: `/home/ubuntu/Copy of HASIL TRYOUT TKA TKAD SD NEW PRIMAGAMA di SMPN 1 YK-21 NOV 2026.xlsx`. Struktur sudah diekstrak dari file tersebut; detail ada di `pm-agent/decisions/ADR-018-filter-dan-format-laporan-tryout.md`.

Keputusan lengkap ada di `pm-agent/decisions/ADR-018-filter-dan-format-laporan-tryout.md`.

## Requirement

| ID | Requirement | PM | Status | Gate | ADR |
|---|---|---|---|---|---|
| R1 | Hapus section `Buat Sesi Tryout` dan `Sesi Tersedia` dari halaman laporan | PM-26 | done | REL-28 | ADR-018 |
| R2 | Filter sesi tryout + pencarian teks + tombol `Cari/Filter` | PM-26 | done | REL-28 | ADR-018 |
| R3 | Filter `nama tryout` saat unduh Excel | PM-26 | done | REL-28 | ADR-018 |
| R4 | Format XLSX laporan mengikuti contoh pemilik | PM-26 | done | REL-28 | ADR-018 |

## Ringkasan Format XLSX yang Diinginkan

- Baris 1–3: judul hasil tryout, nama penyelenggara, dan tanggal.
- Baris 6–7: header dua level. Kolom tetap: `NO`, `NAMA SISWA`, `USER`, `ASAL SEKOLAH`, `WAKTU`, `TOTAL`, `RATA-RATA`, `RANKING`.
- Untuk setiap mapel, satu grup header tiga subkolom: `B` (jumlah benar), `S` (jumlah salah), `NILAI` (nilai 2 desimal). Contoh file memakai `INDONESIA`, `MATEMATIKA`, `IPAS`; implementasi memakai nama mapel dari tryout yang difilter, bukan hardcode.
- Satu baris per peserta, diurutkan berdasarkan `TOTAL` menurun, lalu mengikuti urutan kriteria pada catatan kaki contoh.
- Catatan kaki: `KETERANGAN`, `Nilai di atas adalah nilai MURNI HASIL TRYOUT`, `B = Jumlah benar, S = jumlah salah`, kriteria pengurutan, statistik `MAKSIMAL`/`MINIMAL`/`RATA-RATA` per mapel, serta baris tanda tangan.
- Tidak memuat kunci jawaban atau pembahasan.

## Keputusan

| ID | Keputusan | Alasan |
|---|---|---|
| D1 | Hapus dua section dan state/handler terkait di halaman laporan; endpoint create/activate legacy tidak dihapus | Laporan difokuskan untuk baca/filter/ekspor; klien lama tidak rusak; tulis sesi tetap di manajemen tryout |
| D2 | Filter bersumber dari `tryout_sessions` + induk `tryout_events`; tampilkan nama induk, nama sesi, mapel; `search` server-side dengan debounce; tombol `Cari/Filter`; default `Semua sesi` | Sesi perlu konteks tryout induk dan tetap responsif saat data banyak |
| D3 | Ekspor menerima `session_id` dan `tryout_name`; `ILIKE` case-insensitive/partial, wildcard di-escape, batas panjang; keduanya digabung `AND`; permission tidak diubah; nama file mencerminkan filter | Filter unduhan sesuai permintaan tanpa melemahkan akses |
| D4 | Ekspor XLSX memakai header dua level dan grup `B|S|NILAI` per mapel, ditutup ringkasan statistik + catatan kaki sesuai contoh; nama mapel dinamis | Format berasal dari file XLSX pemilik, bukan format 10 kolom lama |
| D5 | Tidak ada migrasi database; rollback ke `REL-27`; gate `REL-28`; tanpa Fase 7 | Perubahan terbatas pada laporan dan kontrak API existing |
| D6 | Regresi `REL-24…REL-27` wajib lolos: 401 gate netral, debounce violation, submit global per sesi, laporan 7 kolom & log tersembunyi | Gate lama tidak boleh diregresi |

## Acceptance Criteria

- **AC1 (R1):** Tidak ada marker `Buat Sesi Tryout`, `Sesi Tersedia`, `Jadikan sesi aktif`, `Aktifkan` di `frontend-agent/src/pages/TryoutReport.jsx`; import/handler `createTryoutSession`, `activateTryoutSession` dan state `form`, `saving`, `notice` yang terkait hilang. Endpoint legacy backend tetap tersedia.
- **AC2 (R2):** Tersedia input pencarian sesi dan tombol `Cari/Filter`; hasil filter hanya sesi terpilih dengan nama induk, nama sesi, dan mapel; pencarian dilakukan sisi server dengan debounce bila data banyak; default `Semua sesi`.
- **AC3 (R3):** Tombol unduh menyediakan input nama tryout; endpoint menerima `tryout_name` selain `session_id`; hanya baris induk tryout yang cocok yang diunduh; file tetap XLSX dan nama file mencerminkan filter.
- **AC4 (R4):** XLSX hasil unduhan memiliki baris judul, header dua level, satu baris per peserta, grup `B|S|NILAI` per mapel, `TOTAL`, `RATA-RATA`, `RANKING`, dan catatan kaki statistik sesuai contoh. Tidak ada kunci jawaban/pembahasan. Tampilan layar 7 kolom Fase 6u dipertahankan sampai pemilik meminta format yang sama di layar.

## Breakdown Task

| ID | Agent | Deskripsi | AC | Gate | Status | ADR |
|---|---|---|---|---|---|---|
| PM-26 | PM | Mencatat 4 perubahan, ADR-018, backlog, 5 handoff, status board | R1–R4 | REL-28 | done | ADR-018 |
| BE-41 | Backend | Endpoint daftar sesi laporan dengan `search`, ekspor XLSX + `tryout_name`, format XLSX sesuai contoh, endpoint legacy dipertahankan | R2–R4 | REL-28 | done — `search`/`tryout_name`, escape wildcard `% _ \`, `limit=201` ditolak, legacy `POST /tryout-sessions` dengan `event_id` valid tetap 201 | ADR-018 |
| FE-38 | Frontend | Hapus 2 section, filter sesi + search + tombol `Cari/Filter`, filter nama tryout saat unduh, menyesuaikan tampilan bila diminta | R1–R4 | REL-28 | done — section Buat/Sesi Tersedia dihapus; `Cari/Filter` terpisah dari search; unduh pakai `session_id`/`tryout_name` | ADR-018 |
| QA-38 | QA | Test `Q6V-01…Q6V-04` + regresi `REL-24…REL-27`, fixture dibersihkan | R1–R4 | REL-28 | done — final `36 tests, 36 pass, 0 fail` (`cbt.mjs`, `tryout.mjs`, `phase6t.mjs`, `phase6u.mjs`, `phase6v.mjs`); Q6V-01…Q6V-04 lolos | ADR-018 |
| DOC-09 | Dokumentasi | Update README backend/OpenAPI untuk `search`, `tryout_name`, dan format XLSX; arsitektur alur filter | R2–R4 | REL-28 | done — `YAML OK 3.0.3 56`, `git diff --check` OK; README/OpenAPI/arsitektur diperbarui | ADR-018 |
| REL-28 | Release | Backup/rollback ke `REL-27`, deploy, smoke test, gate GO/NO-GO | R1–R4 | REL-28 | done — GO; services active, `/health` 200, build frontend sukses, backup pre-6v `/tmp/opencode/bank_soal_db-pre6v-2026-11-24.dump` (332248 bytes), rollback ke `REL-27`, tanpa migrasi DB | ADR-018 |

## Handoff

- `tasks/handoff-BE41.md`
- `tasks/handoff-FE38.md`
- `tasks/handoff-QA38.md`
- `tasks/handoff-DOC09.md`
- `tasks/handoff-REL28.md`

## Risiko & Catatan

- QA final: `36 tests, 36 pass, 0 fail` untuk `cbt.mjs`, `tryout.mjs`, `phase6t.mjs`, `phase6u.mjs`, `phase6v.mjs`. `Q6V-01…Q6V-04` lolos, termasuk legacy `POST /tryout-sessions` dengan `event_id` valid → 201, wildcard `%`, `_`, `\` di-escape, `limit=201` ditolak, `Cari/Filter` terpisah dari pencarian, AND filter positif `session_id=376&tryout_name=TKA` hanya grup `IPAS`, struktur XLSX sesuai ADR-018, tanpa kunci jawaban.
- DOC-09: `YAML OK 3.0.3 56`, `git diff --check` OK; README/OpenAPI/arsitektur diperbarui.
- REL-28 smoke: services `bank-soal-api.service` dan `bank-soal-presentation.service` active; `/health` 200; build frontend sukses; backup pre-6v `/tmp/opencode/bank_soal_db-pre6v-2026-11-24.dump` (332248 bytes); rollback ke `REL-27`; tidak ada migrasi DB.
- Baseline DB final `2|3|3|6|40|5|3` = 2 events, 3 sessions (271,375,376), 3 junction, 6 relasi peserta, 40 submissions, 5 attempts, `cbt_max_violations=3`. Fixture pemilik event48/sesi375,376/peserta495,496/attempts76..79 dipertahankan.
- Review tambahan menemukan dan memperbaiki P1 legacy `event_id`; P2 docs batch 500/nullable dan DISTINCT/title sudah diperbaiki. Risiko yang diterima: peserta yang tidak terdaftar di semua sesi mendapat nilai 0 untuk mapel lain (perilaku nilai kosong), dan klien legacy wajib mengirim `event_id`/`eventId` yang valid.
- `submission_count` di `/tryout-sessions` adalah jumlah baris jawaban, bukan jumlah peserta. Endpoint create/activate legacy tetap dipertahankan; pembuatan/aktivasi sesi tetap di halaman manajemen tryout.
- Gate `REL-28` GO. `REL-01…REL-27` tidak dibuka ulang; Fase 7 tetap dibatalkan. Seluruh perubahan telah di-commit dan di-push ke `origin/main` di `425ce3d` — `Finalisasi Fase 6v — filter dan format laporan tryout` — sesuai permintaan user.
