# Handoff — QA-24 (Fase 6l)

| Field | Isi |
|---|---|
| Task ID | QA-24 |
| Nama task | Review ADR-005, regresi + skenario Lembar Soal, input release gate `REL-12` |
| Agent pengirim | PM |
| Agent penerima | QA |
| Tanggal | 2026-11-23 |
| Status | review |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-005-lembar-soal.md`, `pm-agent/tasks/phase6l-backlog.md`; target `qa-agent/test-cases/phase6l.md`, `qa-agent/reports/phase6l-report.md`, `qa-agent/reports/phase6-release-gate.md`
- Endpoint / UI: seluruh endpoint BE-27 dan halaman `#/question-sheets` / `#/questions` FE-24
- Bukti: baseline `qa-agent/reports/phase6j-report.md` 118/118 lolos, `REL-11` GO; `free -h` 2026-11-23: 1.9 GiB total, 313 MiB available, swap 623 MiB / 3.9 GiB

## Acceptance Criteria Terpenuhi

- [ ] ADR-005 ditinjau lebih dulu; jika ditolak, PM revisi sebelum BE-27/FE-24 dilanjutkan.
- [ ] Skenario positif: urutan create nama → pilih mapel → kode auto-generate dari `mapels.code` 4 karakter (`LS-<CODE>-mmyy`) → kode diubah manual; picker kosong sebelum mapel dipilih, lalu terfilter mapel dan klik baris membuka popup detail; keterangan, waktu angka bebas (45/150), minimal satu soal; edit; arsip; flag di Daftar Soal.
- [ ] Skenario negatif: kode < atau > 12 karakter, karakter di luar `A-Z0-9-`, duplikat kode, waktu 0/negatif/desimal, daftar soal kosong, campuran mapel, edit kode lembar yang sudah dipakai (placeholder `false` masih berlaku di Fase 6l), akses tanpa `question_sheets.manage`, lembar arsip tidak muncul di flag/picker.
- [ ] Verifikasi RBAC: checkbox `question_sheets.manage` tampil, `admin` dan `editor` memilikinya, role baru dengan permission tersebut bisa create/edit dan memakai picker soal; user tanpa permission ditolak.
- [ ] Regresi 126 skenario (118 existing + 8 Lembar Soal) lolos, tidak ada perubahan pada presentation/tryout dan submission lama tetap terbaca.
- [ ] 0 bug P0/P1; laporan QA dan rekomendasi `REL-12` ditulis dengan status GO/NO-GO.

## Catatan Kendala / Risiko

- QA-24 bergantung pada BE-27 dan FE-24; review ADR-005 dapat dimulai sekarang, eksekusi test setelah keduanya siap.
- `REL-12` hanya GO bila QA lolos, tidak ada OOM, dan memori tersedia aman; sertakan angka `free -h` sebelum/sesudah pada laporan.
- Jalankan test satu proses dengan `NODE_OPTIONS=--max-old-space-size=128`; jangan parallel dengan build frontend. Laporkan jika available memory turun di bawah ~200 MiB.
- Uji juga pagination daftar lembar dan konsistensi flag setelah kode diubah pada lembar belum dipakai (satu transaksi).

## Amendemen 2026-11-23 — Kode Mapel 4 Karakter (implementasi QA-25)

- [x] Fixture QA memakai kode 4 kapital (`QAxx/QBxx/QCxx`); `MP-02` menguji duplikat huruf kecil tetap ditolak `409`.
- [x] `L-01` menguji generator `LS-<KODE_MAPEL>-mmyy` tepat 12 karakter untuk `MTKA/IPAS/BIND` dan dua mapel uji; tidak ada hasil `CUST` atau `BING`.
- [x] Regresi memakai kode baru di seluruh filter/picker/tryout; referensi DB berupa FK `mapel_id` tetap konsisten. Hasil akhir dan 0 bug P0/P1 dicatat di laporan `REL-13`.

## Amendemen D7 / QA-26 — 2026-11-23

- [x] Skenario baru `S-09a`, `S-09b`, dan `L-06a` menguji filter tipe soal, kombinasi filter, penolakan nilai invalid, dan picker lembar soal.
- [x] Regresi penuh 13 file test serial dengan heap 128 MB: **129/129 pass, 0 fail**, tanpa OOM; 0 bug P0/P1.
- [x] Marker bundle `Semua tipe` hadir di `index-BxuKDQvd.js`; health API `200` dan CMS menyajikan hash terbaru. Gate `REL-14` **GO**.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
