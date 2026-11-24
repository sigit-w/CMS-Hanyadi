-- Fase 6o / ADR-007: perbaikan untuk database yang sudah menjalankan 020.
-- Peserta Umum menyimpan pin_hash dan tidak memiliki password_hash.
-- Idempotent: aman dijalankan ulang.

ALTER TABLE public.tryout_participants ALTER COLUMN password_hash DROP NOT NULL;
