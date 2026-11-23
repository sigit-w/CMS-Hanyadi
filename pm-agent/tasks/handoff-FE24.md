# Handoff — FE-24 (Fase 6l)

| Field | Isi |
|---|---|
| Task ID | FE-24 |
| Nama task | Halaman Lembar Soal di CMS: form create/edit, picker satu mapel, daftar/arsip, flag di Daftar Soal |
| Agent pengirim | PM |
| Agent penerima | Frontend |
| Tanggal | 2026-11-23 |
| Status | review |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-005-lembar-soal.md`, `pm-agent/tasks/phase6l-backlog.md`; target UI `frontend-agent/src/App.jsx` grup `Manajemen Soal`, `src/api.js`, `src/pages/`
- Endpoint / UI: endpoint BE-27 (`/api/v1/question-sheets*`, `/question-sheets/question-picker`); halaman `#/question-sheets`; Daftar Soal `#/questions`
- Bukti: kontrak ADR-005 `accepted`; menu existing ada di `App.jsx:33-40`; baseline `free -h` 2026-11-23: 1.9 GiB total, 313 MiB available, swap 623 MiB / 3.9 GiB

## Acceptance Criteria Terpenuhi

- [ ] Menu "Lembar Soal" tampil di bawah grup Manajemen Soal, dilindungi `question_sheets.manage`, route `#/question-sheets`.
- [ ] Urutan form create: nama → pilih mapel dari `GET /mapels` → sistem panggil `GET /question-sheets/generate-code?mapel=<code>` → kode dapat diubah manual, unik, tepat 12 karakter → keterangan dan waktu pengerjaan angka bebas (min 1, bukan preset 60/90/120). Prefix berasal langsung dari `mapels.code` 4 karakter sesuai amendemen terbaru ADR-005.
- [ ] Picker soal tersembunyi sebelum mapel dipilih; setelah itu memakai `GET /question-sheets/question-picker?mapel=<code>`; create/edit mewajibkan minimal satu soal dari mapel terpilih; klik baris soal membuka popup detail seperti Daftar Soal, tombol Pilih/Hapus tetap berfungsi dengan `stopPropagation`.
- [ ] Edit menyimpan seluruh field dan daftar soal melalui `PUT` transaksional BE; kode read-only saat lembar sudah dipakai (saat ini selalu belum dipakai sesuai ADR-005).
- [ ] Daftar lembar default menampilkan yang aktif, filter `status=archived` menampilkan arsip, aksi hapus memanggil `DELETE` soft delete dengan konfirmasi; tidak ada aksi pulihkan.
- [ ] Daftar Soal menampilkan flag/kode semua lembar aktif dari field `sheets`, termasuk soal yang dipakai berulang; lembar arsip tidak ditampilkan.
- [ ] Kelola Role otomatis menampilkan checkbox `question_sheets.manage` dari `GET /permissions` ( tambahkan label grup jika perlu ); admin dan editor sudah memiliki permission dari migrasi BE-27.
- [ ] Build produksi sukses tanpa OOM.

## Catatan Kendala / Risiko

- FE-24 bergantung pada kontrak BE-27; boleh review ADR-005 sekarang, mulai implementasi setelah endpoint tersedia. Jangan mengganti format response `{ ok, data, meta }`.
- Koordinasikan validasi kode 12 karakter dengan constraint backend `^[A-Z0-9-]{12}$`; generator mengikuti `mapels.code` 4 karakter, sedangkan kode hasil edit boleh di luar pola generator.
- Tambahkan label permission di `RoleManagement.jsx` hanya untuk tampilan; sumber kebenaran tetap `GET /permissions`.
- Cek `free -h` sebelum build. Build dengan `NODE_OPTIONS=--max-old-space-size=256` secara bergiliran, jangan paralel dengan test/backend build; naikkan ke `384` hanya jika gagal dan laporkan kenaikan tersebut.

## Amendemen 2026-11-23 — Kode Mapel 4 Karakter (implementasi FE-25)

- [x] Form **Kelola Mapel** memakai `maxLength={4}`, `pattern="[A-Z0-9]{4}"`, dan normalisasi kapital; validasi unik tetap di backend.
- [x] Tidak ada lagi pemetaan nama mapel ke `MTKA/IPAS/BIND/BING/CUST`; halaman Lembar Soal memakai kode dari `GET /mapels` apa adanya.
- [x] Label/default di Dashboard, Tryout Management, Question Input, dan placeholder impor diselaraskan ke `MTKA/BIND/IPAS`; build/deploy ulang mengikuti batas heap 256 MB.

## Amendemen D7 / FE-26 — 2026-11-23

- [x] **Daftar Soal** memiliki dropdown `Tipe soal` dengan opsi semua tipe; nilai diteruskan sebagai `question_type` lewat `getQuestions()`.
- [x] **Lembar Soal** memiliki dropdown tipe soal pada area picker; filter ikut mapel + kata kunci, direset saat form/mapel berubah, dan kolom Tipe ditampilkan.
- [x] Label tipe soal memakai bahasa Indonesia di filter, tabel, dan popup detail; build `index-BxuKDQvd.js` terdeploy.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
