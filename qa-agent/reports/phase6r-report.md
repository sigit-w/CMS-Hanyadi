# Laporan QA — Fase 6r: Perubahan Flow Tryout

| Field | Isi |
|---|---|
| Tanggal | 2026-11-24 |
| Task | PM-20 → BE-35 → FE-32 → TRY-14 → QA-32 → DOC-06R → REL-20 |
| ADR | `pm-agent/decisions/ADR-010-siswa-prospektus-kredensial.md` |
| Test khusus | 7/7 pass, 0 fail |
| Regresi penuh | 162/162 pass, 0 fail |
| Bug P0/P1 | 0 |
| Bundle CMS | `index-B10Efnkg.js` (291,93 kB, gzip 82,08 kB) |

## Perintah yang Dijalankan

```bash
NODE_OPTIONS=--max-old-space-size=256 npm run build
sudo systemctl restart bank-soal-api
set -a; . ./.env; set +a
export QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD"
NODE_OPTIONS=--max-old-space-size=128 node --test ../qa-agent/tests/phase6r.mjs
NODE_OPTIONS=--max-old-space-size=128 npm test
```

Build dijalankan di `/opt/virtual-office-bank-soal/frontend-agent`; perintah lain di `/opt/virtual-office-bank-soal/backend-agent`. `npm test` dijalankan serial dengan heap 128 MB dan tidak mengalami OOM.

## Hasil Skenario

| ID | Skenario | Status | Bukti |
|---|---|---|---|
| PS-01 | Umum dari form tryout tersimpan di `prospektus`, tidak di `siswa`, PIN tampil di detail, login tetap 200 | pass | Query `prospektus`/`siswa`, `GET /participants/{id}/detail`, login 200 |
| PS-02 | Detail siswa menampilkan password; list participants tidak membocorkan kredensial | pass | `password_plain` di detail; tidak ada field `*_plain`/`*_hash` di list |
| PS-03 | Prospektus didaftarkan sebagai siswa, ditandai `bergabung`, login siswa berhasil, daftar ulang ditolak | pass | 201, then 409; `bergabung_at` terisi |
| PS-04 | Password user CMS tetap scrypt dan tidak ditampilkan | pass | `GET /users` bersih; tidak ada kolom `contributors.*plain` |
| PS-05 | Trigger validasi menolak `participant_id` tidak ditemukan | pass | Insert ditolak dengan pesan `participant_id` |
| PS-06 | Marker UI kredensial dan pendaftaran hadir di source dan bundle | pass | `index-B10Efnkg.js`, `ProspektusManagement.jsx`, `PesertaManagement.jsx`, `TryoutManagement.jsx` |
| PS-07 | OpenAPI, DB README, dan ADR-010 lengkap | pass | 3 path baru; marker migrasi `024` |

## Temuan & Perbaikan Saat QA

- `GET /participants/{id}/detail` awalnya mengembalikan 500 karena `loadParticipantDetail(null, id)` memanggil `client.query`. Fungsi diperbaiki memakai `client ?? { query }`; backend direstart; PS-01/PS-02 lalu lolos.
- Test lama `phase6p.mjs` PR-06 diselaraskan dengan narasi baru halaman Prospektus.
- Tidak ada bug P0/P1 tersisa.

## Regresi & Produksi

- `npm test`: 162 test, 162 pass, 0 fail, 0 cancelled, 0 skipped.
- Backend health `127.0.0.1:8082/health` `200`; service `bank-soal-api` active.
- CMS bundle baru terverifikasi di `dist/assets/index-B10Efnkg.js`.
- `tryout-agent` tidak diubah; alur login Nama/PIN dan Email/Password tetap tercakup dalam regresi.
- Backup DB sebelum migrasi: `/tmp/opencode/bank_soal_db-pre024-*.dump`.
- Migrasi `024` sudah diapply dan dijalankan ulang untuk uji idempotensi; counts `siswa|prospektus|view = 2|2|4` saat verifikasi.

## Pembersihan Fixture

`after()` pada `phase6r.mjs` menghapus peserta uji `QA 6R ...` dari view `tryout_participants`; trigger menghapus sesi auth, submission, dan relasi terkait. Siswa hasil pendaftaran uji juga ikut dibersihkan lewat ID yang tersimpan.

## Catatan

- Kredensial peserta sengaja plaintext sesuai keputusan pemilik; kredensial user CMS tetap scrypt.
- View `tryout_participants` dipertahankan agar kode lama dan QA lama tidak perlu dimigrasikan sekaligus.
- `REL-15` masih partial menunggu regresi khusus Fase 6m; gate Fase 6r berdiri sendiri sebagai `REL-20`.
