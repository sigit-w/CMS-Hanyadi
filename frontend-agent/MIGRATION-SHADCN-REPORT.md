# Laporan Redesign Shadcn UI - CMS Bank Soal

**Tanggal**: 2026-11-22  
**Target**: `frontend-agent` (React 18 + Vite 5)  
**Domain prod**: `cms.hanyadi.web.id` (Nginx root: `/opt/virtual-office-bank-soal/frontend-agent/dist`)

## Ringkasan

Migrasi dan redesign total UI CMS ke gaya Shadcn UI dilakukan bertahap untuk menjaga penggunaan memori rendah. Build produksi berhasil dengan `NODE_OPTIONS="--max-old-space-size=384"`.

## Perubahan Utama

- **Fondasi Shadcn-style**: Tailwind CSS, PostCSS, `components.json`, alias `@`, util `cn`, token tema slate (`bg-muted/40`, shadow panel).
- **Primitif UI**: `button`, `input`, `textarea`, `label`, `card`, `badge`, `alert`, `select-native`, `table`, `checkbox`, `separator`, `skeleton`.
- **Layout App**: sidebar fixed responsif, mobile drawer, breadcrumb header, user/session card, navigasi permission-aware, route/hash tetap.
- **Halaman diredesain**: `LoginView`, `Dashboard`, `QuestionInput`, `UserManagement`, `RoleManagement`, `TryoutManagement`, `TryoutReport`, `SystemReport`.
- **Perilaku dipertahankan**: auth/session, permission gating, route hash, CRUD/aksi existing, filter soal, readiness versi, import, manajemen user/role, tryout, laporan, embed laporan sistem. *(Catatan DOC-06J: `readiness versi` sudah dihapus di Fase 6j/ADR-004; baris ini adalah konteks historis laporan migrasi Shadcn, bukan kontrak aktif.)*

## Build & Deploy

```bash
cd /opt/virtual-office-bank-soal/frontend-agent
NODE_OPTIONS="--max-old-space-size=384" npm run build
cp public/laporan-sistem/index.html dist/laporan-sistem/index.html
```

- Build: sukses (`dist/assets/index-CP0DIBcs.js`, `dist/assets/index-aqtaqFsk.css`).
- `dist/laporan-sistem/index.html` dipulihkan setelah build.
- Verifikasi prod: `curl https://cms.hanyadi.web.id/` mengembalikan aset baru; endpoint laporan sistem tetap ada.

## Catatan

- Vite `emptyOutDir: true` menghapus `dist/laporan-sistem`; wajib restore setelah build.
- Sejak Fase 6j, daftar soal tidak memakai pilihan/readiness versi: pagination 20 dan stem non-bold mengikuti ADR-004.
- Jika tampilan lama masih terlihat di browser, lakukan hard refresh karena cache browser.
