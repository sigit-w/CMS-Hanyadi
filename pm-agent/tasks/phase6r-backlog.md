# Backlog Fase 6r — Perubahan Flow Tryout: Siswa, Prospektus & Kredensial

Tanggal: 2026-11-24  
Sumber keputusan: `pm-agent/decisions/ADR-010-siswa-prospektus-kredensial.md`  
Gate: `REL-20`

## Requirement Pemilik

| # | Requirement |
|---|---|
| R1 | Saat user memilih `B. Peserta Umum` di halaman Buat Tryout, data disimpan di tabel `prospektus`, bukan di tabel `siswa`; struktur `prospektus` sama dengan `siswa`. |
| R2 | Popup/halaman detail siswa atau peserta menampilkan password atau PIN. |
| R3 | Baris data pada halaman Prospektus diklik menampilkan detail peserta dan tombol `Daftarkan sebagai Siswa`. |
| R4 | Pendaftaran menyimpan data ke tabel `siswa` dan menandai data prospektus sebagai `bergabung`. |
| R5 | Peserta Umum tetap bisa login dengan Nama + PIN. |
| R6 | Password user CMS tetap dienkripsi/hash dan tidak ditampilkan. |
| R7 | Update, commit, dan push ke GitHub `cms-hanyadi`. |

## Breakdown Task

| Task ID | Owner | Prioritas | Dependency | Ringkasan |
|---|---|---|---|---|
| PM-20 | PM | P0 | - | ADR-010 accepted; backlog + handoff diterbitkan |
| BE-35 | Backend | P0 | ADR-010 | Migrasi `024`, tabel `siswa`/`prospektus`, view kompatibel, endpoint detail & daftar, auth, OpenAPI, DB doc |
| FE-32 | Frontend | P0 | BE-35 (kontrak) | Detail kredensial, baris Prospektus + tombol daftar, badge `Bergabung`, build |
| TRY-14 | Tryout | P1 | BE-35 (kontrak) | Smoke login Umum & Siswa; verifikasi aset statis tidak berubah |
| QA-32 | QA | P0 | BE-35, FE-32, TRY-14 | `PS-01..PS-07`, regresi penuh, laporan & gate |
| DOC-06R | PM/Docs | P1 | FE-32, QA-32 | Laporan sistem, status board, README agent diperbarui |
| REL-20 | PM | P0 | QA-32, DOC-06R | Deploy, commit, push, verifikasi `origin/main` |

## Acceptance Criteria

### BE-35
- [x] Migrasi `024_siswa_prospektus_kredensial.sql` idempoten dan terpasang; backup DB dibuat lebih dulu.
- [x] `public.siswa` dan `public.prospektus` punya struktur kolom sama; `prospektus` punya `bergabung`/`bergabung_at`.
- [x] POST peserta `jenis='umum'` menulis ke `prospektus`; `jenis='siswa'` ke `siswa`.
- [x] `GET /prospektus` mengembalikan seluruh prospek dengan `bergabung` dan kredensial hanya lewat detail.
- [x] `GET /participants/{id}/detail` dan `GET /prospektus/{id}` mengembalikan `password_plain`/`pin_plain`.
- [x] `POST /prospektus/{id}/daftar` membuat siswa, menandai `bergabung=true`, dan menolak prospek yang sudah bergabung.
- [x] Login Umum (Nama + PIN) dan Siswa (Email + Password) lolos; password CMS tetap scrypt.
- [x] Trigger integritas menolak `participant_id` yang tidak ada di kedua tabel.
- [x] OpenAPI dan `db/README.md` sesuai implementasi.

### FE-32
- [x] Detail peserta di Buat Tryout/Kelola Peserta menampilkan PIN/Password dari endpoint detail.
- [x] Kelola Siswa memiliki aksi detail yang menampilkan password siswa.
- [x] Baris Prospektus diklik membuka detail dengan tombol `Daftarkan sebagai Siswa`.
- [x] Form daftar berisi email, kelas, program belajar, dan password opsional; validasi sesuai backend.
- [x] Prospek yang sudah didaftarkan menampilkan badge `Bergabung`.
- [x] Build produksi sukses dan aset terdeploy.

### TRY-14
- [x] Tidak ada perubahan source `tryout-agent`.
- [x] Login Nama + PIN untuk Umum dan Email + Password untuk Siswa masih berfungsi.

### QA-32
- [x] `PS-01..PS-07` lolos.
- [x] Regresi penuh `npm test` lolos tanpa OOM.
- [x] `qa-agent/reports/phase6r-report.md` dan `phase6r-release-gate.md` tersedia dengan `REL-20 GO`.

### REL-20
- [x] Health API 200, aset CMS/tryout terverifikasi.
- [x] Commit dibuat dan `origin/main` terverifikasi setelah push.

## Catatan Eksekusi

- Cek `free -h` sebelum test/build.
- Test: `NODE_OPTIONS=--max-old-space-size=128 npm test`.
- Build: `NODE_OPTIONS=--max-old-space-size=256 npm run build`.
- Backup DB sebelum migrasi `024`.
- Jangan menjalankan dua build/test besar bersamaan.
