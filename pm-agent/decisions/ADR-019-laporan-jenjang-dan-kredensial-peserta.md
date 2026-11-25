# Decision Log — ADR-019

| Field | Isi |
|---|---|
| ID | ADR-019 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted — seluruh pertanyaan terjawab pemilik 2026-11-24; implementasi selesai dan `REL-29` **GO** |
| Terkait task | PM-27, BE-42, FE-39, TRY-20, QA-39, DOC-10, REL-29 |
| Melanjutkan | Fase 6v / `REL-28`; `REL-01…REL-28` tidak dibuka ulang; Fase 7 tetap dibatalkan |

## Konteks

Pemilik menyampaikan sepuluh perubahan dalam tiga kelompok:

1. Halaman laporan tryout:
   1. Hapus teks `New Primagama Yogyakarta` dan `Yogyakarta, Selasa, 24 November 2026` dari file hasil unduhan.
   2. Filter pencarian hanya mencari tryout, tidak perlu mencari sesi; bentuknya `select` tetapi tetap bisa dicari dengan mengetik, fitur sama seperti `search2`.
   3. Filter unduhan masih salah: tombol unduh harus memunculkan popup, dan di popup tersebut pengguna memilih laporan tryout yang akan diunduh dengan fitur sama seperti poin 1b.
   4. Bagian waktu diambil dari jam `submitted` terakhir.
2. Halaman kelola mapel:
   1. Tambah satu section **Jenjang Pendidikan** dengan field `kode`, `nama`, `deskripsi`.
   2. Isi jenjang dengan tiga data: `SD`, `SMP`, `SMA`, dengan kode sesuai nama jenjang.
   3. Ubah menu dan teks halaman `Kelola Mapel` menjadi `Kelola Mapel & Jenjang`.
3. Tabel dan halaman kelola siswa serta prospektus:
   1. Tambah field `jenjang` dan `username` di tabel Kelola Siswa dan tabel Prospektus.
   2. Username berupa `[kode jenjang][4 digit terakhir nomor WA orang tua]`.
   3. Cara generate password dan PIN default diubah menjadi `[nomor WA orang tua]`.

Tujuh pertanyaan terbuka pada catatan awal dan empat pertanyaan lanjutan sudah dijawab pemilik 2026-11-24; jawaban dan koreksinya tercatat di bagian **Jawaban Pemilik** dan **Jawaban Lanjutan** di bawah. Keadaan kode saat dicatat: teks identitas XLSX ada di `tryoutReportRoutes.js:321`, `:423-427`; `WAKTU` masih berupa selisih `submitted_at - started_at` dalam pecahan hari (`:272-285`, `:368-370`). Pencarian sesi masih mencakup event, sesi, dan mapel (`tryoutReportRoutes.js:34-44`); tombol unduh langsung mengunduh (`TryoutReport.jsx:81-100`, `:170-172`). Login tryout saat ini memakai `nama`/`email` sebagai identitas (`authRoutes.js:108-137`; `tryout-agent/index.html:23-30`). Belum ada dependency `select2` atau `jquery` di `frontend-agent/package.json`.

## Keputusan

