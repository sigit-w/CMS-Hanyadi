# Handoff — TRY-12 (Fase 6o)

| Field | Isi |
|---|---|
| Task ID | TRY-12 |
| Nama task | Sesuaikan aturan login halaman tryout untuk Nama + PIN Peserta Umum |
| Agent pengirim | PM |
| Agent penerima | Agent Tryout |
| Tanggal | 2026-11-24 |
| Status | done — aset `styles.css?v=11`/`app.js?v=12` terlayani, QA U-09 lolos |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-007-peserta-umum-tryout.md`, `pm-agent/tasks/phase6o-backlog.md`
- Target utama: `tryout-agent/index.html`, `tryout-agent/app.js`, `tryout-agent/styles.css` bila perlu, `tryout-agent/README.md` bila ada
- Endpoint yang dipakai: `POST /api/v1/auth/login` dan `GET /api/v1/auth/me` (kontrak tidak berubah)
- Bukti: label saat ini `Email peserta` dan input `type="email"` di `index.html:21-24`; payload login ada di `app.js:91-110`; cache saat ini `styles.css?v=10` dan `app.js?v=11` (`index.html:7,72`)

## Acceptance Criteria

- [ ] Label username diubah menjadi `Nama atau Email peserta`; placeholder menjelaskan "Nama Peserta Umum atau email Siswa". Input username bertipe `text`, bukan `email`.
- [ ] Label password diubah menjadi `Password atau PIN`; placeholder menjelaskan "PIN 9 digit untuk Peserta Umum".
- [ ] Tambahkan teks bantu singkat di gate login: Peserta Umum login memakai Nama + PIN; Siswa tetap memakai Email + Password.
- [ ] Payload `POST /auth/login` tetap `{ username, password }`; PIN dikirim pada field `password`. Tidak menambah field `pin` atau endpoint baru.
- [ ] Login Peserta Umum dengan Nama + PIN berhasil, lalu `checkSession()` menampilkan nama sebagai identitas dan memuat daftar soal seperti biasa.
- [ ] Login Siswa existing dengan email + password tetap berhasil dan tidak perlu mengubah alur lain.
- [ ] Pesan error login bersifat netral, misalnya "Nama/email atau PIN/password salah", dan tidak membocorkan apakah akun Umum atau Siswa.
- [ ] Aset statis di-bump menjadi `styles.css?v=11` dan `app.js?v=12`; verifikasi CMS/proxy menyajikan versi baru dan tidak ada cache lama.
- [ ] Alur daftar soal, buka soal, submit jawaban, logout, dan refresh sesi tidak berubah.

## Catatan Kendala / Risiko

- Bergantung pada kontrak BE-32, khususnya resolusi login Umum→Siswa→CMS dan fallback `nama` di `/auth/me`.
- Jangan menyimpan PIN di `localStorage`, URL, atau log browser; cukup kirim lewat form login yang sudah ada.
- Jika `/auth/me` belum mengembalikan nama untuk Umum, laporkan ke BE-32/QA-29, jangan mengakalinya di UI.
- Koordinasikan nomor versi aset dengan QA-29 karena test mereferensikan pola `?v=`.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
