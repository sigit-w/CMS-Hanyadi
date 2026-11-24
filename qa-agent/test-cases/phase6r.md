# Test Cases — Fase 6r: Alur Siswa & Prospektus

| ID | Fokus | Prasyarat | Langkah | Expected |
|---|---|---|---|---|
| PS-01 | Umum masuk prospektus | API & DB aktif | Buat peserta `jenis='umum'` lewat `POST /participants`; cek tabel; buka detail; login Nama+PIN | Baris ada di `prospektus`, tidak ada di `siswa`, `pin_plain` tampil di detail, login 200 |
| PS-02 | Kredensial siswa | Siswa dibuat lewat API | Cek `siswa.password_plain`; buka detail; cek list participants | Detail menampilkan password; list tidak mengandung `password_plain`/`pin_plain`/`*_hash` |
| PS-03 | Daftar prospektus | Prospek Umum sudah ada | `POST /prospektus/{id}/daftar` dengan email/kelas/PIN/WA opsional | Siswa baru dibuat, `bergabung=true`, `bergabung_at` terisi, login siswa 200, daftar ulang 409 |
| PS-04 | Password CMS | User CMS ada | `GET /users`; cek kolom `contributors` | Tidak ada field password di respons; tidak ada kolom plaintext; hash tetap `scrypt$` |
| PS-05 | Integritas FK trigger | DB aktif | Insert `auth_sessions` dengan `participant_id` palsu | Insert ditolak, pesan mengandung `participant_id`, tidak ada row |
| PS-06 | Bundle CMS | Build produksi sukses | Periksa bundle JS dan source page | Marker `Daftarkan sebagai Siswa`, `Bergabung`, `Password / PIN`, dan helper baru ada |
| PS-07 | Kontrak & dokumen | Perubahan selesai | Periksa OpenAPI, DB README, ADR-010 | Path baru dan penjelasan migrasi `024` ada |

## Catatan Eksekusi

- Test otomatis: `qa-agent/tests/phase6r.mjs`.
- Regresi penuh: `backend-agent/package.json` menyertakan file tersebut dalam `npm test`.
- Fixture dibersihkan di `after()` dengan `DELETE FROM tryout_participants ...`; trigger view menghapus relasi auth/submission/sesi.
- `QA_ADMIN_PASSWORD` diambil dari `backend-agent/.env` via `BOOTSTRAP_ADMIN_PASSWORD`; nilainya tidak dicetak.
