# Backlog — Mode CBT Lengkap

| Field | Isi |
|---|---|
| PM | PM-23 |
| Status | accepted — diimplementasikan |
| Gate | REL-23 |
| ADR | `pm-agent/decisions/ADR-013-mode-cbt.md` |

## Requirement Pemilik

| ID | Requirement |
|---|---|
| R16 | Tryout dapat diaktifkan sebagai CBT lengkap: timer, submit akhir, autosave, navigasi ragu-ragu, acak, dan pengawasan. |
| R17 | Skor dihitung server dan hanya tersedia untuk admin; peserta tidak menerima skor/kunci. |
| R18 | Admin mengatur pengacakan soal dan opsi per tryout. |
| R19 | Admin melihat attempt CBT dan log pelanggaran pada laporan tryout. |
| R20 | Tryout non-CBT tetap memakai alur lama tanpa perubahan perilaku. |

## Keputusan Pemilik

| ID | Keputusan |
|---|---|
| D11 | Kerjakan CBT lengkap, bukan hanya timer/submit. |
| D12 | Hasil/admin only; presentation-service tidak pernah mengirim skor ke peserta. |
| D13 | Acak soal dan opsi dikonfigurasi admin per tryout. |
| D14 | Satu peserta hanya satu attempt per sesi CBT. |
| D15 | Fase 7 tidak dibuka; gate baru bernama `REL-23`. |

## Breakdown Task

| Task ID | Owner | Prioritas | Dependency | Scope |
|---|---|---|---|---|
| PM-23 | PM | P0 | - | ADR-013, backlog, keputusan D11–D15, handoff |
| BE-38 | Backend | P0 | ADR-013 | Migrasi `027`, owner objek, `cbt_*` di tryout, `PATCH /tryouts/{id}/cbt`, laporan attempt/violation, OpenAPI |
| FE-35 | Frontend | P0 | BE-38 (kontrak) | Form CBT, dialog Atur CBT, kolom Mode, tabel laporan, build produksi |
| TRY-17 | Tryout | P0 | BE-38, PRES-05 | Timer, autosave, flag, submit akhir, fullscreen/tab/paste guards, fallback legacy, bump aset |
| PRES-05 | Presentation | P0 | BE-38 | Endpoint attempt CBT, seed/shuffle, deadline, draft, finalize transaksional, violation auto-submit |
| QA-35 | QA | P0 | BE-38, FE-35, TRY-17, PRES-05 | `CBT-01…CBT-05`, regresi penuh, laporan & gate |
| DOC-06CBT | PM/Docs | P1 | QA-35 | ADR, backlog, handoff, status board, laporan sistem, QA report, release gate |
| REL-23 | PM | P0 | QA-35, DOC-06CBT | Deploy, verifikasi produksi, commit/push |

## Acceptance Criteria

### BE-38
- [x] Backup pre-027 dibuat dan migration `027` idempoten.
- [x] Kolom `cbt_*` dan tabel attempt/draft/flag/violation memiliki owner `bank_soal_user`.
- [x] Validasi durasi 1–600 menit, batas pelanggaran 0–100, dan durasi wajib saat CBT aktif.
- [x] Create/detail/list tryout mengembalikan konfigurasi CBT.
- [x] `PATCH /api/v1/tryouts/{id}/cbt` hanya untuk admin.
- [x] Laporan tryout menyediakan `attempts` dan `violations`.
- [x] OpenAPI dan dokumentasi DB diperbarui.

### FE-35
- [x] Form Buat Tryout memiliki pengaturan CBT.
- [x] Daftar Tryout memiliki dialog **Atur CBT** dan kolom **Mode**.
- [x] Laporan Tryout menampilkan **Attempt CBT** dan **Log Pelanggaran**.
- [x] Build Vite sukses memakai heap 256 MB.

### TRY-17
- [x] Timer dan countdown tampil pada sesi CBT.
- [x] Jawaban tersimpan lewat autosave; penanda ragu-ragu tersimpan lewat flag.
- [x] Submit akhir memakai endpoint finalize dan mengunci attempt.
- [x] Tab hidden, blur, fullscreen exit, dan paste dicatat sebagai pelanggaran.
- [x] Sesi non-CBT tetap memakai alur lama saat menerima 409.
- [x] Aset di-bump ke `styles.css?v=14` dan `app.js?v=15`.

### PRES-05
- [x] Start/state/autosave/flag/violation/finalize tersedia dengan auth tryout scoped.
- [x] Pengacakan soal/opsi/pernyataan deterministik dari seed attempt.
- [x] Opsi mengirim `key` asli dan `label` tampilan.
- [x] Deadline dan finalize tidak bisa dilewati.
- [x] Draft tidak memberi feedback skor; finalize menulis submission server-side.
- [x] Auto-submit ketika pelanggaran melebihi batas aktif.

### QA-35
- [x] `CBT-01…CBT-05` lolos.
- [x] Regresi penuh 179/179 lolos, 0 gagal, 0 P0/P1.
- [x] Fixture dihapus otomatis.
- [x] Release gate `REL-23` didokumentasikan.
