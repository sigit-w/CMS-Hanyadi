# Handoff — FE-36

| Field | Isi |
|---|---|
| Task ID | FE-36 |
| Nama task | Form multi-mapel, lembar soal, dan picker siswa |
| Agent pengirim | PM |
| Agent penerima | Frontend |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `frontend-agent/src/pages/TryoutManagement.jsx`, `frontend-agent/src/api.js`
- Endpoint / UI: `#/tryouts` → form **Buat Tryout Baru**, dialog **Kelola Peserta**, daftar tryout
- Bukti (log, screenshot, test result): `TryoutManagement.jsx:50` `mapel_code` tunggal, `:178-199` load `mapels/siswa/tryouts`, `:401-405` validasi, `:421` payload, `:533-544` satu select, `:761` filter `jenis === 'siswa'`, `:862` satu kolom mapel; `siswaRoutes.js:21-25` sudah scope-only-siswa

## Acceptance Criteria Terpenuhi

- [ ] Form memakai `form.mapel_codes[]`, menampilkan banyak mapel dengan label, mencegah duplikat sebelum submit
- [ ] Payload create mengirim `mapel_codes` (kompatibel dengan BE-39)
- [ ] Sheet picker dikelompokkan per mapel; `sheet_ids` dipangkas saat mapel dicopot; tidak ada duplikat
- [ ] Dialog Kelola Peserta menghapus filter `jenis`, mempertahankan `is_active`, refresh saat dibuka/fokus, dan pesan kosong yang jelas bila 0 siswa aktif
- [ ] Daftar tryout menampilkan semua mapel (mis. `MTKA, IPAS`)

## Catatan Kendala / Risiko

- Gunakan `Promise.all` per mapel untuk `getQuestionSheets` agar tidak menambah endpoint baru.
- Jangan merusak dialog **Atur CBT** dan alur copy URL/delete yang sudah ada.
- Perbaikan `app.js?v=17` ada di agent lain, bukan di sini.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
