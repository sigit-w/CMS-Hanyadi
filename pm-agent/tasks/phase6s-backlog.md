# Backlog — Fase 6s: Tryout-Scoped Login & Pemisahan Peserta

| Field | Isi |
|---|---|
| PM | PM-21 |
| Status | accepted — menunggu handoff ke agent |
| Gate | REL-21 |
| ADR | `pm-agent/decisions/ADR-011-tryout-scoped-login-dan-pemisahan-siswa.md` |

## Requirement Pemilik

| ID | Requirement |
|---|---|
| R8 | Peserta/siswa yang tidak terdaftar pada sebuah tryout tidak boleh login ke halaman tryout tersebut. |
| R9 | Setiap tryout perlu penanda unik yang membedakannya dari tryout lain; parameter URL menjadi opsi yang dikaji. |
| R10 | Kelola Siswa tidak boleh menampilkan peserta tryout; data Kelola Siswa dan peserta tryout harus terpisah. |
| R11 | Pendaftaran yang berasal dari tryout hanya disimpan di `public.prospektus`, tidak/belum di `public.siswa`. |

## Keputusan Pemilik

| ID | Keputusan |
|---|---|
| D1 | Pendaftaran dari tryout hanya menulis `prospektus`. Tombol eksplisit **Daftarkan Siswa** di halaman Prospektus tetap menyalin ke `siswa` dan menandai `bergabung=true`. |
| D2 | Data hasil konversi Fase 6r yang sudah masuk `siswa` di-rollback ke `prospektus`, termasuk relasi auth/submission/sesi. Saat pencatatan jumlah `bergabung=true` = 0, sehingga migrasi defensif/no-op. |
| D3 | Marker publik memakai path `/{slug}`, bukan query. Contoh: `https://tryout.hanyadi.web.id/ipas-1126`. |
| D4 | Field URL tryout ditampilkan di halaman Manajemen Tryout dengan tombol salin untuk dibagikan ke publik. |
| D5 | Marker wajib untuk login participant dan diikat ke session/JWT. Login user CMS tidak berubah. |
| D6 | Slug dikunci permanen setelah tryout dibuat. |

## Breakdown Task

| Task ID | Owner | Prioritas | Dependency | Scope |
|---|---|---|---|---|
| PM-21 | PM | P0 | - | ADR-011, backlog, keputusan D1–D5, handoff BE/FE/TRY/PRES/QA |
| BE-36 | Backend | P0 | ADR-011 | Migrasi `025` (slug + binding + rollback REL-20), validasi membership saat login, endpoint siswa & tryout participants, OpenAPI |
| FE-33 | Frontend | P0 | BE-36 (kontrak) | Field URL `/{slug}` di Manajemen Tryout + tombol salin, Kelola Siswa source `siswa`, picker & daftar peserta tryout dari endpoint khusus, pertahankan tombol Daftarkan Siswa di Prospektus |
| TRY-15 | Tryout | P0 | BE-36 (kontrak) | Baca segmen path `/{slug}`, kirim `tryout_slug` saat login, pesan error slug invalid, blok akses tanpa marker; bump versi aset |
| PRES-03 | Presentation | P0 | BE-36 (kontrak) | Pakai `tryout_session_id` dari JWT/session, bukan sesi aktif global, untuk daftar soal & submit |
| QA-33 | QA | P0 | BE-36, FE-33, TRY-15, PRES-03 | Skenario negatif login/scope, pemisahan daftar, regresi penuh, laporan & gate |
| DOC-06S | PM/Docs | P1 | FE-33, QA-33 | OpenAPI, DB doc, README agent, status board, laporan sistem, revisi ADR-010/phase6r |
| REL-21 | PM | P0 | QA-33, DOC-06S | Deploy, verifikasi produksi, commit/push |

## Acceptance Criteria

### BE-36
- [ ] Migrasi `025` idempoten dan backup DB dibuat sebelum diterapkan.
- [ ] `tryout_sessions.slug` unik, terisi untuk seluruh tryout existing, dan dikunci permanen.
- [ ] Migrasi `025` melakukan rollback defensif baris hasil konversi REL-20 ke `prospektus` beserta relasinya.
- [ ] `POST /auth/login` menolak participant tanpa `tryout_slug` yang valid.
- [ ] Participant aktif tetapi tidak punya relasi di `tryout_session_participants` ditolak dengan pesan generik.
- [ ] Participant terdaftar di tryout A tidak bisa login ke slug tryout B.
- [ ] Session participant menyimpan `tryout_session_id`; JWT dan `/auth/me` mengembalikan binding tersebut.
- [ ] `refresh` mempertahankan binding tryout; token tanpa binding tidak bisa mengakses soal/submission sampai login ulang.
- [ ] `GET /api/v1/siswa` hanya mengembalikan `public.siswa`.
- [ ] `GET /api/v1/tryouts/{id}/participants` hanya mengembalikan peserta yang terlampir ke tryout itu.
- [ ] `POST /prospektus/{id}/daftar` tetap tersedia hanya untuk konversi eksplisit dari halaman Prospektus; pembuatan peserta dari tryout tidak pernah menulis ke `siswa`.
- [ ] OpenAPI dan `db/README.md` diperbarui.

### FE-33
- [ ] Manajemen Tryout menampilkan field URL `https://tryout.hanyadi.web.id/{slug}` read-only dan tombol salin.
- [ ] Kelola Siswa hanya menampilkan data dari endpoint siswa.
- [ ] Picker `A. Peserta Didik` dan daftar peserta tryout tidak lagi memakai `GET /participants` gabungan.
- [ ] UI Prospektus tetap menawarkan tombol **Daftarkan Siswa** untuk konversi eksplisit.
- [ ] Build produksi sukses tanpa OOM.

### TRY-15
- [ ] Halaman tryout membaca slug dari segmen path `/{slug}` dan mengirimkannya saat login.
- [ ] Root `/`, reserved path, dan slug tidak dikenal ditangani dengan pesan yang jelas tanpa membocorkan data.
- [ ] Pesan error tidak membocorkan apakah slug/akun benar-benar ada.

### PRES-03
- [ ] Daftar soal dan submit memakai tryout dari JWT/session.
- [ ] Mengganti path `/{slug}` setelah login tidak mengubah tryout yang diakses.
- [ ] Submission tersimpan ke `tryout_session_id` yang sama dengan sesi login.

### QA-33
- [ ] Skenario positif dan negatif login scoped lolos.
- [ ] Pemisahan Kelola Siswa, Prospektus, dan peserta tryout terverifikasi.
- [ ] Regresi penuh lolos tanpa OOM.
- [ ] Laporan QA dan release gate `REL-21 GO` tersedia.

### REL-21
- [ ] Health API/presentation/CMS/tryout 200.
- [ ] Aset produksi terverifikasi.
- [ ] Commit dan push ke `origin/main` terverifikasi.

## Catatan Eksekusi

- Backup DB wajib sebelum migrasi `025`.
- Cek `free -h` sebelum test/build.
- Test: `NODE_OPTIONS=--max-old-space-size=128 npm test`.
- Build: `NODE_OPTIONS=--max-old-space-size=256 npm run build`.
- QA dijalankan serial dengan `QA_ADMIN_PASSWORD` dari `backend-agent/.env`; jangan mencetak secret.
