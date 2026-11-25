# Decision Log — ADR-020

| Field | Isi |
|---|---|
| ID | ADR-020 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted — seluruh pertanyaan terjawab 2026-11-24; implementasi selesai dan `REL-30` **GO** |
| Terkait task | PM-28, BE-43, FE-40, QA-40, DOC-11, REL-30 |
| Melanjutkan | Fase 6w / `REL-29` (GO); gate `REL-30` terpisah; `REL-01…REL-29` tidak dibuka ulang; Fase 7 tetap dibatalkan |

## Konteks

Pemilik menambahkan dua hal:

1. Bertanya mengapa tryout tidak bisa diedit di halaman Buat/Daftar Tryout, dan meminta kemampuan edit tersebut.
2. Meminta dua tombol unduh di halaman Buat/Daftar Tryout: **Unduh Soal** (soal saja) dan **Unduh Soal + Kunci** (soal beserta kunci jawaban), keduanya menghasilkan file PDF.

Lima pertanyaan terbuka pada catatan awal dan tiga sisa konfirmasi berikutnya sudah diselesaikan 2026-11-24; jawabannya tercatat di bagian **Jawaban Pemilik** dan **Jawaban Lanjutan / Keputusan PM** di bawah.

Hasil pemeriksaan kode 2026-11-24:

- Halaman `frontend-agent/src/pages/TryoutManagement.jsx` hanya menyediakan aksi `Kelola Peserta` (`:1120-1122`), `Atur CBT` (`:1123-1125`), dan `Hapus` (`:1126-1128`). Tidak ada tombol `Ubah`/`Edit`, modal edit, atau API `updateTryout` generik di `frontend-agent/src/api.js`.
- Backend `backend-agent/src/tryoutRoutes.js` hanya memiliki `GET /tryouts` (`:393`), `GET /tryouts/:id` (`:415`), `GET /tryouts/:id/sessions` (`:423`), `PATCH /tryouts/:id/cbt` (`:435`), `DELETE /tryouts/:id` (`:475`), `POST /tryouts/:id/participants` (`:552`), dan `POST /tryouts` (`:585`). **Tidak ada** `PUT`/`PATCH /tryouts/:id` untuk name/schedule/session/mapel/sheet. Satu-satunya `PATCH` adalah pengaturan CBT.
- Status tryout adalah field turunan server dari jadwal: `selesai` bila `now() > ends_at`, `terjadwal` bila `now() < starts_at`, `berlangsung` di antaranya (`db/migrations/030_tryout_events_and_sessions.sql:78-91`, view `:104-109`). Tidak ada guard status yang sengaja mematikan edit; memang tidak ada fitur editnya. ADR-017 `:29` hanya menghapus opsi `jadikan sesi aktif`, bukan fitur edit tryout.
- Belum ada stack PDF di repo. `backend-agent/package.json` hanya memuat `exceljs` (`:18`); `frontend-agent/package.json` dan `presentation-service/package.json` tidak memuat library PDF; tidak ada endpoint, skrip, atau helper `pdfkit`/`jspdf`/`puppeteer`/`wkhtmltopdf`. Ekspor yang ada adalah XLSX via ExcelJS di `tryoutReportRoutes.js:166-457` dengan pola blob download di `frontend-agent/src/api.js` dan `TryoutReport.jsx:81-100`.

## Keputusan

1. **D1 — Jawaban atas pertanyaan pemilik.** Tryout tidak bisa diedit bukan karena status `berlangsung`/`selesai`, melainkan karena tombol edit dan endpoint update memang belum pernah dibuat. Fase 6x menambah keduanya; perilaku hapus dan pengaturan CBT tidak diubah.
2. **D2 — Aksi edit terbatas.** Tambah tombol `Ubah` pada kolom `Aksi` Daftar Tryout. Form edit hanya mengizinkan perubahan **nama** dan **jadwal (mulai/selesai)**. Sesi, mapel, dan peserta tidak bisa diubah; lembar soal yang dipakai hanya **ditampilkan** (read-only). Status turunan dari jadwal akan mengikuti jadwal baru. Tombol `Ubah` tersedia untuk **semua** status (`terjadwal`, `berlangsung`, `selesai`) karena tryout dapat diperpanjang waktunya.
3. **D3 — Endpoint update tryout.** Tambah `PUT` atau `PATCH /tryouts/:id` yang memvalidasi nama dan jadwal setara `POST /tryouts`, transaksional pada `tryout_events`, serta **tidak mengubah `slug`/URL**. JWT peserta lama tetap valid. Permission `tryouts.manage`.
4. **D4 — Dua unduhan PDF per sesi.** Tambah dua aksi unduh dengan cakupan **satu jadwal tryout**, tetapi hasilnya dipisah per sesi: bila satu tryout memiliki 3 sesi, sistem menghasilkan **3 file PDF**. Setiap file memuat minimal `nama lembar soal`, `kode lembar soal`, `mapel`, dan `keterangan`. Varian **soal saja** tanpa kunci/pembahasan; varian **soal + kunci** menyertakan kunci jawaban dan memakai permission RBAC baru. Kedua varian menghasilkan `Content-Type: application/pdf` dan `Content-Disposition: attachment` dengan nama file yang mencerminkan tryout, sesi, dan varian. Pemilik menyerahkan format pengiriman kepada PM. Keputusan PM: setiap klik menghasilkan **satu file ZIP** berisi satu PDF per sesi, berlaku untuk kedua varian; satu unduhan lebih andal daripada beberapa unduhan otomatis yang dapat diblokir browser, dan nama per sesi tetap rapi di dalam ZIP.
5. **D5 — Permission RBAC baru.** Buat permission baru khusus unduh `soal + kunci` agar admin dapat memberikan hak tersebut ke role mana pun; pemilik menolak memakai permission lama secara implisit. Kode permission disetujui pemilik: `tryout_questions.key_export` (mengikuti pola `tryout_reports.read`, `question_sheets.manage`). Tombol **Unduh Soal** tetap memakai `tryouts.manage` atau permission soal yang sudah ada.
6. **D6 — Library PDF di backend.** Pemilik mengonfirmasi pdf generation dilakukan di backend; frontend tidak menambah library PDF. Format halaman dan font dibebaskan kepada implementasi, dengan syarat setiap PDF memuat `nama lembar soal`, `kode lembar soal`, `mapel`, dan `keterangan`.
7. **D7 — Lokasi tombol.** Kedua tombol unduh ditempatkan **per baris Daftar Tryout**, berdampingan dengan aksi `Ubah`, `Kelola Peserta`, `Atur CBT`, dan `Hapus`.
8. **D8 — Ruang lingkapan dan gate.** Fase 6x dengan gate `REL-30`, rollback ke `REL-29`. Tidak ada perubahan pada laporan XLSX Fase 6v/6w; tabel master existing dipakai, migrasi hanya untuk permission RBAC baru. `REL-01…REL-29` tidak dibuka ulang; Fase 7 tetap dibatalkan.
9. **D9 — Isolasi dari Fase 6w.** Task tambahan ini dicatat terpisah agar requirement R1–R12 Fase 6w tidak tercampur. Gate `REL-29` dan `REL-30` tetap terpisah; urutan deploy ditentukan saat development diminta.

