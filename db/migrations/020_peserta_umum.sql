-- Fase 6o / ADR-007: Peserta Umum dengan login Nama + PIN.
-- Idempotent: aman dijalankan ulang.

ALTER TABLE public.tryout_participants
    ADD COLUMN IF NOT EXISTS jenis VARCHAR(16) NOT NULL DEFAULT 'siswa';

ALTER TABLE public.tryout_participants
    ADD COLUMN IF NOT EXISTS pin_hash TEXT;

ALTER TABLE public.tryout_participants ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.tryout_participants ALTER COLUMN password_hash DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace
          AND conname = 'tryout_participants_jenis_check'
    ) THEN
        ALTER TABLE public.tryout_participants
            ADD CONSTRAINT tryout_participants_jenis_check CHECK (
                jenis IN ('siswa', 'umum')
                AND (
                    (jenis = 'siswa' AND email IS NOT NULL AND password_hash IS NOT NULL)
                    OR
                    (jenis = 'umum' AND email IS NULL AND pin_hash IS NOT NULL AND wa_orang_tua IS NOT NULL)
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace
          AND conname = 'tryout_participants_pin_format'
    ) THEN
        ALTER TABLE public.tryout_participants
            ADD CONSTRAINT tryout_participants_pin_format
            CHECK (pin_hash IS NULL OR pin_hash LIKE 'scrypt$16384$8$1$%');
    END IF;
END $$;

DROP INDEX IF EXISTS public.uq_tryout_participants_email;
CREATE UNIQUE INDEX uq_tryout_participants_email
    ON public.tryout_participants (lower(email))
    WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tryout_participants_umum_nama
    ON public.tryout_participants (lower(nama))
    WHERE jenis = 'umum';

CREATE INDEX IF NOT EXISTS idx_tryout_participants_jenis
    ON public.tryout_participants (jenis);
