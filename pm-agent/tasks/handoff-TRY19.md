# Handoff — TRY-19

| Field | Isi |
|---|---|
| Task ID | TRY-19 |
| Nama task | Alur sesi dan lanjutan tryout user |
| Agent pengirim | PM |
| Agent penerima | Tryout |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `tryout-agent/app.js`, `tryout-agent/index.html`
- Endpoint / UI: tryout publik `https://tryout.hanyadi.web.id/{slug}`, daftar/tab sesi peserta
- Bukti (log, screenshot, test result): tab sesi, lanjut/keluar per sesi, login ulang sampai batas induk; aset `app.js?v=19` ter-serve; regresi 32/32 tanpa degradasi `REL-24`…`REL-26`

## Acceptance Criteria Terpenuhi

- [x] Daftar/tab sesi tampil; hanya soal sesi terpilih yang dimuat
- [x] Setelah sesi selesai muncul `Lanjut sesi berikutnya` dan `Keluar`
- [x] Login ulang mengembalikan daftar sesi selama batas induk belum terlampaui
- [x] Sesi yang sudah selesai terkunci; tidak ada submit ulang
- [x] Asset di-bump ke `app.js?v=19`
- [x] 401 gate netral (`REL-24`), debounce 750 ms (`REL-25`), dan submit global per sesi (`REL-26`) tidak diregresi

## Catatan Kendala / Risiko

- Jangan menampilkan skor, kunci, atau pembahasan ke peserta.
- Perubahan marker UI harus disinkronkan dengan QA-37.
- CSS hanya diubah jika benar-benar perlu; jika berubah, bump `styles.css?v=15`.

## Tindakan Penerima

- [x] Diterima
- [ ] Ditolak, alasan:
