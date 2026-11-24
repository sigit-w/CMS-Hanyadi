-- Peserta tryout (siswa): program belajar dan kontak WA orang tua.
-- Idempotent: aman dijalankan ulang.

ALTER TABLE public.tryout_participants
    ADD COLUMN IF NOT EXISTS program_belajar_id BIGINT
        REFERENCES public.program_belajar(id) ON DELETE SET NULL;

ALTER TABLE public.tryout_participants
    ADD COLUMN IF NOT EXISTS wa_orang_tua VARCHAR(20);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace
          AND conname = 'tryout_participants_wa_format'
    ) THEN
        ALTER TABLE public.tryout_participants
            ADD CONSTRAINT tryout_participants_wa_format
            CHECK (wa_orang_tua IS NULL OR wa_orang_tua ~ '^\+?[0-9][0-9 -]{6,18}$');
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tryout_participants_program
    ON public.tryout_participants (program_belajar_id);
