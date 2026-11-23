# Decision Log — ADR-005

| Field | Isi |
|---|---|
| ID | ADR-005 |
| Tanggal | 2026-11-23 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | PM-12, BE-27, FE-24, QA-24, DOC-06L, REL-12 |

## Konteks

Pemilik proyek meminta halaman "Lembar Soal" di bawah menu Manajemen Soal CMS: nama, kode 12 karakter termasuk tanda hubung (auto-generate berdasarkan mapel, bisa diubah), keterangan, waktu pengerjaan, pemilihan beberapa soal dari satu mapel, satu soal bisa dipakai banyak lembar, flag kode lembar pada daftar soal, permission RBAC baru, dan penghapusan soft delete. Klarifikasi lanjutan menetapkan waktu pengerjaan sebagai angka bebas, bukan preset 60/90/120, dan mengubah urutan create menjadi: nama → pilih mapel → sistem generate kode → kode bisa diubah manual → soal ditampilkan/disaring berdasarkan mapel → klik baris soal membuka popup detail seperti Daftar Soal. Amendemen terbaru menetapkan kode di Kelola Mapel dibatasi tepat 4 karakter dan kode itulah yang dipakai langsung sebagai prefix generator lembar soal.

Lingkungan produksi hanya ~2 GB RAM; pada saat handoff ini tersedia ~313 MiB. Tidak boleh ada service baru, build/test berjalan bergiliran, dan tidak boleh OOM.

## Keputusan

