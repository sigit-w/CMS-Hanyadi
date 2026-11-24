# Handoff — QA-36

| Field | Isi |
|---|---|
| Task ID | QA-36 |
| Nama task | Verifikasi Fase 6t / gate REL-26 |
| Agent pengirim | PM |
| Agent penerima | QA |
| Tanggal | 2026-11-24 |
| Status | done |

## Artifact yang Diserahkan

- Path file: `qa-agent/tests/phase6t.mjs` (baru), `qa-agent/tests/cbt.mjs`, `qa-agent/tests/tryout.mjs`, `qa-agent/tests/auth-helper.mjs`
- Endpoint / UI: create tryout multi-mapel, sheet picker, attempt non-CBT submit-all, CBT violation, picker siswa
- Bukti (log, screenshot, test result): baseline 15/15 lolos untuk `cbt.mjs + tryout.mjs`; session `271` `cbt_enabled=f`, `cbt_require_fullscreen=t`, `cbt_max_violations=3`; contoh perintah verifikasi:
  `sudo bash -lc 'set -a; . /opt/virtual-office-bank-soal/backend-agent/.env; set +a; export QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD"; exec node --test /opt/virtual-office-bank-soal/qa-agent/tests/cbt.mjs /opt/virtual-office-bank-soal/qa-agent/tests/tryout.mjs /opt/virtual-office-bank-soal/qa-agent/tests/phase6t.mjs'`

## Acceptance Criteria Terpenuhi

- [ ] create tryout dengan `['MTKA','IPAS']` sukses; `['MTKA','MTKA']` ditolak `400`
- [ ] sheet dari mapel tidak terpilih ditolak; mencopot mapel menghapus sheet_ids terkait
- [ ] satu violation → satu toast (bukan dua), teks memuat `n/3`; kuota tetap 3
- [ ] non-CBT submit sekali mengirim semua jawaban; tidak ada request per soal dari UI
- [ ] picker siswa menampilkan minimal 1 siswa aktif fixture; kasus 0 siswa menampilkan pesan kosong
- [ ] regresi `T-09`, `CBT-06`, dan alur non-CBT lama tetap lolos
- [ ] bukti test + versi asset dicatat di status board

## Catatan Kendala / Risiko

- Pakai fixture unik dan cleanup; jangan tinggalkan participant/tryout QA di produksi.
- Jangan mencetak `BOOTSTRAP_ADMIN_PASSWORD`; ambil dari env.
- Tidak ada pengujian Fase 7.

## Tindakan Penerima

- [ ] Diterima
- [ ] Ditolak, alasan:
