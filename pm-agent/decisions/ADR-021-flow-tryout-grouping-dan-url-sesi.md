# Decision Log — ADR-021

| Field | Isi |
|---|---|
| ID | ADR-021 |
| Tanggal | 2026-11-25 |
| Pemilik | PM |
| Status | accepted — Q1–Q5 dijawab pemilik 2026-11-25; implementasi/QA selesai; `REL-31` GO dan di-commit sebagai `38af84a` 2026-11-25 |
| Terkait task | PM-29, BE-44, FE-41, TRY-22, QA-41, DOC-12, REL-31 |
| Melanjutkan | Fase 6x / `REL-30` (GO); `REL-01…REL-30` tidak dibuka ulang; Fase 7 tetap dibatalkan |

## Konteks

Pemilik meminta perubahan flow pada halaman Buat/Daftar Tryout:

1. Tryout hanya berfungsi sebagai grouping, mirip kondisi existing.
2. URL test yang dibagikan terhubung dengan sesinya, bukan dengan tryoutnya.
3. Fungsi tryout tetap tampak di laporan seperti saat ini.
4. Saat buat tryout minimal harus ada 1 sesi.
5. Untuk membuat sesi harus ada lembar soal yang dipilih.

Pemilik meminta PM mencatat dan membuat breakdown task, lalu menjawab lima pertanyaan klarifikasi pada 2026-11-25. Jawaban tersebut tercatat di bagian **Jawaban Pemilik** dan menjadi dasar keputusan final di bawah.

Hasil pemeriksaan kode 2026-11-25:

- `frontend-agent/src/pages/TryoutManagement.jsx:43-44` membangun URL peserta dari `tryout.slug`; notifikasi setelah create (`:623`) dan kolom URL di daftar tryout (`:1283`) juga memakai slug event.
- `frontend-agent/src/pages/TryoutManagement.jsx:565-590` **sudah** memvalidasi minimal satu sesi dan minimal satu `sheet_ids` per sesi pada form create.
- `backend-agent/src/tryoutRoutes.js:157-234` `normalizeSessionDefinitions()` menerima `sessions[]`, tetapi masih mengizinkan `question_ids` sebagai pengganti `sheet_ids` (`:177-179`, `:214-216`); payload legacy tanpa `sessions[]` juga masih diterima dan dibagi per mapel.
- `backend-agent/src/tryoutRoutes.js:266-340` `loadEvent()` mengembalikan `slug` event dan `session_slug` sesi pertama, tetapi UI belum memakai `session_slug` untuk URL share.
- `tryout-agent/app.js:61-62` mengambil slug dari URL; `:177-190` menampilkan tab sesi; `:294` mengirim `tryout_slug` saat login. Login scope tryout/sesi sudah tercatat di `db/migrations/025_tryout_slug_login_scope.sql`.
- Laporan tryout dan ekspor XLSX saat ini dikelompokkan per tryout/sesi melalui `backend-agent/src/tryoutReportRoutes.js`; gate `REL-28…REL-30` mengasumsikan struktur laporan ini tidak berubah.

## Keputusan

1. **D1 — Model peran tryout.** `tryout_events` tetap menjadi grouping administratif (nama, jadwal induk, daftar sesi, laporan). Satu `tryout_sessions` menjadi unit eksekusi dan unit URL peserta. Tidak membuat entity baru.
2. **D2 — URL canonical dan sesi target.** URL yang disalin/dibagikan dari Daftar Tryout harus memakai `sessions.slug`. Bila tryout memiliki beberapa sesi, URL tersebut membuka **hanya sesi yang dituju**; peserta tidak diberi tab sesi lain dari URL share tersebut.
3. **D3 — URL event lama.** URL berbasis `tryout_events.slug` ditolak dengan jelas, bukan dialihkan dan bukan menampilkan daftar sesi. Pesan error/halaman harus menjelaskan bahwa tautan sesi yang baru diperlukan.
4. **D4 — Validasi create.** Create tryout wajib memiliki minimal satu sesi; setiap sesi wajib memiliki minimal satu lembar soal aktif yang dipilih. Validasi frontend sudah ada; backend disamakan dan input `question_ids` langsung ditolak tanpa masa transisi.
5. **D5 — Ruang lingkapan grouping.** Jadwal, pengaturan CBT, dan peserta tetap berada di level tryout lalu diterapkan ke semua sesi, seperti kondisi existing. Tidak ada pemindahan ke level sesi.
6. **D6 — Laporan.** UI dan XLSX laporan tetap dikelompokkan per tryout seperti `REL-28…REL-30`. Perubahan URL tidak boleh mengubah agregasi nilai, filter, atau format file; tidak ditambah kolom sesi/slug maupun filter sesi.
7. **D7 — Gate dan isolasi.** Perubahan masuk Fase 6y dengan gate `REL-31`, rollback ke `REL-30`. `REL-01…REL-30` tidak dibuka ulang; Fase 7 tetap dibatalkan.

## Jawaban Pemilik — 2026-11-25

| # | Pertanyaan | Jawaban |
|---|---|---|
| Q1 | URL sesi pada tryout multi-sesi membuka apa? | Hanya sesi target |
| Q2 | Bagaimana URL event slug lama? | Ditolak dengan jelas |
| Q3 | Jumlah lembar soal per sesi dan nasib `question_ids`? | Minimal 1 sheet; `question_ids` ditolak |
| Q4 | Ruang lingkapan jadwal/CBT/peserta? | Tetap level tryout, diterapkan ke semua sesi |
| Q5 | Perubahan format laporan? | Tetap seperti sekarang; grouping tryout dipertahankan |

Dengan ini tidak ada pertanyaan terbuka tersisa di ADR-021.

## Konsekuensi

- Slug per sesi sudah tersedia di skema (`tryout_sessions.slug`), sehingga D2–D3 tidak memerlukan migrasi skema.
- Tautan tryout yang sudah dibagikan akan berhenti berfungsi sesuai D3; tim rilis perlu mengumumkan penggantian ke tautan sesi.
- `tryout-agent` perlu mengabaikan tab sesi lain untuk URL share dan memastikan JWT/Presentation scope hanya mencakup sesi target.
- Backend saat ini lebih longgar daripada frontend; `normalizeSessionDefinitions()` wajib diubah agar klien API tidak dapat membuat sesi dari `question_ids` tanpa lembar soal.
- Format laporan XLSX tidak diubah, sehingga regresi `REL-28…REL-30` tetap menjadi baseline.
- QA tidak boleh menjalankan `npm test` penuh tanpa env QA terpisah karena test recreate data QA; `QA_ADMIN_PASSWORD` saat ini kosong.

## Alternatif yang Dipertimbangkan

- **Memakai URL event slug tetap canonical**: ditolak; URL harus terikat sesi.
- **Redirect URL lama ke sesi pertama/open**: ditolak; pemilik memilih penolakan dengan jelas.
- **Membuka semua sesi dengan target aktif**: ditolak; pemilik memilih hanya sesi target.
- **Membuat tabel/entity sesi baru**: tidak dipilih; `tryout_sessions` sudah ada dan memenuhi kebutuhan grouping.
- **Memindahkan jadwal/CBT/peserta ke level sesi**: ditolak; pemilik memilih ruang lingkapan tryout-level seperti sekarang.
- **Mengubah grouping atau menambah kolom laporan**: ditolak; laporan tetap seperti `REL-28…REL-30`.
- **Menerima `question_ids` dengan masa transisi**: ditolak; pemilik memilih penolakan langsung.
