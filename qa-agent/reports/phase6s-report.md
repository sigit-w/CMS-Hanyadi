# Fase 6s — Laporan QA

## Ruang Lingkup

- Login participant wajib marker `tryout_slug` dari URL `/{slug}` serta keanggotaan di `tryout_session_participants`.
- Session/JWT participant terikat pada `tryout_session_id`; presentation-service dan daftar soal memakai binding tersebut.
- Pemisahan data: `GET /api/v1/siswa` hanya `public.siswa`; `GET /api/v1/tryouts/{id}/participants` hanya peserta tryout; prospektus tetap menjadi tujuan pendaftaran awal dari tryout.
- Konversi ke `siswa` hanya lewat tombol eksplisit **Daftarkan Siswa** di halaman Prospektus.

## Eksekusi

- Perintah: `NODE_OPTIONS=--max-old-space-size=128 npm test` dari direktori `backend-agent` dengan `QA_ADMIN_PASSWORD` dari `.env`.
- Nomor test: `QS-01` sampai `QS-07`.
- Fokus regresi: login participant lama tanpa slug, penghapusan peserta tryout, dan test yang mengira daftar participant gabungan masih tersedia untuk Kelola Siswa.

## Hasil

- `QS-01`…`QS-07`: 7/7 lolos (skema `025`, login scoped, pemisahan daftar, prospektus, binding presentation, marker UI, kontrak/docs).
- Regresi penuh: 169/169 lolos, 0 gagal, 0 P0/P1, tanpa OOM dengan heap 128 MB.
- Perbaikan saat regresi: constraint check `uq_tryout_sessions_slug` dibaca dari `pg_indexes`; `POST /tryouts` dan `POST /tryout-sessions` menyimpan slug sejak INSERT; hapus tryout membersihkan `auth_sessions` terikat; fixture lama disesuaikan memakai login scoped dan tryout sendiri.
- Gate rilis tercatat di `phase6s-release-gate.md`.