1. **D1 — Hapus identitas dan tanggal dari XLSX.** Baris judul kedua `New Primagama Yogyakarta` serta baris tanda tangan `Yogyakarta, <tanggal>` dan `New Primagama Yogyakarta` dihapus dari file hasil unduhan. Judul utama `HASIL TRYOUT <nama>` dan tampilan layar 7 kolom dipertahankan.
2. **D2 — Pencarian tryout dengan dropdown `select2`.** Koreksi pemilik: yang dimaksud bukan `search2`, melainkan **select2** (`https://select2.org/dropdown/`). Kontrol berupa dropdown yang bisa diketik untuk menyaring opsi; teks pencarian hanya mencocokkan nama tryout/induk (`tryout_events.name`), bukan sesi/mapel. `Cari/Filter` dan debounce dipertahankan. Pemilik mengonfirmasi cukup dropdown React yang setara; **tidak** menambah dependency `select2`/jQuery (repo saat ini hanya punya `SelectNative`).
3. **D3 — Popup unduh hanya tryout.** Tombol unduh membuka popup berisi pemilih laporan tryout dengan dropdown seperti D2. Popup **tidak** menampilkan pemilih sesi. Pilihan di popup dikirim sebagai `tryout_name` ke endpoint ekspor; filter sesi di layar tetap menjadi konteks laporan.
4. **D4 — WAKTU datetime Asia/Jakarta.** Kolom `WAKTU` tidak lagi berupa lama pengerjaan dalam pecahan hari, melainkan datetime dari `submitted_at` terakhir, ditampilkan dalam zona `Asia/Jakarta` (WIB). Format teks disetujui pemilik: `YYYY-MM-DD HH:mm:ss` dalam Asia/Jakarta.
5. **D5 — Jenjang pendidikan.** Jenjang menjadi master data baru dengan field `kode`, `nama`, `deskripsi`, dikelola lewat section tersendiri di halaman `Kelola Mapel & Jenjang`. Permission write memakai `mapels.manage` yang sudah ada; tidak dibuat menu atau permission baru.
6. **D6 — Seed jenjang.** Tiga baris awal `SD`, `SMP`, `SMA`; `kode` sama persis dengan nama jenjang; seed idempoten.
7. **D7 — Nama menu dan halaman.** Label menu Setting dan judul halaman diubah menjadi `Kelola Mapel & Jenjang`; hash `#/mapels` dipertahankan.
8. **D8 — Kolom siswa dan prospektus.** Tabel dan halaman Kelola Siswa serta Prospektus menambah kolom `jenjang` dan `username`; keduanya disimpan di `siswa`/`prospektus`, dikirim lewat API, dan tampil di dialog detail. Data lama tanpa nilai ditandai `-` di UI, bukan error.
9. **D9 — Skema username baru.** `username = [kode jenjang][4 digit angka dari (Hari_ke_dalam_tahun - 1) * 24 + Jam][4 digit nomor WA orang tua]`. Angka tengah di-left-pad dengan `0` menjadi tepat empat digit (rentang nilai `0`–`8783`); empat digit terakhir WA diambil dari nomor yang sudah dinormalisasi. Contoh: jenjang `SD`, jam ke-15 hari ke-1, WA `081234561234` → `SD00151234`. Sumber hari/jam dikonfirmasi pemilik: waktu pembuatan data di zona Asia/Jakarta.
10. **D10 — Password dan PIN default.** Password siswa dan PIN prospektus memakai nomor WA orang tua dalam **digit murni** tanpa `+`, spasi, atau tanda hubung. Generator frontend dan fallback backend keduanya diubah; validasi PIN lama yang menolak selain 9 digit disesuaikan. Kredensial plaintext tetap disimpan seperti Fase 6r.
11. **D11 — Login memakai username.** `username` dipakai sebagai identitas login peserta di `tryout.hanyadi.web.id`, menggantikan `email` (Siswa) dan `nama` (Umum). Yang perlu diselaraskan: `findLoginAccount()` dan `sessionPayload()` di `authRoutes.js`, `participant_username` di `authMiddleware.js`, view `tryout_participants`, label/placeholder/helper form di `tryout-agent/index.html:23-30`, dan dokumentasi. Pemilik mengonfirmasi `username` dipakai untuk kedua jenis peserta dan `email`/`nama` lama **tetap diterima sebagai fallback** login.
12. **D12 — Filter/pengelompokan jenjang.** Jenjang dipakai juga sebagai filter/pengelompokan di Kelola Siswa, Prospektus, dan laporan tryout (disetujui pemilik: di semua tempat).
13. **D13 — Ruang lingkapan dan gate.** Fase 6w, gate `REL-29`, rollback ke `REL-28`; migrasi diperlukan untuk jenjang dan kolom baru dengan backup sebelum eksekusi. `REL-01…REL-28` tidak dibuka ulang; Fase 7 tetap dibatalkan.

