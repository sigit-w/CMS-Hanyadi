ALTER TABLE public.tryout_sessions ADD COLUMN IF NOT EXISTS slug VARCHAR(32);

UPDATE public.tryout_sessions
SET slug = left(
  COALESCE(
    NULLIF(btrim(regexp_replace(lower(coalesce(name, 'tryout')), '[^a-z0-9]+', '-', 'g'), '-'), ''),
    'tryout'
  ),
  greatest(1, 31 - length(id::text))
) || '-' || id::text
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tryout_sessions_slug
  ON public.tryout_sessions (slug);

ALTER TABLE public.tryout_sessions ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.auth_sessions ADD COLUMN IF NOT EXISTS tryout_session_id BIGINT;

DELETE FROM public.auth_sessions
WHERE participant_id IS NOT NULL AND tryout_session_id IS NULL;

DO $$
DECLARE
  rolled_back integer;
BEGIN
  WITH converted AS (
    SELECT id, nama, bergabung_at
    FROM public.prospektus
    WHERE bergabung
  ),
  removed AS (
    DELETE FROM public.siswa s
    USING converted c
    WHERE s.jenis = 'siswa'
      AND s.nama = c.nama
      AND s.created_at BETWEEN c.bergabung_at - interval '5 minutes'
                           AND c.bergabung_at + interval '5 minutes'
    RETURNING s.id
  ),
  cleared AS (
    UPDATE public.prospektus p
    SET bergabung = false, bergabung_at = NULL
    WHERE p.bergabung
    RETURNING p.id
  )
  SELECT count(*) INTO rolled_back FROM cleared;

  RAISE NOTICE 'Fase 6s: % prospek dikembalikan ke prospektus (REL-20 rollback)', rolled_back;
END $$;

ALTER TABLE public.auth_sessions
  DROP CONSTRAINT IF EXISTS auth_sessions_tryout_session_id_fkey;
ALTER TABLE public.auth_sessions
  ADD CONSTRAINT auth_sessions_tryout_session_id_fkey
  FOREIGN KEY (tryout_session_id) REFERENCES public.tryout_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_tryout
  ON public.auth_sessions (tryout_session_id)
  WHERE tryout_session_id IS NOT NULL;

ALTER TABLE public.auth_sessions
  DROP CONSTRAINT IF EXISTS auth_sessions_participant_tryout_check;
ALTER TABLE public.auth_sessions
  ADD CONSTRAINT auth_sessions_participant_tryout_check CHECK (
    (participant_id IS NULL AND tryout_session_id IS NULL)
    OR (participant_id IS NOT NULL AND tryout_session_id IS NOT NULL)
  );
