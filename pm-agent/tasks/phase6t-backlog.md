# Backlog — Fase 6t: Tryout Multi-Mapel & Alur Peserta

| Field | Isi |
|---|---|
| Fase | Fase 6t |
| Gate | `REL-26` |
| Tanggal | 2026-11-24 |
| ADR | `ADR-016` |
| Status | backlog |
| Pemilik | PM |
| Melanjutkan | Fitur baru setelah `REL-25`; Fase 6 dan `REL-01…REL-25` tidak dibuka ulang |

## Konteks / Masukan Pemilik

Pemilik meminta lima perubahan yang dicatat sebagai satu batch rilis:

1. Satu tryout dapat berisi beberapa mapel dan mapelnya **tidak boleh redundant**: 1 tryout boleh berisi 1 MTKA + 1 IPAS, tetapi tidak boleh 2 MTKA.
2. Flow pemilihan lembar soal perlu disesuaikan dengan model multi-mapel tersebut.
3. Halaman tryout perlu memberi info/notifikasi setiap kali ada pelanggaran.
4. Halaman tryout cukup **1 kali submit jawaban**, tidak per soal diminta submit.
5. Bug saat membuat tryout + menambah peserta didik: data siswa tidak tampil di picker.

Batasan tegas: **jumlah pelanggaran tidak diubah** (`cbt_max_violations` tetap `3` untuk sesi produksi). Perbaikan kali ini hanya pada notifikasi dan alur submit.

Bukti awal: `db/schema.sql:111` masih `mapel_id` tunggal; `backend-agent/src/tryoutRoutes.js:276-309` dan `:342-365` memakai `mapel_code` tunggal; `frontend-agent/src/pages/TryoutManagement.jsx:50` memakai `form.mapel_code`, `:401-405` mewajibkan mapel, `:421` mengirim payload tunggal, `:533-544` satu `<select>`, `:862` satu kolom mapel; `frontend-agent/src/pages/TryoutManagement.jsx:761` memfilter `jenis === 'siswa'` padahal `backend-agent/src/siswaRoutes.js:21-25` sudah mengembalikan hanya siswa; `tryout-agent/app.js:601` `recordViolation` sudah punya debounce 750 ms dari perbaikan sebelumnya.

## Requirement

| ID | Requirement | PM | Status | Gate | ADR |
|---|---|---|---|---|---|
| R1 | Tryout multi-mapel dengan mapel unik per sesi | PM-24 | backlog | REL-26 | ADR-016 |
| R2 | Pemilihan lembar soal per-mapel, valid, dan konsisten saat mapel dihapus | PM-24 | backlog | REL-26 | ADR-016 |
| R3 | Notifikasi setiap pelanggaran tanpa mengubah kuota | PM-24 | backlog | REL-26 | ADR-016 |
| R4 | Satu submit jawaban global; tidak ada submit per soal | PM-24 | backlog | REL-26 | ADR-016 |
| R5 | Picker siswa menampilkan data siswa aktif saat buat tryout | PM-24 | backlog | REL-26 | ADR-016 |

## Keputusan

| ID | Keputusan | Alasan |
|---|---|---|
| D1 | Tambah tabel `tryout_session_mapels(session_id, mapel_id)` dengan `PRIMARY KEY (session_id, mapel_id)`; kolom lama `tryout_sessions.mapel_id` tetap nullable dan **tidak lagi jadi sumber kebenaran**, diisi mapel pertama saat backfill | Menjaga kompatibilitas konsumen lama tanpa memaksa perubahan besar; uniqueness dijamin DB |
| D2 | `POST /api/v1/tryouts` menerima `mapel_codes: string[]` (1–10, unik, harus aktif); `mapel_code` lama tetap diterima sebagai array 1 elemen; jika keduanya ada dan berbeda → `400 VALIDATION_ERROR`; response menyertakan `mapels[]` + `mapel_code` first untuk kompatibilitas | Migrasi bertahap untuk CMS dan client lama |
| D3 | UI mengambil lembar soal per mapel terpilih lewat `GET /api/v1/question-sheets?mapel_code=...` yang sudah ada, dikelompokkan per mapel; `sheet_ids` dipangkas saat mapel dicopot; backend menolak `sheet_id` yang mapelnya tidak dipilih | Tidak perlu endpoint baru untuk listing; validasi tetap di server |
| D4 | Non-CBT memakai endpoint baru `POST /api/v1/presentation/attempts/submit-all` yang menilai dan menulis semua jawaban dalam satu transaksi; CBT tetap `finalize`; endpoint lama `/presentation/questions/:id/submit` dipertahankan untuk kompatibilitas API tetapi tidak dipanggil UI | Satu aksi submit untuk peserta tanpa mengubah mekanisme CBT |
| D5 | Response violation menyertakan `type`, `violation_count`, `max_violations`; UI menampilkan toast `"Pelanggaran tercatat: <label> (n/m)"`; debounce 750 ms dipertahankan; saat auto-submit, toast terakhir menggabungkan info pelanggaran + sesi dikunci | Info muncul tiap pelanggaran yang benar-benar tercatat, tanpa duplikat dan tanpa menaikkan kuota |
| D6 | Hapus filter `jenis === 'siswa'` di halaman tryout; pertahankan filter `is_active`; tambah refresh saat dialog dibuka/fokus | Root cause picker kosong ada di frontend, bukan API; ADR-014 menjelaskan data bisa memang kosong |
| D7 | Gate `REL-26` terpisah; backup pre-migrasi wajib; rollback ke `REL-25` tanpa membuka Fase 6/7 | Konsisten dengan pola `REL-23`, `REL-25` |
| D8 | Asset tryout di-bump ke `app.js?v=18` (dan `styles.css?v=15` jika CSS berubah) | Cache browser tidak menyajikan kode lama |

