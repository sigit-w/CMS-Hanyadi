# Backlog — Fase 6w: Laporan Tryout, Jenjang Pendidikan, dan Kredensial Peserta

| Field | Isi |
|---|---|
| Fase | Fase 6w |
| Gate | `REL-29` |
| Tanggal | 2026-11-24 |
| ADR | `ADR-019` |
| Status | done / `REL-29` GO — implementasi, migrasi `031`, QA, dan dokumen selesai |
| Pemilik | PM |
| Melanjutkan | Fase 6v / `REL-28`; `REL-01…REL-28` tidak dibuka ulang; Fase 7 tetap dibatalkan; gate `REL-29` GO |

## Konteks / Masukan Pemilik

Pemilik meminta sepuluh perubahan:

1. Halaman laporan tryout:
   1. Hapus teks `New Primagama Yogyakarta` dan `Yogyakarta, Selasa, 24 November 2026` dari file hasil download.
   2. Filter pencarian hanya mencari tryout saja, tidak perlu mencari sesi; bentuknya `select`, tetapi bisa juga dicari dengan mengetik, fitur seperti `search2`.
   3. Filter download masih salah: saat tombol unduh diklik harus muncul popup; di popup pengguna memilih laporan tryout yang akan diunduh dengan fitur seperti poin 1b.
   4. Bagian waktu diambil dari jam `submitted` terakhir.
2. Halaman kelola mapel:
   1. Tambah section **Jenjang Pendidikan** dengan field `kode`, `nama`, `deskripsi`.
   2. Isi jenjang dengan tiga data `SD`, `SMP`, `SMA`; kode sesuai nama jenjang.
   3. Ubah menu dan teks halaman kelola mapel menjadi `Kelola Mapel & Jenjang`.
3. Tabel dan halaman kelola siswa serta prospektus:
   1. Tambah field `jenjang` dan `username` di tabel Kelola Siswa dan tabel Prospektus.
   2. Username awalnya `[kode jenjang][4 digit terakhir nomor WA orang tua]`; **dikoreksi pemilik** menjadi `[kode jenjang][4 digit dari (Hari_ke_dalam_tahun - 1) * 24 + Jam][4 digit nomor WA orang tua]`.
   3. Ubah generate password dan PIN default menjadi `[nomor WA orang tua]` dalam digit murni.

Tujuh pertanyaan awal dan empat pertanyaan lanjutan sudah dijawab pemilik 2026-11-24: `select2` (bukan `search2`) diimplementasikan sebagai dropdown React setara tanpa `select2`/jQuery; popup hanya tryout tanpa sesi; `WAKTU` datetime `YYYY-MM-DD HH:mm:ss` Asia/Jakarta; username dipakai login tryout untuk Siswa dan Umum dengan `email`/`nama` lama sebagai fallback; skema username direvisi dengan jam/hari dari waktu generate Asia/Jakarta; WA digit murni; jenjang dipakai untuk filter/pengelompokan di semua tempat. Detail ada di `pm-agent/decisions/ADR-019-laporan-jenjang-dan-kredensial-peserta.md`. Implementasi Fase 6w sudah selesai dan terverifikasi pada 2026-11-24 dengan regresi penuh 194/194 dan gate `REL-29` GO.

## Requirement

| ID | Requirement | PM | Status | Gate | ADR |
|---|---|---|---|---|---|
| R1 | Hapus `New Primagama Yogyakarta` dan baris tanggal `Yogyakarta, <tanggal>` dari XLSX hasil unduhan | PM-27 | done | REL-29 | ADR-019 |
| R2 | Pencarian laporan hanya tryout; dropdown `select2` yang bisa diketik; tidak mencari sesi/mapel | PM-27 | done | REL-29 | ADR-019 |
| R3 | Tombol unduh membuka popup berisi pemilih tryout (tanpa sesi) dengan dropdown seperti R2 | PM-27 | done | REL-29 | ADR-019 |
| R4 | Kolom `WAKTU` XLSX memakai datetime `submitted_at` terakhir dalam zona Asia/Jakarta | PM-27 | done | REL-29 | ADR-019 |
| R5 | Section Jenjang Pendidikan di Kelola Mapel dengan `kode`, `nama`, `deskripsi` | PM-27 | done | REL-29 | ADR-019 |
| R6 | Seed jenjang `SD`, `SMP`, `SMA` dengan kode sama dengan nama | PM-27 | done | REL-29 | ADR-019 |
| R7 | Menu dan judul halaman `Kelola Mapel` → `Kelola Mapel & Jenjang` | PM-27 | done | REL-29 | ADR-019 |
| R8 | Kolom `jenjang` dan `username` di tabel Kelola Siswa dan Prospektus | PM-27 | done | REL-29 | ADR-019 |
| R9 | `username = [kode jenjang][4 digit ((hari ke dalam tahun - 1) * 24 + jam)][4 digit WA orang tua]` | PM-27 | done | REL-29 | ADR-019 |
| R10 | Password/PIN default = nomor WA orang tua digit murni, tanpa `+`/spasi/`-` | PM-27 | done | REL-29 | ADR-019 |
| R11 | Turunan: `username` dipakai untuk login peserta di `tryout.hanyadi.web.id` | PM-27 | done | REL-29 | ADR-019 |
| R12 | Turunan: jenjang dipakai untuk filter/pengelompokan di Kelola Siswa, Prospektus, dan laporan tryout | PM-27 | done | REL-29 | ADR-019 |

## Keputusan

Ringkas; detail, jawaban pemilik, dan alternatif ada di `pm-agent/decisions/ADR-019-laporan-jenjang-dan-kredensial-peserta.md`.

| ID | Keputusan | Alasan |
|---|---|---|
| D1 | Teks identitas dan tanggal dihapus dari generator XLSX; judul utama dan tampilan layar dipertahankan | Teks berasal dari backend |
| D2 | Dropdown React setara `select2` (bukan `search2`), hanya nama tryout; `Cari/Filter` tetap ada | Koreksi pemilik; tanpa dependency `select2`/jQuery |
| D3 | Unduh lewat popup berisi pemilih tryout saja, tanpa sesi; endpoint tetap memakai `tryout_name` | Sesuai jawaban pemilik; kontrak Fase 6v dipakai ulang |
| D4 | `WAKTU` = datetime `submitted_at` terakhir berformat `YYYY-MM-DD HH:mm:ss` Asia/Jakarta, bukan durasi | Sesuai jawaban pemilik |
| D5 | Jenjang = master data baru (`kode`, `nama`, `deskripsi`), permission `mapels.manage` | Section terpisah diminta; tidak menambah permission/menu |
| D6 | Seed tiga jenjang `SD`/`SMP`/`SMA`; hash `#/mapels` tidak diubah | Data diminta eksplisit; tautan lama tetap valid |
| D7 | Label menu/halaman menjadi `Kelola Mapel & Jenjang` | Sesuai permintaan |
| D8 | `jenjang` dan `username` disimpan di `siswa` dan `prospektus`, tampil di tabel/detail; data lama ditandai `-` | Kolom baru tidak boleh membuat halaman error |
| D9 | Username: kode jenjang + 4 digit angka `(hari-1)*24+jam` (di-left-pad `0`) + 4 digit WA; sumber waktu = pembuatan data di Asia/Jakarta | Skema revisi pemilik, sumber waktu dikonfirmasi; nilai maksimal 8783 sehingga 4 digit cukup |
| D10 | Password/PIN memakai digit WA murni; validasi PIN lama disesuaikan | Pemilik menolak karakter selain digit |
| D11 | Login tryout memakai `username` untuk Siswa dan Umum; `email`/`nama` tetap diterima sebagai fallback | Sesuai jawaban pemilik |
| D12 | Jenjang dipakai sebagai filter/pengelompokan di semua tempat | Sesuai jawaban pemilik |
| D13 | Migrasi DB diperlukan; backup sebelum migrasi; rollback ke `REL-28`; gate `REL-29` | Perubahan menyentuh skema dan seed |

## Acceptance Criteria

- **AC1 (R1):** File XLSX hasil unduhan tidak memuat `New Primagama Yogyakarta`, `NEW PRIMAGAMA YOGYAKARTA`, atau baris bertanda `Yogyakarta, <tanggal>`. Baris judul `HASIL TRYOUT <nama>` masih ada.
- **AC2 (R2):** Dropdown React pencarian laporan berperilaku seperti `select2` tanpa dependency `select2`/jQuery: bisa diketik untuk menyaring opsi. Hanya nama tryout yang dicari; mencari nama sesi/mapel tidak menghasilkan opsi. `Cari/Filter` masih menerapkan sesi terpilih.
- **AC3 (R3):** Tombol unduh membuka popup berisi dropdown tryout tanpa pilihan sesi; memilih tryout lalu mengunduh menghasilkan XLSX hanya untuk tryout itu dengan `tryout_name` terkirim ke endpoint. Tidak ada unduhan langsung dari tombol utama.
- **AC4 (R4):** Kolom `WAKTU` berisi datetime `submitted_at` terakhir untuk peserta/sesi terfilter dengan format `YYYY-MM-DD HH:mm:ss` Asia/Jakarta, bukan selisih `submitted_at - started_at` dalam pecahan hari.
- **AC5 (R5):** Halaman `Kelola Mapel & Jenjang` memiliki section Jenjang Pendidikan dengan form `kode`, `nama`, `deskripsi` dan daftar jenjang yang bisa dikelola dengan permission `mapels.manage`.
- **AC6 (R6):** Tersedia tiga jenjang awal `SD`, `SMP`, `SMA` dengan `kode` sama dengan `nama`; seed idempoten saat migrasi.
- **AC7 (R7):** Menu Setting dan judul halaman menampilkan `Kelola Mapel & Jenjang`; rute `#/mapels` masih membuka halaman tersebut.
- **AC8 (R8):** Tabel dan dialog detail Kelola Siswa serta Prospektus menampilkan `jenjang` dan `username`; data lama menampilkan `-` tanpa error.
- **AC9 (R9):** Untuk jenjang `SD`, jam ke-15 hari ke-1 (Asia/Jakarta, waktu generate), dan WA `081234561234`, username tersimpan `SD00151234`; angka tengah di-left-pad menjadi 4 digit dan `+`/spasi/`-` pada WA diabaikan.
- **AC10 (R10):** Password siswa dan PIN prospektus hasil generate sama persis dengan nomor WA orang tua dalam digit murni; generator frontend dan fallback backend konsisten; validasi PIN mengikuti panjang WA.
- **AC11 (R11):** Login di `tryout.hanyadi.web.id` memakai `username` untuk Siswa dan Umum; `email`/`nama` lama tetap berhasil sebagai fallback; label/placeholder/helper form disesuaikan; session/refresh/`/me` mengembalikan username baru.
- **AC12 (R12):** Tersedia filter/pengelompokan jenjang di Kelola Siswa, Prospektus, dan laporan tryout dengan hasil yang konsisten dengan master jenjang.
- **AC13 (regresi):** Regresi `REL-24…REL-28` tetap lolos; tidak ada kunci jawaban/pembahasan di XLSX; permission lama tidak berubah.

