# Decision Log — ADR-022

| Field | Isi |
|---|---|
| ID | ADR-022 |
| Tanggal | 2026-11-25 |
| Pemilik | PM |
| Status | accepted — Q1–Q6 dijawab pemilik 2026-11-25; implementasi/QA/DOC selesai; `REL-32` GO 2026-11-25 |
| Terkait task | PM-30, BE-45, FE-42, QA-42, DOC-13, REL-32 |
| Melanjutkan | Fase 6y / `REL-31` (GO, commit `38af84a`); `REL-01…REL-31` tidak dibuka ulang; Fase 7 tetap dibatalkan |

## Konteks

Pemilik meminta sesi Fase 6y ditutup dan sesi baru difokuskan ke halaman Daftar Soal serta penyajian kredensial peserta:

1. Setiap baris soal pada Daftar Soal menampilkan angka yang menyatakan berapa kali soal tersebut digunakan di lembar soal.
2. Impor soal hanya menerima file CSV dan XLSX.
3. Bagian impor soal memiliki tautan download template; isi template adalah contoh lengkap dan valid yang bisa langsung dipakai sebagai dasar impor.
4. Metode impor soal dengan payload dihapus.
5. Pada setiap data yang menampilkan siswa/peserta, username dan PIN/password diletakkan berdekatan serta ada fitur copy ke clipboard untuk memudahkan pembagian kredensial.
6. Menu `Peserta Tryout` dan nama halamannya diubah menjadi `Peserta Umum`.
7. Tombol `Kelola Peserta` pada Daftar Tryout tidak membuka popup lagi, melainkan halaman baru khusus tryout yang bersangkutan.

Pemilik meminta PM mencatat dan membuat breakdown task, lalu menjawab enam pertanyaan klarifikasi pada 2026-11-25. Jawaban tersebut tercatat di bagian **Jawaban Pemilik** dan menjadi dasar keputusan final di bawah.

Hasil pemeriksaan kode 2026-11-25:

- `frontend-agent/src/pages/Dashboard.jsx:366-370` menampilkan tipe, difficulty, status kunci, sumber, dan daftar lembar soal per baris; belum ada kolom jumlah pemakaian.
- `backend-agent/src/questionSheetRoutes.js:14-22` mengembalikan `question_count` dan `used_by_tryout` boolean untuk lembar soal; `:176-190` melampirkan `sheets` ke tiap soal tetapi belum ada angka pemakaian per soal.
- `frontend-agent/src/pages/QuestionInput.jsx:25-35,121-130,244-263` masih memiliki mode impor `File`/`Payload`, sumber `file_upload`/`external_collection`/`manual`, dan `accept` `.json,.csv,.txt`.
- `backend-agent/src/routes.js:502-557` menerima `file`, `content`, atau `questions[]` pada `POST /api/v1/questions/import`.
- `backend-agent/src/importer.js:81-101` mengenali JSON/CSV/TXT; XLSX belum didukung, sementara `exceljs` sudah tersedia di backend untuk ekspor laporan.
- `backend-agent/src/participantRoutes.js:37-47` mengembalikan `password_plain` dan `pin_plain` hanya melalui endpoint detail; daftar belum mengembalikan kredensial.
- `frontend-agent/src/pages/PesertaManagement.jsx:427-439`, `frontend-agent/src/pages/ProspektusManagement.jsx:198-213`, dan `frontend-agent/src/pages/TryoutManagement.jsx:1104-1118` menampilkan kredensial pada dialog/detail terpisah.
- `frontend-agent/src/App.jsx:50` memakai label `Peserta Tryout` untuk hash `#/tryouts/prospektus`; `:161-162` merender `ProspektusManagement`.

## Keputusan

