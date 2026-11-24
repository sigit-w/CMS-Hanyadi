# Laporan QA — Fase 6q: Kelola Peserta dari Daftar Tryout

| Field | Isi |
|---|---|
| Tanggal | 2026-11-24 |
| Task | PM-19 → BE-34 → FE-31 → QA-31 → DOC-06Q → REL-19 |
| ADR | `pm-agent/decisions/ADR-009-kelola-peserta-tryout.md` |
| Test khusus | 5/5 pass, 0 fail |
| Regresi penuh | 155/155 pass, 0 fail |
| Bug P0/P1 | 0 |
| Bundle CMS | `index-D0au7v9d.js` (285,98 kB, gzip 81,30 kB) |

## Perintah yang Dijalankan

```bash
free -h
NODE_OPTIONS=--max-old-space-size=256 npm run build
set -a; . ./.env; set +a
export QA_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD"
NODE_OPTIONS=--max-old-space-size=128 node --test ../qa-agent/tests/phase6q.mjs
NODE_OPTIONS=--max-old-space-size=128 npm test
```

Semua perintah dijalankan serial di `/opt/virtual-office-bank-soal/backend-agent`, kecuali build di `/opt/virtual-office-bank-soal/frontend-agent`. Memori tersedia ≈376 MiB dengan 2,9 GiB swap kosong setelah build; tidak ada OOM.

## Hasil Skenario

| ID | Skenario | Status | Bukti |
|---|---|---|---|
| QP-01 | Kontrak ADR-009, OpenAPI path `/tryouts/{id}/participants`, `added_ids`, backend README | pass | ADR-009, OpenAPI, README |
| QP-02 | Helper text lama hilang; popup Kelola Peserta punya `A. Peserta Didik`, `B. Peserta Umum`, target `manage`, dan helper attach | pass | Source `TryoutManagement.jsx`, `api.js` |
| QP-03 | Siswa existing dilampirkan ke tryout tersimpan; repeat tidak menambah duplikat; payload kosong/ID tidak ada/tryout tidak ada ditolak | pass | 200 dengan `added_ids`, lalu `added_ids=[]`; 400/404 |
| QP-04 | Umum baru dari alur popup dibuat, langsung terlampir, lalu trash memindahkannya ke prospek | pass | `is_active=false`, `prospek=true`, relasi hilang |
| QP-05 | Peserta prospek ditolak saat attach; health API/presentation aktif; bundle produksi memuat marker baru dan tidak memuat helper text lama | pass | 400, health 200, bundle `index-D0au7v9d.js` |

## Regresi & Produksi

- `npm test`: 155 test, 155 pass, 0 fail, 0 cancelled, 0 skipped.
- `phase6p.mjs` PR-02 telah diselaraskan: helper text lama kini **tidak boleh** ada.
- `tryout-agent` tidak diubah; aset `styles.css?v=11` dan `app.js?v=12` tetap `200`.
- Health: `127.0.0.1:8082/health` `200`, `127.0.0.1:8083/health` `200`.
- Publik: `https://cms.hanyadi.web.id/` `200`, `https://tryout.hanyadi.web.id/` `200`.
- Bundle baru `https://cms.hanyadi.web.id/assets/index-D0au7v9d.js` `200`.
- Laporan sistem di `frontend-agent/public/laporan-sistem/index.html` diperbarui ke Fase 6q, 155/155, REL-19, dan alur Kelola Peserta.

## Pembersihan Fixture

`after()` pada `phase6q.mjs` menghapus tryout uji, relasi, sesi auth, dan peserta uji (`QA 6Q ...`). Tidak ada perubahan data produksi di luar fixture QA.

## Catatan

- Tidak ada migrasi database baru pada Fase 6q.
- Endpoint baru bersifat idempoten dan hanya menerima peserta aktif bukan prospek.
- Jika attach Umum gagal setelah participant berhasil dibuat, data Umum tetap ada dan dapat dicoba ulang dari picker; PIN hanya ditampilkan saat pembuatan.
- `REL-15` tetap partial menunggu regresi penuh Fase 6m; gate Fase 6q berdiri sendiri sebagai `REL-19`.
