# Decision Log — ADR-011

| Field | Isi |
|---|---|
| ID | ADR-011 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | PM-21, BE-36, FE-33, TRY-15, PRES-03, QA-33, DOC-06S, REL-21 |
| Clarifies | ADR-010 poin 7 dan 9 — konversi prospektus → siswa hanya lewat tombol eksplisit di halaman Prospektus |

## Konteks

Pemilik menyampaikan tiga perubahan setelah `REL-20`:

1. Peserta/siswa yang tidak terdaftar pada sebuah tryout tidak boleh login ke halaman tryout. Saat tryout dibuat perlu penanda unik yang membedakan tryout satu dari tryout lain; pemilik meminta opsi path `/{slug}` dan field URL di halaman manajemen tryout agar bisa dicopy/dibagikan.
2. Masih ada bug pada **Kelola Siswa**: halaman tersebut menampilkan data peserta tryout. Harus dipisahkan antara siswa yang didaftarkan dari tryout dengan siswa yang didaftarkan dari menu Kelola Siswa.
3. Pendaftaran yang berasal dari tryout hanya disimpan di `public.prospektus`, tidak/belum disimpan ke `public.siswa`. Jika dari halaman Prospektus tombol **Daftarkan Siswa** diklik, barulah data masuk ke `public.siswa`.

Kondisi aktual:

- `POST /api/v1/auth/login` hanya menerima `{ username, password }` dan memvalidasi akun participant aktif, tanpa mengecek keanggotaan tryout: `backend-agent/src/authRoutes.js:93-122`, `:142-186`.
- Halaman tryout tidak membawa penanda tryout sama sekali; state dan form login hanya username/password: `tryout-agent/app.js:4-11`, `:91-103`.
- Presentation-service mengecek keanggotaan terhadap **satu sesi aktif global** (`ORDER BY is_active DESC LIMIT 1`), bukan tryout yang dituju: `presentation-service/src/routes.js:16-40`.
- `GET /api/v1/participants` membaca view gabungan `siswa UNION ALL prospektus`, sehingga Kelola Siswa ikut menampilkan Peserta Umum: `backend-agent/src/participantRoutes.js:13-21`, `:161-174`; `db/migrations/024_siswa_prospektus_kredensial.sql:132-146`.
- `POST /api/v1/prospektus/{id}/daftar` saat ini menyalin prospektus ke `siswa` dan menandai `bergabung=true`: `backend-agent/src/participantRoutes.js:201-246`. Perilaku ini tetap dipertahankan **hanya jika dipicu eksplisit dari halaman Prospektus**, bukan saat pembuatan peserta di form tryout.

## Analisis Penanda Tryout

| Opsi | Kelebihan | Kekurangan | Keputusan |
|---|---|---|---|
| ID numerik `/12` | Implementasi paling cepat, ID sudah ada | Mudah ditebak, membocorkan urutan data | Ditolak sebagai marker publik |
| Slug/kode unik `/ipas-1126` | Stabil, mudah dibagikan, tidak mengungkap sequence | Perlu generator + constraint unik | **Dipilih** |
| UUID | Sulit ditebak | Panjang, kurang ramah admin | Cadangan bila slug dianggap terlalu mudah ditebak |
| Signed token | Bisa membawa expiry dan tanda tangan | Perlu secret/rotasi, kompleks | Berlebihan untuk fase ini |
| Query `?tryout=<slug>` | Tidak butuh rewrite | URL kurang rapi; pemilik memilih path | Ditolak |
| Path `/{slug}` | URL rapi dan mudah dibagikan | Butuh fallback SPA | **Dipilih**; fallback sudah tersedia di `/etc/nginx/sites-available/tryout.hanyadi.web.id:58-60` via `try_files $uri $uri/ /index.html` |

Kesimpulan penting: marker di URL **tidak boleh menjadi satu-satunya pengaman**. Participant dapat mengganti path setelah login. Karena itu penanda harus diikat ke session/JWT dan setiap akses soal/submission harus memakai tryout dari session, bukan dari URL atau sesi aktif global.

## Analisis Pemisahan Data

| Kebutuhan | Source of truth | Endpoint |
|---|---|---|
| Kelola Siswa | `public.siswa` saja | `GET /api/v1/siswa` atau `GET /participants?scope=siswa` |
| Prospektus | `public.prospektus` saja | `GET /api/v1/prospektus` (sudah ada) |
| Peserta sebuah tryout | `tryout_session_participants` join ke detail participant | `GET /api/v1/tryouts/{id}/participants` |
| Detail lintas jenis/auth/laporan | view `tryout_participants` | Dipertahankan, bukan dipakai Kelola Siswa |

