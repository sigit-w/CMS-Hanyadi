# Checklist — Uji API & UI

## API

| ID | Skenario | Hasil (pass/fail) | Bukti |
|---|---|---|---|
| A-01 | `GET /health` mengembalikan 200 dengan status database `up` | | |
| A-02 | `GET /api/v1/mapels` mengembalikan 3 mapel wajib | | |
| A-03 | `GET /api/v1/questions` dengan filter & pagination sesuai kontrak | | |
| A-04 | `POST /api/v1/questions` dengan payload valid mengembalikan 201 | | |
| A-05 | Payload invalid mengembalikan 400 dengan `code` yang jelas | | |
| A-06 | Endpoint tidak ditemukan mengembalikan 404, bukan 500 | | |
| A-07 | Error envelope konsisten di semua endpoint | | |
| A-08 | Upload di atas batas mengembalikan 413 | | |
| A-09 | Kunci jawaban tersinkron dengan opsi benar | | |
| A-10 | Endpoint readiness, versi, dan varian (deprecated) mengembalikan 404 | | |
| A-11 | Semua query memakai parameter (tidak ada SQL literal dari user) | | |
| A-12 | Payload `status: draft`/`review` ditolak 400; hanya `approved` diterima | | |
| A-13 | Payload `version`/`ready_version` tidak dipakai; respons tanpa field readiness | | |
| A-14 | Daftar soal mengirim `page`/`limit=20` dan `pagination: { page, limit, total }` | | |

## UI

| ID | Skenario | Hasil (pass/fail) | Bukti |
|---|---|---|---|
| U-01 | Dashboard terbuka dan menu mapel tampil | | |
| U-02 | Form input soal dapat disubmit sampai sukses | | |
| U-03 | Validasi form muncul sebelum submit jika field wajib kosong | | |
| U-04 | Upload menampilkan progres/loading lalu hasil | | |
| U-05 | Daftar soal menampilkan pagination 20 (Prev/Next, "halaman x dari y") & empty state | | |
| U-06 | Filter mapel berubah sesuai pilihan | | |
| U-07 | Error API ditampilkan dengan pesan yang dapat ditindaklanjuti | | |
| U-08 | Tidak ada pilihan versi/readiness; filter status hanya `approved`/`rejected`/`archived` | | |
| U-09 | Tidak ada error konsol saat alur utama dijalankan | | |
| U-10 | Tampilan tetap dapat dipakai pada lebar layar laptop 1366px | | |
| U-11 | Stem soal di daftar CMS dan daftar/detail tryout non-bold (`font-weight: 400`) | | |
| U-12 | Endpoint versi/readiness/varian yang deprecated tidak menimbulkan error konsol | | |
