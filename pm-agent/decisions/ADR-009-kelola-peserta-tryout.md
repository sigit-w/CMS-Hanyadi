# Decision Log — ADR-009

| Field | Isi |
|---|---|
| ID | ADR-009 |
| Tanggal | 2026-11-24 |
| Pemilik | PM |
| Status | accepted |
| Terkait task | PM-19, BE-34, FE-31, QA-31, DOC-06Q, REL-19 |

## Konteks

Fase 6p menambahkan popup **Kelola Peserta** pada daftar tryout, tetapi isinya hanya daftar peserta yang sudah terlampir. Pemilik meminta tiga penyesuaian: (1) hapus teks bantu `Data siswa tidak ditampilkan sampai dipilih melalui A. Peserta Didik.` dari form Buat Tryout, (2) popup Kelola Peserta juga menampilkan dua tombol `A. Peserta Didik` dan `B. Peserta Umum` dengan alur yang sama seperti menambah peserta di form Buat Tryout, dan (3) laporan sistem diperbarui sebelum commit/push. Tidak ada perubahan skema yang diminta, tetapi penambahan peserta ke tryout yang sudah tersimpan belum memiliki endpoint; endpoint lama hanya membuat tryout beserta peserta saat awal.

## Keputusan

1. **Hapus helper text.** Kalimat `Data siswa tidak ditampilkan sampai dipilih melalui A. Peserta Didik.` dihapus dari fieldset Peserta Tryout. Perilaku default tetap sama: daftar hanya merender peserta yang sudah dipilih, dan siswa muncul setelah dipilih lewat opsi A.
2. **Popup Kelola Peserta diperluas.** Popup dari tombol `Kelola Peserta` pada Daftar Tryout tetap menampilkan daftar peserta tryout dengan detail dan icon trash, lalu ditambah dua tombol `A. Peserta Didik` dan `B. Peserta Umum`. Kedua tombol memakai dialog dan validasi yang sama dengan alur di form Buat Tryout.
3. **Target penambahan eksplisit.** Frontend menyimpan target `draft` atau `manage`. Di target `draft`, pilihan siswa/Umum masih memperbarui state lokal seperti sebelumnya. Di target `manage`, pilihan siswa/Umum harus langsung tersimpan ke tryout bersangkutan lalu popup daftar dimuat ulang.
4. **Endpoint baru.** Backend menambahkan `POST /api/v1/tryouts/{id}/participants` dengan permission `tryouts.manage` dan payload `{ participant_ids: number[] }`. Endpoint memvalidasi tryout, peserta aktif, dan bukan prospek; relasi yang sudah ada dilewati (`ON CONFLICT DO NOTHING`) sehingga idempoten. Respons mengembalikan `participant_ids` terbaru dan `added_ids`.
5. **Peserta Umum dari popup Kelola.** Alur B tetap memanggil `POST /api/v1/participants` untuk membuat Nama/Sekolah/PIN/WA, lalu memanggil endpoint baru untuk melampirkannya ke tryout. Jika lampiran gagal, data Umum yang sudah dibuat tidak dihapus otomatis; admin dapat mencoba lagi dari picker yang sama.
6. **Detail & hapus tidak berubah.** Klik baris tetap membuka dialog detail; trash tetap memakai `DELETE /tryouts/{id}/participants/{participantId}` dengan perlakuan Umum→Prospektus dan Siswa→hanya lepas relasi sesuai ADR-008.
7. **Tidak ada migrasi.** Tidak ada kolom, tabel, permission, atau constraint baru. Perubahan hanya backend endpoint, frontend, dokumentasi API, laporan sistem, dan QA.
8. **Laporan sistem.** `frontend-agent/public/laporan-sistem/index.html` diperbarui dengan ringkasan Fase 6p/6q, jumlah test terbaru, gate `REL-19`, dan menu Prospektus sebelum rilis.
9. **Gate terpisah.** `REL-19` menilai Fase 6q secara mandiri. `REL-15` tetap partial; `REL-16` sampai `REL-18` tetap GO.

## Konsekuensi

- Popup Kelola Peserta kini menjadi pusat manajemen peserta tryout setelah tryout dibuat, bukan hanya daftar pasif.
- Endpoint baru hanya melampirkan peserta yang sudah ada; membuat Peserta Umum tetap memakai endpoint participant yang sudah ada.
- Siswa yang sudah terlampir ditandai `Dipilih`/dinonaktifkan di picker agar tidak duplikat, meski backend tetap idempoten.
- PIN Umum baru tetap hanya tampil sekali pada notifikasi saat pembuatan.
- Perubahan menyentuh backend, CMS, OpenAPI, backend README, laporan sistem, QA, PM docs, dan commit/push.

## Alternatif yang Dipertimbangkan

- **Menyimpan perubahan hanya di state frontend**: ditolak karena popup berada pada tryout tersimpan; perubahan harus persisten setelah refresh.
- **Membuat endpoint khusus Umum yang membuat + melampirkan dalam satu transaksi**: ditolak untuk sementara karena akan menggandakan validasi participant ADR-007; dua endpoint existing/new sudah cukup dan risikonya dapat ditangani lewat notifikasi.
- **Menghapus tombol trash lama**: ditolak karena pemilik hanya meminta penambahan alur A/B, bukan mengubah penghapusan.
- **Menambah kolom/chip baru di skema**: ditolak karena tidak ada kebutuhan data baru.