View `tryout_participants` tetap dipertahankan untuk kompatibilitas auth dan laporan, tetapi tidak lagi boleh menjadi sumber daftar pada halaman Kelola Siswa.

## Keputusan

1. **Marker tryout.** Setiap `tryout_sessions` mendapat `slug VARCHAR(32) UNIQUE` yang di-generate otomatis saat tryout dibuat dan dikunci permanen. Format:huruf kecil, angka, dan tanda hubung; tidak boleh memakai reserved path (`api`, `assets`, `health`, `favicon.ico`).
2. **URL publik.** Link tryout berbentuk `https://tryout.hanyadi.web.id/{slug}`. Halaman **Manajemen Tryout** menampilkan field URL tersebut bersifat read-only dengan tombol salin. Nginx tidak perlu diubah karena `try_files ... /index.html` sudah ada.
3. **Login participant.** Request login participant wajib membawa `tryout_slug` dari segmen path pertama yang bukan reserved. Backend memvalidasi slug ada, tryout aktif, `now()` berada di rentang `start_at`–`end_at`, dan participant memiliki baris di `tryout_session_participants` untuk tryout tersebut.
4. **Binding session.** Session participant menyimpan `tryout_session_id`; JWT dan `/auth/me` mengembalikan `tryout_session_id` serta `tryout_slug`. `refresh` mempertahankan binding. Token lama tanpa binding harus login ulang. Login user CMS tidak berubah dan tidak memakai marker.
5. **Akses soal/submission.** `GET /tryout/questions` dan presentation-service memakai `tryout_session_id` dari JWT/session. Logika sesi aktif global di `presentation-service/src/routes.js:16-40` dihapus/fallback.
6. **Sumber pendaftaran.** Peserta Umum yang dibuat dari form Buat Tryout/Kelola Peserta tetap hanya masuk `prospektus`. Tombol eksplisit **Daftarkan Siswa** di halaman Prospektus tetap boleh menyalin ke `siswa` dan menandai `bergabung=true` sesuai ADR-010; ini bukan Pendaftaran dari tryout.
7. **Pemisahan UI.** Kelola Siswa memakai source `public.siswa`; picker `A. Peserta Didik` dan daftar peserta tryout memakai endpoint khusus. `GET /participants` gabungan tidak dipakai lagi untuk daftar Kelola Siswa.
8. **Rollback data Fase 6r.** Baris `siswa` yang berasal dari konversi prospektus pada REL-20 dikembalikan ke `prospektus`; relasi `tryout_session_participants`, `auth_sessions`, dan `tryout_submissions` ikut dialihkan ke id prospektus. Saat pencatatan ini jumlah `prospektus.bergabung=true` adalah 0, sehingga migrasi bersifat defensif/no-op pada data produksi saat ini.
9. **Gate.** `REL-21` dibuat sebagai gate baru; `REL-20` tetap menjadi catatan historis Fase 6r.

## Konsekuensi

- ADR-010 poin 7 dan 9, R4 di `phase6r-backlog.md`, QA `PS-03`, OpenAPI, dan release gate `REL-20` perlu diberi catatan klarifikasi bahwa konversi hanya terjadi lewat tombol eksplisit di Prospektus.
- Kontrak login tryout berubah; token lama tanpa binding tryout perlu login ulang.
- Build/QA tambahan diperlukan untuk skenario negatif: peserta aktif tanpa relasi tryout, peserta terdaftar di tryout A mencoba login ke tryout B, slug salah/reserved, tryout nonaktif, dan path diubah setelah login.
- Aset tryout perlu version bump agar browser tidak memakai cache lama.
- `REL-15` tetap partial; `REL-21` berdiri sendiri.

## Alternatif yang Dipertimbangkan

- **Hanya cek membership tanpa marker**: lebih sederhana, tetapi tidak memenuhi permintaan penanda unik pemilik.
- **Marker numerik atau query parameter**: ditolak; pemilik memilih path slug.
- **Menghapus konversi prospektus → siswa**: ditolak; pemilik ingin tombol Daftarkan Siswa tetap tersedia dari halaman Prospektus.
- **Menyimpan Peserta Umum langsung ke `siswa`**: ditolak; sumber tryout tetap `prospektus`.
