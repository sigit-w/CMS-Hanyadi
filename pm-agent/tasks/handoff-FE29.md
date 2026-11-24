# Handoff — FE-29 (Fase 6o)

| Field | Isi |
|---|---|
| Task ID | FE-29 |
| Nama task | Ubah alur halaman Buat Tryout, pemilihan lembar soal, dan popup Peserta Umum |
| Agent pengirim | PM |
| Agent penerima | Frontend |
| Tanggal | 2026-11-24 |
| Status | done — bundle `index-BWwbQxdi.js` terdeploy, QA U-06/U-09 lolos |

## Artifact yang Diserahkan

- Path file: `pm-agent/decisions/ADR-007-peserta-umum-tryout.md`, `pm-agent/tasks/phase6o-backlog.md`
- Target utama: `frontend-agent/src/pages/TryoutManagement.jsx`, `frontend-agent/src/api.js` bila perlu, `frontend-agent/README.md`
- Endpoint yang dipakai: `GET /api/v1/question-sheets?status=active&mapel=<KODE>`, `POST /api/v1/participants`, `POST /api/v1/tryouts`, `GET /api/v1/mapels`
- Bukti: form saat ini ada di `TryoutManagement.jsx:169-258`; state dan validasi ada di `:26-31` dan `:115-144`; daftar soal individual di `:203-226`; daftar siswa wajib di `:228-251`

## Acceptance Criteria

- [ ] Label field pertama menjadi `Nama Tryout` (Title/Camel Case) dengan `maxLength=128`; field internal tetap `name`.
- [ ] Urutan tampilan: `Nama Tryout` → tanggal & jam mulai → tanggal & jam selesai → `Mapel` → `Lembar Soal` → tombol `Tambah Peserta Tryout` → `Simpan Tryout`; checkbox `Jadikan sesi aktif` tetap ada di bawah.
- [ ] Input waktu memakai `datetime-local` untuk `start_at` dan `end_at`; validasi keduanya terisi dan `end_at > start_at` sebelum submit.
- [ ] Setelah mapel dipilih, UI memuat lembar soal aktif via `getQuestionSheets({ status: 'active', mapel: kode })` dan menampilkan nama/kode/durasi/jumlah soal. Sebelum mapel dipilih atau bila kosong, tampilkan pesan kondisi kosong yang jelas.
- [ ] Checkbox soal individual lama diganti oleh checkbox lembar soal; minimal satu lembar wajib dipilih. Payload `POST /tryouts` mengirim `sheet_ids` (plus `start_at`, `end_at`, `name`, `mapel_code`, `is_active`), bukan lagi `question_ids` dari UI.
- [ ] Tidak ada validasi minimal peserta. `participant_ids` boleh kosong; teks bantuan diperbarui menjadi "Soal wajib dipilih minimal satu; peserta opsional".
- [ ] Tombol `Tambah Peserta Tryout` membuka pilihan `A. Peserta Didik` dan `B. Peserta Umum`. Memilih A hanya menampilkan "Segera hadir — fitur Peserta Didik menyusul" dan tidak menutup alur tryout.
- [ ] Memilih B membuka popup/modal dengan field `Nama`, `Sekolah`, `PIN`, `Nomor WA Orang Tua`. PIN otomatis terisi 9 digit memakai `crypto.getRandomValues`, tampil read-only, dan memiliki tombol `Generate ulang`.
- [ ] Validasi client: Nama, Sekolah, PIN, WA wajib; PIN `/^\d{9}$/`; WA memakai aturan yang sama dengan validator existing di `PesertaManagement.jsx` (`validateWa`). Error ditampilkan di dalam modal.
- [ ] Submit modal memanggil `POST /participants` dengan `{ jenis: 'umum', nama, sekolah, pin, wa_orang_tua }`; peserta baru otomatis masuk daftar peserta terpilih dan labelnya menampilkan `Nama · Sekolah` (bukan `nama (email)`).
- [ ] Peserta Umum yang sudah dibuat bisa dicentang/di-centang ulang seperti peserta existing; daftar tryout menampilkan jumlah peserta termasuk kemungkinan `0`.
- [ ] Tidak ada perubahan permission, rute, atau grup menu Fase 6n; halaman tetap berada di `#/tryouts` dengan `tryouts.manage`.
- [ ] Build produksi sukses tanpa OOM dan nomor bundle baru dilaporkan ke QA-29.

## Catatan Kendala / Risiko

- Bergantung pada kontrak BE-32. Jika backend belum siap, boleh menyiapkan UI/static marker lebih dulu, tetapi jangan mengubah nama field yang sudah disepakati di ADR-007.
- Jangan memakai `Math.random` untuk PIN. Jangan menampilkan/menyimpan PIN selain di field modal; backend menyimpan hash.
- Jangan mengirim `password` untuk Umum dan jangan mengisi email dummy.
- `Peserta Didik` sengaja placeholder; jangan memanggil endpoint siswa dari opsi ini pada Fase 6o.
- Cek `free -h` sebelum build. Gunakan `NODE_OPTIONS=--max-old-space-size=256`; jangan paralel dengan regresi QA. Baseline distribusi: 541 MiB available.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
