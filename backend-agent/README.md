# Backend Agent — Node.js

## Fungsi

Merancang dan membangun REST API yang terhubung ke PostgreSQL `bank_soal_db`, termasuk validasi input/upload soal, pengelolaan pilihan dan kunci jawaban. Soal baru otomatis `approved`; tidak ada versi maupun readiness (ADR-004/Fase 6j).

## Peta Direktori

| Path | Fungsi |
|---|---|
| `src/config/` | Konfigurasi lingkungan, port, batas upload, pool DB |
| `src/db/` | Koneksi `pg` pool, migrasi, query helper |
| `src/routes/` | Definisi endpoint |
| `src/controllers/` | Orkestrasi request/response |
| `src/services/` | Logika bisnis soal dan sumber (tanpa readiness) |
| `src/validators/` | Validasi input, MIME, ukuran file, mapel |
| `src/middlewares/` | Error envelope, auth dasar, logging |
| `openapi/` | Kontrak API yang dipakai frontend & QA |
| `tests/` | Unit test dan integration test |

## Mapel yang Didukung

Seed awal: `MTKA`, `BIND`, `IPAS`. Kode mapel unik tepat 4 karakter `^[A-Z0-9]{4}$` dan langsung dipakai sebagai prefix kode lembar soal `LS-<KODE_MAPEL>-mmyy`. Endpoint CRUD memakai permission `mapels.manage` (default admin).

## Peserta Tryout

Saat membuat peserta Siswa (`jenis='siswa'`), `password` opsional. Jika kosong, sistem memakai default `nama depan@mmyy` (misalnya `Budi@1126`). Password dapat diganti saat pendaftaran maupun lewat reset; minimal 6 karakter.

Peserta Umum (`jenis='umum'`) dibuat dengan `nama`, `sekolah`, `wa_orang_tua`, dan `pin` 9 digit. Hanya `pin_hash` scrypt yang disimpan; login memakai `username = nama` dan `password = pin`. Nama Umum unik tanpa memperhatikan huruf besar/kecil. Payload lama Siswa dan endpoint lama `/tryout-sessions` tetap diterima.

## Jenis Soal

`question_type` yang didukung: `multiple_choice`, `true_false`, `multiple_answer`, `short_answer`, `essay`. Untuk `multiple_answer`, kirim `correct_keys` berisi minimal satu kunci opsi (boleh lebih dari satu), misalnya `["B"]` atau `["B", "D"]`; `correct_key` tetap diisi otomatis dengan kunci pertama untuk kompatibilitas lama. Kunci yang sama tidak boleh duplikat dan harus cocok dengan opsi yang tersedia. Importer CSV/TXT juga menerima `Jawaban: B,D`.

## Aturan Implementasi

- Kontrak API ditulis di `openapi/` sebelum endpoint diimplementasikan.
- Semua query memakai parameterized statement; dilarang concat SQL.
- Pool koneksi maksimal 5, `statement_timeout` 5 detik.
- Upload maksimal 5MB, whitelist MIME, nama file disanitasi, path relatif.
- Error envelope: `{ ok: false, error: { code, message, status } }`.
- Kunci jawaban harus konsisten dengan `question_options.is_correct`; untuk multi-jawaban, semua `correct_keys` ditandai benar.
- Simpan kredensial di `.env` mode 600; jangan commit secret.

## Kontrak Fase 6j (ADR-004)

- Soal baru manual/import langsung `approved`; `draft` dan `review` ditolak, migrasi `015` merapikan data lama.
- Tanpa parameter `version`/`ready_version` dan tanpa field `readiness` pada respons; endpoint versi/readiness/varian mengembalikan 404.
- Daftar soal memakai `page`/`limit=20` dengan `pagination: { page, limit, total }`; stem tidak ditebalkan.
- Sumber konten penyajian: `questions` + `question_options` + `answer_keys`, bukan varian/readiness.

## Task Fase 3

Lihat `docs/phase3-tasks.md` rentang `BE-01` sampai `BE-09` (arsip Fase 3).