## Konsekuensi

- Edit hanya nama/jadwal menyederhanakan endpoint, tetapi status `selesai`/`terjadwal` bisa berubah karena status adalah turunan jadwal; tombol `Ubah` tetap tersedia di semua status dan QA wajib menguji perpanjangan waktu.
- `slug` tidak berubah sehingga URL yang sudah dibagikan dan JWT peserta tetap valid; tombol `Ubah` tidak boleh mengizinkan perubahan slug.
- Ekspor per sesi tetap menghasilkan satu PDF per sesi, tetapi dikirim sebagai satu ZIP; generator internal `backend-agent/src/tryoutExport.js` dipakai tanpa dependency PDF/ZIP baru, dan frontend cukup mengunduh satu blob.
- Varian `soal + kunci` kini terikat permission RBAC baru; role/admin lama tidak otomatis memilikinya sampai diberikan.
- Catatan PM awal: perubahan ini dicatat lebih dulu; implementasi selanjutnya diselesaikan 2026-11-24 dengan migrasi `032`, regresi penuh 194/194, dan gate `REL-30` GO. Perubahan belum di-commit/di-push.

## Jawaban Pemilik — 2026-11-24

| # | Pertanyaan awal | Jawaban |
|---|---|---|
| 1 | Field/status edit | Hanya nama dan jadwal yang bisa diedit; sesi/mapel/peserta tidak diubah, lembar soal yang dipakai hanya ditampilkan |
| 2 | `slug`/URL diubah? | Tidak boleh diubah |
| 3 | Permission & cakupan soal PDF | Permission RBAC baru untuk unduh soal + kunci; cakupan satu jadwal dipisah per sesi — 3 sesi berarti 3 file PDF |
| 4 | Library & format PDF | Library PDF di backend; format halaman/font bebas; wajib memuat nama lembar soal, kode lembar soal, mapel, dan keterangan |
| 5 | Lokasi tombol | Per baris Daftar Tryout |

## Jawaban Lanjutan / Keputusan PM — 2026-11-24

| # | Pertanyaan | Keputusan |
|---|---|---|
| 1 | Batasan status tombol `Ubah` | Semua status (`terjadwal`, `berlangsung`, `selesai`), karena tryout dapat diperpanjang waktunya |
| 2 | Kode permission RBAC | `tryout_questions.key_export` disetujui |
| 3 | Format 3 file per sesi & varian `Unduh Soal` | Pemilik menyerahkan pilihan terbaik kepada PM; PM memilih satu ZIP per klik, berisi satu PDF per sesi, untuk `Unduh Soal` dan `Unduh Soal + Kunci` |

Dengan ini tidak ada pertanyaan terbuka tersisa di ADR-020. Implementasi final 2026-11-24: `PATCH /api/v1/tryouts/{id}` mengubah hanya `name`/`starts_at`/`ends_at` tanpa mengubah `slug`, `GET /api/v1/tryouts/{id}/questions.zip` dan `/questions-with-keys.zip` menghasilkan satu ZIP berisi PDF per sesi, `tryout_questions.key_export` tersedia melalui migrasi `032`, dan regresi penuh 194/194 lolos.

## Alternatif yang Dipertimbangkan

- **Menganggap edit terblokir oleh status tryout**: ditolak; tidak ada guard status, memang tidak ada tombol/endpoint edit.
- **Mengubah `slug`/URL**: ditolak pemilik karena URL sudah dipakai peserta.
- **Satu PDF untuk seluruh sesi**: ditolak; pemilik meminta file dipisah per sesi.
- **Beberapa unduhan PDF terpisah per klik**: tidak dipilih PM; berisiko diblokir browser dan sulit dilacak. Dipilih satu ZIP berisi PDF per sesi.
- **Memakai permission lama untuk kunci jawaban**: ditolak; pemilik meminta permission RBAC baru.
- **Menghasilkan PDF di frontend**: ditolak; pemilik meminta library di backend.
- **Membuka Fase 7**: ditolak; perubahan masuk Fase 6x / `REL-30`.