## Acceptance Criteria

- **R1**: dua mapel berbeda tersimpan; dua mapel sama ditolak `400`; sesi existing tetap terbaca lewat `mapel_code` legacy; laporan/admin tetap menampilkan kedua mapel.
- **R2**: lembar soal dikelompokkan per mapel; memilih lembar dari mapel yang tidak dipilih ditolak; mencopot mapel menghapus `sheet_ids` milik mapel itu; tidak ada duplikat `sheet_id`.
- **R3**: sekali tab-switch/fullscreen-exit menghasilkan 1 toast; teks memuat jenis dan `n/3`; log admin tetap tercatat; `cbt_max_violations` tidak berubah.
- **R4**: tidak ada tombol "Simpan/Submit per soal"; satu tombol global mengirim semua jawaban; jawaban yang belum sempat tersimpan ikut terkirim; untuk non-CBT muncul konfirmasi sebelum submit; untuk CBT tombol existing `finalizeButton` tetap jadi satu-satunya submit.
- **R5**: dengan minimal 1 siswa aktif, picker menampilkan nama + kelas/sekolah; checkbox tetap berfungsi; tidak ada error 401/403; kasus 0 siswa aktif menampilkan pesan kosong yang jelas.

## Breakdown Task

| ID | Agent | Deskripsi | AC | Gate | Status | ADR |
|---|---|---|---|---|---|---|
| PM-24 | PM | Mencatat 5 perubahan, ADR-016, backlog ini, dan handoff | R1–R5 | REL-26 | done | ADR-016 |
| BE-39 | Backend | Migrasi `029_tryout_multi_mapel.sql`, junction table + backfill, API create/read `mapel_codes`, validasi unik & sheet-mapel, endpoint `submit-all` | R1, R2, R4 | REL-26 | done | ADR-016 |
| FE-36 | Frontend | Form multi-mapel, sheet picker per mapel + pruning, perbaikan picker siswa, kolom daftar tryout | R1, R2, R5 | REL-26 | done | ADR-016 |
| TRY-18 | Tryout | Toast pelanggaran, penghapusan submit per soal, satu submit global untuk non-CBT, bump asset | R3, R4 | REL-26 | done | ADR-016 |
| PRES-06 | Presentasi | Endpoint `submit-all`, payload info pelanggaran, kompatibilitas ambil soal multi-mapel | R3, R4 | REL-26 | done | ADR-016 |
| QA-36 | QA | Test integrasi 5 requirement + regresi CBT/non-CBT + verifikasi produksi | R1–R5 | REL-26 | done | ADR-016 |
| DOC-07 | Dokumentasi | Update `docs/architecture.md` / README untuk model multi-mapel & endpoint baru | R1, R4 | REL-26 | done | ADR-016 |
| REL-26 | Release | Backup pre-migrasi, deploy, verifikasi gate, asset bump, smoke test | R1–R5 | REL-26 | done | ADR-016 |

## Handoff

- `tasks/handoff-BE39.md`
- `tasks/handoff-FE36.md`
- `tasks/handoff-TRY18.md`
- `tasks/handoff-PRES06.md`
- `tasks/handoff-QA36.md`
- `tasks/handoff-DOC07.md`
- `tasks/handoff-REL26.md`

## Risiko & Catatan

- `db/schema.sql` tertinggal dari migrasi `021`–`028`; agent harus memakai `information_schema`/migrasi sebagai sumber kebenaran, bukan schema.sql mentah.
- `mapelRoutes.js` menghitung `tryout_count` dari `tryout_sessions.mapel_id`; setelah multi-mapel, query harus diubah ke junction agar hitungan tidak undercount.
- `tryoutRoutes.js:276-309` dan `:342-365` masih merekonsiliasi soal berdasarkan perubahan `mapel_code`; harus diganti ke perbandingan array mapel.
- ADR-014 menghapus data siswa lama; jika picker kosong di produksi, cek dulu jumlah siswa aktif sebelum menyimpulkan bug.
- Perbaikan `app.js?v=17` (401 gate netral + debounce pelanggaran) **tidak boleh diregresi** oleh TRY-18.
- Tidak ada perubahan pada Fase 7, tidak ada ADR/backup dari Fase 7 yang boleh dipakai.
