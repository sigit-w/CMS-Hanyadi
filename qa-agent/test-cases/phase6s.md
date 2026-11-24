# Fase 6s — Test Cases

| ID | Skenario | Ekspektasi |
|---|---|---|
| QS-01 | Migrasi 025 dan constraint slug/binding | Kolom, index, FK, dan check constraint tersedia |
| QS-02 | Login participant tanpa slug, slug salah, akun tidak terdaftar, slug benar | 401, 401, 401, 200 dengan `tryout_session_id`/`tryout_slug` |
| QS-03 | `GET /siswa` dan `GET /tryouts/{id}/participants` | Siswa murni dan peserta terlampir; tidak tercampur |
| QS-04 | Umum dari tryout vs konversi Prospektus | Umum tetap di prospektus; konversi eksplisit membuat siswa |
| QS-05 | Presentation & submit | Soal dan submission memakai tryout binding |
| QS-06 | Marker UI/agent/bundle | URL tryout, salin, slug, dan endpoint baru tampil |
| QS-07 | Dokumentasi | OpenAPI, DB README, ADR-011, backlog, status board, laporan QA lengkap |
