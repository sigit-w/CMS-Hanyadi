# Backlog Fase 6q — Kelola Peserta dari Daftar Tryout

Tanggal: 2026-11-24  
Sumber keputusan: `pm-agent/decisions/ADR-009-kelola-peserta-tryout.md`  
Gate: `REL-19`

## Requirement Pemilik

| # | Requirement |
|---|---|
| R1 | Hapus teks `Data siswa tidak ditampilkan sampai dipilih melalui A. Peserta Didik.` dari halaman Buat Tryout. |
| R2 | Saat tombol `Kelola Peserta` pada Daftar Tryout diklik, popup menampilkan daftar peserta tryout dan dua tombol `A. Peserta Didik` / `B. Peserta Umum`. |
| R3 | Alur A/B di popup Kelola Peserta sama dengan alur penambahan peserta di Buat Tryout. |
| R4 | Update sistem report setelah selesai. |
| R5 | Commit dan push ke GitHub `cms-hanyadi`. |

## Breakdown Task

| Task ID | Owner | Prioritas | Dependency | Ringkasan |
|---|---|---|---|---|
| PM-19 | PM | P0 | - | ADR-009 accepted; backlog dan handoff BE-34/FE-31/QA-31 diterbitkan |
| BE-34 | Backend | P0 | ADR-009 | `POST /api/v1/tryouts/{id}/participants`, OpenAPI, backend README |
| FE-31 | Frontend | P0 | BE-34 (kontrak) | Hapus helper text, popup Kelola Peserta dengan A/B, target draft/manage |
| QA-31 | QA | P0 | BE-34, FE-31 | QP-01..QP-05, regresi penuh, laporan & gate |
| DOC-06Q | PM/Docs | P1 | FE-31, QA-31 | Update `laporan-sistem/index.html` |
| REL-19 | PM | P0 | QA-31, DOC-06Q | Build/deploy, verifikasi produksi, commit/push |

## Acceptance Criteria

### BE-34
- [x] Endpoint `POST /tryouts/{id}/participants` tersedia dengan `tryouts.manage`.
- [x] Payload `participant_ids` wajib berisi minimal satu ID numerik.
- [x] Tryout tidak ditemukan → `404`; peserta tidak ditemukan/nonaktif/prospek → `400`.
- [x] Relasi ganda dilewati; respons memuat `added_ids` dan `participant_ids` terbaru.
- [x] OpenAPI dan backend README diperbarui.

### FE-31
- [x] Helper text lama tidak ada lagi di source maupun bundle.
- [x] Popup Kelola Peserta memuat daftar peserta + tombol `A. Peserta Didik` dan `B. Peserta Umum`.
- [x] Pilih Siswa dari popup Kelola langsung menambahkan relasi ke tryout tersimpan dan daftar dimuat ulang.
- [x] Buat Umum dari popup Kelola membuat participant lalu melampirkannya ke tryout tersimpan.
- [x] Alur target `draft` pada Buat Tryout tidak berubah.
- [x] Detail baris, trash icon, dan perlakuan Umum/Siswa sesuai ADR-008 tetap berfungsi.
- [x] Build sukses dengan heap 256 MB.

### QA-31
- [x] QP-01 helper text/confirmasi source.
- [x] QP-02 marker popup dan alur A/B.
- [x] QP-03 attach siswa existing ke tryout tersimpan + idempoten.
- [x] QP-04 alur Umum dari popup tersimpan + prospek/trash regresi.
- [x] QP-05 regresi penuh dan health produksi.

### DOC-06Q / REL-19
- [x] Laporan sistem menampilkan Fase 6q, `REL-19`, jumlah test terbaru, dan menu Prospektus.
- [x] Bundle baru terverifikasi di CMS; health API/presentation/CMS/tryout `200`.
- [x] Commit dibuat dan `origin/main` cocok.

## Catatan Eksekusi

- Cek `free -h`; test serial heap 128 MB; build heap 256 MB.
- Gunakan kredensial DB dari `/etc/postgresql/bank_soal_db.credentials` bila perlu verifikasi langsung.
- `QA_ADMIN_PASSWORD` dari `backend-agent/.env`.
- Tidak ada migrasi DB pada Fase 6q.
