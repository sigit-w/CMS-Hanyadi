# Handoff — QA-43

| Field | Isi |
|---|---|
| Task ID | QA-43 |
| Nama task | Skenario jenjang pendidikan, update marker, dan regresi `REL-33` |
| Agent pengirim | PM |
| Agent penerima | QA |
| Tanggal | 2026-11-25 |
| Status | review |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-023-jenjang-pendidikan-soal-lembar-tryout-program.md`, `pm-agent/tasks/phase6aa-backlog.md`
- Endpoint / UI: alur Buat Soal, import CSV/XLSX, Daftar Soal, Lembar Soal, Buat/Daftar Tryout, Program Belajar, aplikasi peserta
- Bukti: masukan pemilik 2026-11-25 dan pemetaan marker pada `qa-agent/tests/phase6l.mjs`, `phase6x.mjs`, `phase6u.mjs`, `phase6o.mjs`, `phase6z.mjs`, `phase6w.mjs`, `nav-bimbel.mjs`

## Acceptance Criteria Terpenuhi

- [ ] AC1: migrasi `034` terverifikasi; tidak ada `jenjang_id` null pada soal/lembar/tryout/program; kode lembar lama tidak lagi lolos
- [ ] AC2: `Q6AA-01` form Buat Soal dan filter jenjang di Daftar Soal/Buat Soal lolos, termasuk pagination
- [ ] AC3: `Q6AA-02` template CSV dan XLSX lolos import apa adanya; header tanpa `jenjang` dan nilai selain `SD|SMP|SMA` ditolak jelas
- [ ] AC4: `Q6AA-03` urutan flow Lembar Soal, kode `LS-MTKA-SD-1126`, picker jenjang+mapel, dan kolom Jenjang di daftar lolos
- [ ] AC5: `Q6AA-04` flow Buat Tryout dengan slug auto dan penolakan lembar beda jenjang lolos
- [ ] AC6: `Q6AA-05` header Daftar Tryout persis mengganti `Soal` dengan `Jenjang`; status filter dan copy ikon masih lolos
- [ ] AC7: `Q6AA-06` Program Belajar.create/update dan kolom Jenjang lolos
- [ ] AC8: `Q6AA-07` regresi penuh minimal 206 baseline tidak menurun; `Q6AA-08` non-regresi TRY-23 lolos; backup dan laporan gate disiapkan

## Catatan Kendala / Risiko

- Update marker lama, jangan menambah alternatif format kode lembar agar tidak ada ambiguitas.
- Jangan menjalankan helper cleanup berbasis `created_at` yang bisa menghapus data operasional baru; pakai fixture berprefix uji dan cleanup eksplisit.
- QA memakai kredensial admin dari `backend-agent/.env` tanpa mencetak secret dan tanpa commit fileenv/backup.
- Data QA wajib dibersihkan setelah pengujian; data operasional user tidak boleh tersentuh.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