1. **Schema baru.** Migrasi `016_lembar_soal.sql` membuat:
   - `question_sheets`: `id BIGSERIAL PK`, `name VARCHAR(128) NOT NULL`, `code VARCHAR(12) NOT NULL UNIQUE`, `description TEXT`, `duration_minutes INTEGER NOT NULL`, `mapel_id BIGINT NOT NULL REFERENCES mapels(id) ON DELETE RESTRICT`, `archived BOOLEAN NOT NULL DEFAULT false`, `archived_at TIMESTAMPTZ`, `created_by BIGINT REFERENCES contributors(id) ON DELETE SET NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
   - `question_sheet_questions`: `sheet_id BIGINT NOT NULL REFERENCES question_sheets(id) ON DELETE CASCADE`, `question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT`, `position INTEGER NOT NULL DEFAULT 0`, `PRIMARY KEY (sheet_id, question_id)`, indeks pada `question_id`.
   - Indeks pada `question_sheets (mapel_id, archived)`; trigger `updated_at` mengikuti pola `questions`. Migrasi idempoten dan `schema.sql` serta `db/README.md` mengikuti.
2. **Kode lembar soal (D1/D2).** `VARCHAR(12)` dengan constraint `length(code) = 12 AND code ~ '^[A-Z0-9-]{12}$'`; unik. Generator dipanggil setelah mapel dipilih dan memakai `mapels.code` (tepat 4 karakter) sebagai prefix: `LS-<KODE_MAPEL>-mmyy` (`mmyy` dari tanggal create, mis. `LS-MTKA-1126` bila kode mapel `MTKA`). Tidak ada lagi pemetaan berdasarkan nama mapel atau fallback `CUST`. Kode hasil edit hanya wajib memenuhi constraint tersebut dan boleh tidak mengikuti pola generator; jika kode generated benturan, user mengganti manual. Kode boleh diubah hanya saat lembar belum dipakai; perubahan kode wajib memperbarui flag pada seluruh soal terkait dalam satu transaksi. Relasi tryout–lembar belum dibuat di Fase 6l, sehingga pengecekan "dipakai" untuk sementara selalu `false` tanpa menambah tabel relasi baru.
3. **Waktu pengerjaan (D3).** `duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0)`, diisi angka bebas dari form (bukan dropdown/preset), disimpan apa adanya dalam menit.
4. **Mapel dan daftar soal.** Create dimulai dari nama, lalu user memilih mapel yang bersumber dari tabel `mapels`; sebelum mapel dipilih, daftar soal tidak ditampilkan. Setelah mapel dipilih, sistem generate kode, user boleh mengubah kode secara manual, lalu picker menampilkan hanya soal approved dari mapel tersebut. Klik baris soal pada picker membuka popup detail yang sama perilakunya dengan popup detail di Daftar Soal (bukan langsung memilih soal). Create mewajibkan minimal satu soal; semua soal harus memiliki `mapel_id` sama dengan mapel yang dipilih; lembar menyimpan tepat satu `mapel_id`. Pada edit, mapel dan daftar soal boleh diubah dengan aturan yang sama, dan edit ditolak jika daftar kosong atau mapel tidak seragam. Seluruh perubahan form + relasi disimpan transaksional.
5. **Flag pada daftar soal.** `GET /api/v1/questions` menyertakan `sheets: [{ id, code, name }]` untuk lembar aktif yang memakai soal tersebut, diambil dengan satu query agregat (tanpa N+1). Lembar terarsip tidak muncul. Satu soal boleh muncul di banyak lembar.
6. **RBAC (D4).** Permission `question_sheets.manage` didaftarkan di migrasi `016` dengan `ON CONFLICT`, diberikan ke role `admin` dan `editor`, otomatis tampil di `GET /permissions` dan checkbox Kelola Role. Endpoint lembar soal memakai `authorize('question_sheets.manage')`; picker soal memakai `GET /api/v1/question-sheets/question-picker` dengan permission yang sama agar role dengan permission ini saja tetap bisa memilih soal.
7. **Kontrak API.** `GET /api/v1/question-sheets` (filter `status=active|archived`, pagination), `GET /api/v1/question-sheets/:id`, `POST /api/v1/question-sheets`, `PUT /api/v1/question-sheets/:id`, `DELETE /api/v1/question-sheets/:id` (soft delete), dan `GET /api/v1/question-sheets/question-picker`. Semua response mengikuti bentuk `{ ok, data, meta }` yang sudah dipakai backend.
8. **Hapus (D5).** `DELETE` hanya set `archived = true` dan `archived_at = now()`; baris dan relasi tidak dihapus. Daftar default menyembunyikan arsip, filter `status=archived` menampilkannya, dan tidak ada aksi pulihkan di Fase 6l.
9. **Memori & deploy.** Tanpa service baru. Migrasi dijalankan lewat `psql`. Test backend/QA memakai `NODE_OPTIONS=--max-old-space-size=128`; build frontend memakai `NODE_OPTIONS=--max-old-space-size=256` dan dijalankan bergiliran. Cek `free -h` sebelum dan sesudah pekerjaan berat; tidak menjalankan dua build/test besar paralel; `REL-12` hanya GO bila tidak ada OOM dan 0 bug P0/P1.

## Konsekuensi

- Backend, frontend, OpenAPI, `db/README.md`, checklist QA, status board, dan laporan sistem harus diperbarui sebelum `REL-12`.
- Tidak ada perubahan pada presentation/tryout; submission lama tetap terbaca.
- Kode terkunci "setelah dipakai" baru berfungsi penuh setelah relasi tryout–lembar tersedia; Fase 6l sengaja tidak menambah relasi tersebut.
- Rollback dapat dilakukan dengan mengarsipkan lembar baru; tidak ada hard delete yang menghilangkan relasi.

## Alternatif yang Dipertimbangkan

- **Preset 60/90/120 menit**: ditolak karena pemilik mengklarifikasi ingin input angka bebas.
- **Hard delete**: ditolak karena menghilangkan relasi dan flag riwayat; dipakai soft delete.
- **Flag kode sebagai JSONB pada `questions`**: ditolak karena relasi many-to-many eksplisit lebih mudah divalidasi, diindeks, dan diperbarui transaksional.
- **Service baru untuk lembar soal**: ditolak karena risiko OOM pada lingkungan ~2 GB RAM.

## Amendemen 2026-11-23 — Urutan Create

Aturan ini menggantikan bagian alur lama pada poin 2 dan 4 serta menjadi acuan BE-27/FE-24/QA-24:

1. User mengisi `name`.
2. User memilih `mapel_code` dari `GET /api/v1/mapels`.
3. Sistem memanggil `GET /api/v1/question-sheets/generate-code?mapel=<code>` dan mengisi `code`.
4. User dapat menimpa `code` secara manual selama masih memenuhi `^[A-Z0-9-]{12}$` dan unik.
5. Picker soal tidak dirender sebelum `mapel_code` diisi; setelah itu picker difilter oleh mapel tersebut.
6. Klik baris soal pada picker membuka popup detail seperti Daftar Soal; tombol Pilih/Hapus tetap berada di baris/table dengan `stopPropagation`.

Pemetaan prefix yang sebelumnya berbasis nama mapel sudah diganti oleh amendemen berikut: prefix berasal langsung dari `mapels.code` yang dibatasi 4 karakter.

## Amendemen 2026-11-23 — Kode Mapel 4 Karakter

Aturan ini menggantikan semua aturan prefix pada bagian sebelumnya dan menjadi acuan BE-27/FE-24/QA-24 untuk revisi berikutnya:

1. Di halaman **Kelola Mapel**, field `code` wajib unik dan dibatasi tepat 4 karakter alfanumerik kapital (`^[A-Z0-9]{4}$`); input UI dapat mengubah ke huruf kapital, tetapi backend tetap memvalidasi aturan ini.
2. `mapels.code` adalah satu-satunya sumber prefix generator lembar soal. Kode lembar soal generated = `LS-${mapel.code}-${mmyy}`; misalnya kode mapel `MTKA` menghasilkan `LS-MTKA-1126`. Tidak ada pemetaan nama mapel, tidak ada fallback `CUST`, dan user tidak perlu memilih prefix terpisah.
3. Panjang kode lembar soal tetap 12 karakter karena `LS-` (3) + kode mapel (4) + `-` (1) + `mmyy` (4) = 12. Constraint `^[A-Z0-9-]{12}$` tidak berubah.
4. Data mapel existing dimigrasikan ke `MTKA` (Matematika), `BIND` (Bahasa Indonesia), dan `IPAS` (IPAS). Referensi di DB memakai FK `mapel_id` (`question_sheets`, `questions`, `tryout_sessions`), sehingga perubahan kode tidak memerlukan update baris referensi; filter/API dan fixture QA tetap diselaraskan. Kode lembar soal yang sudah dibuat tetap dihargai sebagai data historis.
5. Perubahan ini berdampak ke validasi/migrasi backend, form Kelola Mapel frontend, kontrak OpenAPI, skenario QA, `db/README.md`, dan status board. `REL-12` tetap GO untuk implementasi sebelumnya; gate untuk amendemen ini dicatat sebagai `REL-13`, bukan otomatis GO.
