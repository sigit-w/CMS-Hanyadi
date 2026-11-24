-- Fase 6o / ADR-007: jadwal mulai/selesai dan relasi tryout-lembar soal.
-- Idempotent: aman dijalankan ulang. Zona waktu lokal = Asia/Jakarta.

ALTER TABLE public.tryout_sessions
    ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;

ALTER TABLE public.tryout_sessions
    ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;

UPDATE public.tryout_sessions
SET start_at = (session_date::timestamp AT TIME ZONE 'Asia/Jakarta'),
    end_at = (session_date::timestamp AT TIME ZONE 'Asia/Jakarta') + INTERVAL '23 hours 59 minutes'
WHERE start_at IS NULL OR end_at IS NULL;

ALTER TABLE public.tryout_sessions ALTER COLUMN start_at SET NOT NULL;
ALTER TABLE public.tryout_sessions ALTER COLUMN end_at SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace
          AND conname = 'tryout_sessions_time_check'
    ) THEN
        ALTER TABLE public.tryout_sessions
            ADD CONSTRAINT tryout_sessions_time_check CHECK (end_at > start_at);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tryout_session_sheets (
    session_id BIGINT NOT NULL REFERENCES public.tryout_sessions(id) ON DELETE CASCADE,
    sheet_id BIGINT NOT NULL REFERENCES public.question_sheets(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, sheet_id)
);

CREATE INDEX IF NOT EXISTS idx_tryout_session_sheets_sheet
    ON public.tryout_session_sheets (sheet_id);

-- Backfill aman hanya untuk sesi lama yang himpunan soalnya persis sama dengan satu lembar.
INSERT INTO public.tryout_session_sheets (session_id, sheet_id)
SELECT s.id, sh.id
FROM public.tryout_sessions s
JOIN public.question_sheets sh ON sh.mapel_id = s.mapel_id
WHERE EXISTS (
    SELECT 1 FROM public.tryout_session_questions tq WHERE tq.session_id = s.id
)
AND (
    SELECT array_agg(qsq.question_id ORDER BY qsq.question_id)
    FROM public.question_sheet_questions qsq WHERE qsq.sheet_id = sh.id
) = (
    SELECT array_agg(tq.question_id ORDER BY tq.question_id)
    FROM public.tryout_session_questions tq WHERE tq.session_id = s.id
)
ON CONFLICT (session_id, sheet_id) DO NOTHING;