## Konsekuensi

- D2 memakai dropdown React setara select2 tanpa dependency jQuery; risiko bundle tetap diuji bersama build hemat memori.
- D11 mengubah kontrak login tryout; QA wajib menguji Siswa dan Umum, termasuk fallback `email`/`nama`, serta refresh/session.
- D9 dan D10 mengharuskan normalisasi nomor WA yang identik di frontend dan backend agar username dan kredensial cocok.
- D5–D8 dan D12 menambah skema, seed, dan filter baru; `REL-29` tidak dibuka sebelum backup dan seed terverifikasi.
- Catatan PM awal: perubahan ini dicatat lebih dulu; implementasi selanjutnya diselesaikan 2026-11-24 dengan migrasi `031`, regresi penuh 194/194, dan gate `REL-29` GO. Perubahan belum di-commit/di-push.

## Jawaban Pemilik — 2026-11-24

| # | Pertanyaan awal | Jawaban |
|---|---|---|
| 1 | Apa yang dimaksud `search2`? | Salah tulis; yang dimaksud **select2**, `https://select2.org/dropdown/` |
| 2 | Popup unduh perlu pemilih sesi? | Cukup tampilkan tryout saja, tanpa sesi |
| 3 | Format `WAKTU`? | Datetime zona Jakarta (Asia/Jakarta) |
| 4 | `username` dipakai untuk login? | Ya, untuk login peserta tryout di `tryout.hanyadi.web.id` |
| 5 | Skema username? | Diubah menjadi `[kode jenjang][4 digit dari (Hari_ke_dalam_tahun - 1) * 24 + Jam][4 digit nomor WA orang tua]` |
| 6 | WA untuk password/PIN boleh memuat karakter lain? | Hanya digit, tanpa karakter lain |
| 7 | Jenjang dipakai untuk filter/pengelompokan? | Ya, jenjang juga perlu dibuat untuk filter/pengelompokan |

## Jawaban Lanjutan Pemilik — 2026-11-24

| # | Pertanyaan lanjutan | Jawaban |
|---|---|---|
| 1 | Dependency `select2`/jQuery atau padanan React? | Cukup dropdown React yang setara; tanpa `select2`/jQuery |
| 2 | `username` untuk kedua jenis peserta dan fallback `email`/`nama`? | Ya — keduanya dipakai, dan identitas lama tetap diterima sebagai fallback |
| 3 | Cakupan filter/pengelompokan jenjang? | Di semua tempat: Kelola Siswa, Prospektus, dan laporan tryout |
| 4 | Format `WAKTU` dan sumber jam/hari username? | Ya benar — `YYYY-MM-DD HH:mm:ss` Asia/Jakarta; jam/hari dari waktu generate data Asia/Jakarta |

Tidak ada pertanyaan terbuka tersisa untuk Fase 6w.

## Alternatif yang Dipertimbangkan

- **Menghapus teks di frontend**: ditolak karena teks dihasilkan backend saat membuat XLSX.
- **`select` statis tanpa pencarian**: ditolak karena pemilik meminta dropdown yang bisa diketik; dipakai padanan React setara select2.
- **Unduhan langsung tanpa popup**: ditolak karena pemilik meminta popup pemilih tryout.
- **`WAKTU` berupa durasi pecahan hari**: ditolak; pemilik meminta datetime hasil submit terakhir.
- **Login tetap memakai `email`/`nama`**: ditolak; pemilik meminta `username` dipakai di subdomain tryout.
- **Jenjang ditempatkan di tabel `mapels`**: ditolak karena pemilik meminta section master data tersendiri.
- **Membuka Fase 7**: ditolak; perubahan masuk Fase 6w / `REL-29`.