## Breakdown Task

| ID | Agent | Deskripsi | AC | Gate | Status | ADR |
|---|---|---|---|---|---|---|
| PM-27 | PM | Mencatat 10 poin perubahan + 2 requirement turunan, jawaban pemilik, ADR-019, backlog, status board, indeks README | R1–R12 | REL-29 | done | ADR-019 |
| BE-42 | Backend | Hapus teks/tanggal XLSX; `WAKTU` datetime Jakarta dari `submitted_at` terakhir; pencarian `tryout_name` dengan dropdown React setara select2; ekspor dari popup; migrasi `031` jenjang + seed; `jenjang_id`/`username` di siswa/prospektus; generator username/password/PIN; login by `username` dengan fallback `email`/`nama` di authRoutes/authMiddleware/view `tryout_participants`; filter jenjang; OpenAPI & DB README | R1–R12 | REL-29 | done | ADR-019 |
| FE-39 | Frontend | Dropdown React setara select2 tryout-only + popup unduh; section jenjang + CRUD; label `Kelola Mapel & Jenjang`; kolom/filter jenjang & username di semua halaman; generator password/PIN dari WA; build `index-wgOfGZ4O.js`; perbaikan lanjutan `withQuery` null-safe, label `&`, dan Combobox bisa dibuka ulang | R2, R3, R5–R10, R12 | REL-29 | done | ADR-019 |
| TRY-20 | Tryout | Form login `tryout-agent/index.html` pakai `username`; kirim `{username,password,tryout_slug}`; verifikasi login Siswa/Umum dan session display; aset `app.js?v=19` | AC11, AC13 | REL-29 | done | ADR-019 |
| QA-39 | QA | Skenario `Q6W-01…Q6W-05` + regresi penuh 194/194; XLSX, seed, migrasi, username, kredensial WA, login tryout, filter jenjang; fixture dibersihkan | R1–R12, AC13 | REL-29 | done | ADR-019 |
| DOC-10 | Dokumentasi | OpenAPI, README backend/DB, arsitektur filter & jenjang, kontrak login tryout, ADR/backlog/status board tersinkron | R1–R12 | REL-29 | done | ADR-019 |
| REL-29 | Release | Backup `/tmp/opencode/bank_soal_db-pre6wx-2026-11-24.dump`, deploy, smoke test, rollback ke `REL-28`, gate **GO** | R1–R12 | REL-29 | done / GO | ADR-019 |

## Rencana Handoff

Handoff development dicatat melalui ADR-019, backlog ini, dan status board; file handoff terpisah tidak dibuat pada iterasi ini:

- `tasks/handoff-BE42.md`
- `tasks/handoff-FE39.md`
- `tasks/handoff-TRY20.md`
- `tasks/handoff-QA39.md`
- `tasks/handoff-DOC10.md`
- `tasks/handoff-REL29.md`

## Risiko & Catatan

- Seluruh pertanyaan Fase 6w sudah dijawab pemilik 2026-11-24: dropdown React setara select2, login `username` untuk Siswa & Umum dengan fallback `email`/`nama`, filter jenjang di semua tempat, format `YYYY-MM-DD HH:mm:ss`, dan sumber jam/hari dari waktu generate Asia/Jakarta.
- Tidak ada dependency `select2`/jQuery yang ditambahkan; perilaku search dropdown dibangun dengan komponen React existing/menyesuaikan `SelectNative`.
- Validasi PIN backend kini menerima 8–15 digit (`requirePin` `/^\d{8,15}$/`); frontend dan backend sudah diselaraskan.
- Normalisasi WA harus identik di frontend/backend agar username dan kredensial sesuai.
- Data lama tidak memiliki `jenjang`/`username`; perlu backfill atau tampilan `-` agar tabel tidak error.
- Migrasi jenjang dan kolom baru memerlukan backup; rollback `REL-28` harus diuji sebelum gate.
- Implementasi dan QA selesai; seluruh perubahan masih di working tree dan belum di-commit/di-push. Gate `REL-29` GO berdasarkan regresi penuh 194/194, migrasi `031`, build, dan health checks.
