# Handoff — TRY-18

| Field | Isi |
|---|---|
| Task ID | TRY-18 |
| Nama task | Notifikasi pelanggaran & satu submit global |
| Agent pengirim | PM |
| Agent penerima | Tryout |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `tryout-agent/app.js`, `tryout-agent/index.html`, `tryout-agent/styles.css` (jika perlu)
- Endpoint / UI: `POST /api/v1/presentation/cbt/attempt/violation`, `POST /api/v1/presentation/attempts/submit-all` (BE-39/PRES-06), tombol `finalizeButton`, daftar soal
- Bukti (log, screenshot, test result): `app.js:601` `recordViolation`, guard `:604-605` 750 ms, `:22` `lastFocusLossAt`, `:174` reset; `index.html:78` `app.js?v=17`; `qa-agent/tests/cbt.mjs:372` `CBT-06`

## Acceptance Criteria Terpenuhi

- [ ] Setiap violation yang tercatat menampilkan toast `"Pelanggaran tercatat: <label> (n/m)"` dengan `m = max_violations` dari response
- [ ] Satu kejadian tab-switch/fullscreen-exit tidak menghasilkan dua toast (debounce 750 ms dipertahankan)
- [ ] Auto-submit tetap terjadi sesuai kuota; toast terakhir menyebut attempt terkunci
- [ ] Tidak ada lagi tombol submit/simpan per soal; jawaban masuk state lokal
- [ ] Non-CBT: satu tombol global dengan konfirmasi → `submit-all`; CBT: `finalizeButton` tetap satu-satunya submit
- [ ] Asset di-bump ke `app.js?v=18` (`styles.css?v=15` jika CSS berubah)

## Catatan Kendala / Risiko

- **Dilarang** mengubah `cbt_max_violations` dari `3`.
- Jangan regresi perbaikan `REL-24` (401 awal → login netral) dan `REL-25` (debounce violation).
- Jangan menampilkan skor/kunci kepada peserta.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
