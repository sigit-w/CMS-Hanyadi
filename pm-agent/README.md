# PM Agent — Project Manager

## Fungsi

Memecah pekerjaan menjadi task, menentukan prioritas dan dependency, memantau progres, serta mengatur alur serah terima antar agent.

## File yang dikelola

| File | Fungsi |
|---|---|
| `tasks/phase3-backlog.md` | Indeks backlog dan aturan prioritas Fase 3 |
| `tasks/phase6-backlog.md` | Backlog & AC Fase 6: manajemen role + login CMS/tryout |
| `tasks/handoff-template.md` | Format serah terima antar agent |
| `tasks/handoff-BE13-17.md` | Serah terima PM→Backend Fase 6 |
| `tasks/handoff-FE10-13.md` | Serah terima PM→Frontend Fase 6 |
| `tasks/handoff-TRY04-06.md` | Serah terima PM→Tryout Fase 6 |
| `tasks/handoff-QA11-14.md` | Serah terima PM→QA Fase 6 |
| `tasks/phase6g-backlog.md` | Backlog & AC Fase 6g: manajemen tryout |
| `tasks/phase6j-backlog.md` | Backlog & AC Fase 6j: penyederhanaan soal & pagination |
| `tasks/phase6l-backlog.md` | Requirement & AC draft Fase 6l: Lembar Soal |
| `tasks/phase6n-backlog.md` | Requirement, keputusan, & AC Fase 6n: Manajemen Bimbel |
| `tasks/handoff-BE31.md` | Serah terima PM→Backend Fase 6n: verifikasi kontrak & dokumentasi |
| `tasks/handoff-FE28.md` | Serah terima PM→Frontend Fase 6n: grup/menu/rute Manajemen Bimbel |
| `tasks/handoff-QA28.md` | Serah terima PM→QA Fase 6n: marker, skenario navigasi, regresi |
| `tasks/handoff-BE25-PRES02.md` | Serah terima PM→Backend/Presentation Fase 6j |
| `tasks/handoff-FE21-TRY10.md` | Serah terima PM→Frontend/Tryout Fase 6j |
| `tasks/handoff-QA22-REL10.md` | Serah terima PM→QA/PM Fase 6j |
| `progress/status-board.md` | Papan status seluruh task Fase 3–6 |
| `decisions/adr-template.md` | Template log keputusan |
| `decisions/ADR-001-auth-role.md` | Keputusan auth, model role, dan perubahan schema Fase 6 |
| `decisions/ADR-002-manajemen-tryout.md` | Keputusan model data & enforcement Manajemen Tryout |
| `decisions/ADR-004-penyederhanaan-soal.md` | Keputusan status approved, versi nonaktif, dan pagination Fase 6j |
| `decisions/ADR-006-manajemen-bimbel.md` | Keputusan grup menu, rute, dan permission Manajemen Bimbel Fase 6n |

Sumber kebenaran backlog Fase 3 ada di `docs/phase3-tasks.md`; Fase 6 ada di `tasks/phase6-backlog.md`; Fase 6j ada di `tasks/phase6j-backlog.md`; Fase 6l ada di `tasks/phase6l-backlog.md`; Fase 6n ada di `tasks/phase6n-backlog.md`. File di direktori ini dipakai untuk mengoperasionalkan backlog tersebut.

## Ritme Kerja

1. Pastikan setiap task punya ID, owner, prioritas, dependency, dan acceptance criteria.
2. Update `progress/status-board.md` setiap hari kerja.
3. Untuk setiap serah terima, salin `tasks/handoff-template.md` dan isi lengkap.
4. Eskalasi blocker lebih dari 1 hari kerja lewat `decisions/adr-template.md`.
5. Di akhir Fase 3, jalankan release gate bersama QA (`PM-04`).

## Prioritas

- `P0`: wajib selesai sebelum rilis.
- `P1`: penting, boleh menyusul jika tidak menghambat P0.
- `P2`: penyiapan Fase 4.