1. **D1 — Penutupan sesi dan fase baru.** Fase 6y / `REL-31` ditutup. Permintaan ini masuk Fase 6z dengan gate `REL-32`, rollback ke `REL-31`. `REL-01…REL-31` tidak dibuka ulang; Fase 7 tetap dibatalkan.
2. **D2 — Angka pemakaian soal.** Setiap baris Daftar Soal menampilkan jumlah relasi ke lembar soal **aktif** yang memuat soal tersebut. Lembar yang diarsipkan atau dihapus tidak dihitung. Angka harus tersedia lewat API daftar soal dan tetap benar pada pagination/filter.
3. **D3 — Format impor.** UI dan API hanya menerima CSV dan XLSX. Mode Payload dihapus dari UI. Backend menolak JSON, TXT, `content`, dan `questions[]` dengan `400 VALIDATION_ERROR` yang menjelaskan format yang diterima.
4. **D4 — Template impor.** Disediakan dua tautan unduhan: template CSV dan template XLSX. Keduanya berisi contoh lengkap dan valid—header kolom wajib, opsi, kunci, tipe, dan difficulty—serta langsung lolos validator import. Template menjadi bagian dari dokumentasi dan artefact build frontend.
5. **D5 — Kredensial siswa/peserta.** Pada semua tampilan daftar/detail siswa, prospektus, dan peserta tryout, username ditampilkan berdekatan dengan PIN/password. Satu tombol copy menyalin nama beserta pasangan kredensial dalam format `Nama: <value>\nusername: <value>\nPIN/password: <value>`. User CMS tidak termasuk. Plaintext tetap hanya untuk peran CMS berpermission dan tidak diekspos ke API peserta/publik.
6. **D6 — Nama Peserta Umum.** Menu, judul halaman, judul dialog, hash/route, QA marker, dan dokumentasi untuk `Peserta Tryout` diganti menjadi `Peserta Umum`. Hash/route lama tetap menjadi alias redirect agar bookmark lama tidak menampilkan halaman kosong.
7. **D7 — Isolasi regresi.** Fase 6z tidak mengubah format laporan tryout, alur URL sesi, atau gate `REL-24…REL-31`. QA wajib menjalankan skenario baru dan regresi penuh sebelum `REL-32` GO.
8. **D8 — Kelola Peserta sebagai halaman.** Tombol `Kelola Peserta` hanya aktif untuk tryout yang sudah tersimpan dan mengarah ke hash `#/tryouts/{id}/peserta`. Halaman ini menampilkan satu tabel gabungan Peserta Didik dan Peserta Umum bergaya halaman Peserta Umum, beserta detail, hapus, dan form tambah inline dengan alur A. Peserta Didik / B. Peserta Umum yang sama dengan alur Buat Tryout; tidak ada popup manage lagi.

## Jawaban Pemilik — 2026-11-25

| # | Pertanyaan | Jawaban |
|---|---|---|
| Q1 | Angka pemakaian di baris soal menghitung apa? | Berapa kali soal tersebut digunakan di lembar soal |
| Q2 | Apakah lembar arsip/dihapus ikut dihitung? | Tidak dihitung |
| Q3 | Pembatasan CSV/XLSX dan penghapusan payload berlaku sampai backend? | Ya, UI dan API; payload ditolak |
| Q4 | Bentuk template download? | CSV dan XLSX |
| Q5 | Kredensial dan tombol copy dipasang di mana? | Semua tampilan siswa/peserta, satu tombol untuk nama + username + PIN/password |
| Q6 | Perubahan `Peserta Tryout` → `Peserta Umum` sampai mana? | Label, judul, dan rute; alias lama tetap redirect |

Dengan ini tidak ada pertanyaan terbuka tersisa di ADR-022.

## Konsekuensi

- D2 memerlukan agregasi sisi backend agar total/filter pagination tidak dihitung dari halaman saat ini saja.
- D3 berarti endpoint import lama berubah kontrak; klien yang mengirim `content`/`questions[]` harus mendapat pesan error yang jelas, bukan 500.
- D3/D4 memerlukan parser XLSX di backend dan dua file template statik yang diuji oleh QA sebagai fixture import valid.
- D5 dapat memakai plaintext yang sudah tersimpan di `siswa`/`prospektus`; tidak perlu migrasi password baru, tetapi perlu pembatasan permission dan pengujian agar kredensial tidak bocor ke endpoint publik.
- D6 menyentuh marker QA di `phase6p.mjs`, `phase6q.mjs`, `phase6r.mjs`, `phase6s.mjs`, dan dokumentasi `laporan-sistem`; alias lama perlu tetap diuji.
- D8 menambah rute dinamis dan satu file halaman baru; alur draft pada form Buat Tryout tetap memakai popup dan tidak diubah.
- Perubahan dijadwalkan di Fase 6z / `REL-32` tanpa membuka ulang gate sebelumnya.
