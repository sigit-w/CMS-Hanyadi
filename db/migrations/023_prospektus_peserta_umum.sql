ALTER TABLE public.tryout_participants ADD COLUMN IF NOT EXISTS prospek BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.tryout_participants ADD COLUMN IF NOT EXISTS prospek_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conname = 'tryout_participants_prospek_check'
  ) THEN
    ALTER TABLE public.tryout_participants
      ADD CONSTRAINT tryout_participants_prospek_check
      CHECK (NOT prospek OR jenis = 'umum');
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tryout_participants_prospek
  ON public.tryout_participants (prospek)
  WHERE prospek;
