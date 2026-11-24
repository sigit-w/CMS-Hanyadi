-- Fase 6u / ADR-017: induk tryout, satu sesi satu mapel, dan gate batas akhir.
-- Idempotent: aman dijalankan ulang. Status induk tidak disimpan sebagai kolom.

CREATE TABLE IF NOT EXISTS public.tryout_events (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    slug VARCHAR(32) NOT NULL UNIQUE,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tryout_events_time_order CHECK (ends_at > starts_at)
);

ALTER TABLE public.tryout_events OWNER TO bank_soal_user;

ALTER TABLE public.tryout_sessions ADD COLUMN IF NOT EXISTS event_id BIGINT;

INSERT INTO public.tryout_events (name, slug, starts_at, ends_at)
SELECT s.name, s.slug, s.start_at, s.end_at
FROM public.tryout_sessions s
WHERE s.event_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.tryout_events e WHERE e.slug = s.slug
  );

UPDATE public.tryout_sessions s
SET event_id = e.id
FROM public.tryout_events e
WHERE s.event_id IS NULL AND e.slug = s.slug;

INSERT INTO public.tryout_events (name, slug, starts_at, ends_at)
SELECT left(s.name, 128),
       left(regexp_replace(lower(s.slug), '[^a-z0-9]+', '-', 'g'), 20) || '-' || s.id::text,
       s.start_at, s.end_at
FROM public.tryout_sessions s
WHERE s.event_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.tryout_events e
      WHERE e.slug = left(regexp_replace(lower(s.slug), '[^a-z0-9]+', '-', 'g'), 20) || '-' || s.id::text
  );

UPDATE public.tryout_sessions s
SET event_id = e.id
FROM public.tryout_events e
WHERE s.event_id IS NULL
  AND e.slug = left(regexp_replace(lower(s.slug), '[^a-z0-9]+', '-', 'g'), 20) || '-' || s.id::text;

ALTER TABLE public.tryout_sessions ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE public.tryout_sessions
    DROP CONSTRAINT IF EXISTS tryout_sessions_event_id_fkey;
ALTER TABLE public.tryout_sessions
    ADD CONSTRAINT tryout_sessions_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.tryout_events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tryout_sessions_event
    ON public.tryout_sessions (event_id);

ALTER TABLE public.auth_sessions ADD COLUMN IF NOT EXISTS tryout_event_id BIGINT;

UPDATE public.auth_sessions a
SET tryout_event_id = s.event_id
FROM public.tryout_sessions s
WHERE s.id = a.tryout_session_id AND a.tryout_event_id IS NULL;

ALTER TABLE public.auth_sessions
    DROP CONSTRAINT IF EXISTS auth_sessions_tryout_event_id_fkey;
ALTER TABLE public.auth_sessions
    ADD CONSTRAINT auth_sessions_tryout_event_id_fkey
    FOREIGN KEY (tryout_event_id) REFERENCES public.tryout_events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_tryout_event
    ON public.auth_sessions (tryout_event_id)
    WHERE tryout_event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tryout_event_status(p_event_id BIGINT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN now() > e.ends_at THEN 'selesai'
        WHEN now() < e.starts_at THEN 'terjadwal'
        ELSE 'berlangsung'
    END
    FROM public.tryout_events e
    WHERE e.id = p_event_id;
$$;

CREATE OR REPLACE FUNCTION public.tryout_event_is_open(p_event_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.tryout_events e
        WHERE e.id = p_event_id AND now() <= e.ends_at
    );
$$;

CREATE OR REPLACE VIEW public.v_tryout_events AS
SELECT e.id, e.name, e.slug, e.starts_at, e.ends_at,
       public.tryout_event_status(e.id) AS status,
       e.created_at, e.updated_at
FROM public.tryout_events e;

ALTER FUNCTION public.tryout_event_status(BIGINT) OWNER TO bank_soal_user;
ALTER FUNCTION public.tryout_event_is_open(BIGINT) OWNER TO bank_soal_user;
ALTER VIEW public.v_tryout_events OWNER TO bank_soal_user;

DO $$
DECLARE
    session_row RECORD;
    mapel_row RECORD;
    attempt_row RECORD;
    v_keep_mapel BIGINT;
    v_new_session_id BIGINT;
    v_new_attempt_id BIGINT;
    v_new_slug TEXT;
    v_split_count INTEGER := 0;
BEGIN
    FOR session_row IN
        SELECT s.*
        FROM public.tryout_sessions s
        CROSS JOIN LATERAL (
            SELECT count(*)::INTEGER AS mapel_count
            FROM (
                SELECT tsm.mapel_id FROM public.tryout_session_mapels tsm
                WHERE tsm.session_id = s.id
                UNION
                SELECT sh.mapel_id FROM public.tryout_session_sheets tss
                JOIN public.question_sheets sh ON sh.id = tss.sheet_id
                WHERE tss.session_id = s.id
                UNION
                SELECT q.mapel_id FROM public.tryout_session_questions tq
                JOIN public.questions q ON q.id = tq.question_id
                WHERE tq.session_id = s.id
            ) AS u
        ) AS m
        WHERE m.mapel_count > 1
        ORDER BY s.id
    LOOP
        v_keep_mapel := NULL;
        SELECT m.id INTO v_keep_mapel
        FROM public.mapels m
        WHERE m.id = session_row.mapel_id
          AND EXISTS (
              SELECT 1 FROM public.tryout_session_mapels tsm
              WHERE tsm.session_id = session_row.id AND tsm.mapel_id = m.id
          );
        IF v_keep_mapel IS NULL THEN
            SELECT tsm.mapel_id INTO v_keep_mapel
            FROM public.tryout_session_mapels tsm
            WHERE tsm.session_id = session_row.id
            ORDER BY tsm.mapel_id
            LIMIT 1;
        END IF;

        DELETE FROM public.tryout_session_mapels
        WHERE session_id = session_row.id AND mapel_id <> v_keep_mapel;

        UPDATE public.tryout_sessions
        SET mapel_id = v_keep_mapel
        WHERE id = session_row.id;

        FOR mapel_row IN
            SELECT DISTINCT m.id, m.code, m.name
            FROM public.mapels m
            WHERE m.id IN (
                SELECT tsm.mapel_id FROM public.tryout_session_mapels tsm
                WHERE tsm.session_id = session_row.id
                UNION
                SELECT sh.mapel_id FROM public.tryout_session_sheets tss
                JOIN public.question_sheets sh ON sh.id = tss.sheet_id
                WHERE tss.session_id = session_row.id
                UNION
                SELECT q.mapel_id FROM public.tryout_session_questions tq
                JOIN public.questions q ON q.id = tq.question_id
                WHERE tq.session_id = session_row.id
            )
              AND m.id <> v_keep_mapel
            ORDER BY m.code, m.id
        LOOP
            INSERT INTO public.tryout_sessions
                (name, slug, session_date, start_at, end_at, mapel_id, is_active,
                 cbt_enabled, cbt_duration_minutes, cbt_shuffle_questions,
                 cbt_shuffle_options, cbt_require_fullscreen, cbt_max_violations,
                 event_id, created_at)
            VALUES
                (left(session_row.name || ' - ' || mapel_row.name, 128),
                 'split-' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
                 session_row.session_date, session_row.start_at, session_row.end_at,
                 mapel_row.id, false,
                 session_row.cbt_enabled, session_row.cbt_duration_minutes,
                 session_row.cbt_shuffle_questions, session_row.cbt_shuffle_options,
                 session_row.cbt_require_fullscreen, session_row.cbt_max_violations,
                 session_row.event_id, now())
            RETURNING id INTO v_new_session_id;

            v_new_slug := left(
                regexp_replace(lower(session_row.slug || '-' || mapel_row.code), '[^a-z0-9]+', '-', 'g'),
                greatest(1, 31 - length(v_new_session_id::text))
            ) || '-' || v_new_session_id::text;
            UPDATE public.tryout_sessions SET slug = v_new_slug WHERE id = v_new_session_id;

            INSERT INTO public.tryout_session_mapels (session_id, mapel_id)
            VALUES (v_new_session_id, mapel_row.id)
            ON CONFLICT DO NOTHING;

            UPDATE public.tryout_session_sheets
            SET session_id = v_new_session_id
            WHERE session_id = session_row.id
              AND sheet_id IN (SELECT id FROM public.question_sheets WHERE mapel_id = mapel_row.id);

            UPDATE public.tryout_session_questions
            SET session_id = v_new_session_id
            WHERE session_id = session_row.id
              AND question_id IN (SELECT id FROM public.questions WHERE mapel_id = mapel_row.id);

            UPDATE public.tryout_submissions
            SET session_id = v_new_session_id
            WHERE session_id = session_row.id
              AND question_id IN (SELECT id FROM public.questions WHERE mapel_id = mapel_row.id);

            INSERT INTO public.tryout_session_participants (session_id, participant_id)
            SELECT v_new_session_id, participant_id
            FROM public.tryout_session_participants
            WHERE session_id = session_row.id
            ON CONFLICT DO NOTHING;

            FOR attempt_row IN
                SELECT * FROM public.tryout_attempts WHERE session_id = session_row.id
            LOOP
                v_new_attempt_id := NULL;
                IF EXISTS (
                    SELECT 1 FROM public.tryout_session_participants
                    WHERE session_id = v_new_session_id AND participant_id = attempt_row.participant_id
                ) THEN
                    INSERT INTO public.tryout_attempts
                        (session_id, participant_id, seed, started_at, deadline_at,
                         submitted_at, status, violation_count, created_at, updated_at)
                    VALUES
                        (v_new_session_id, attempt_row.participant_id, attempt_row.seed,
                         attempt_row.started_at, attempt_row.deadline_at,
                         attempt_row.submitted_at, attempt_row.status,
                         attempt_row.violation_count, attempt_row.created_at, attempt_row.updated_at)
                    ON CONFLICT (session_id, participant_id) DO NOTHING
                    RETURNING id INTO v_new_attempt_id;

                    IF v_new_attempt_id IS NOT NULL THEN
                        INSERT INTO public.tryout_cbt_drafts (attempt_id, question_id, answer, updated_at)
                        SELECT v_new_attempt_id, d.question_id, d.answer, d.updated_at
                        FROM public.tryout_cbt_drafts d
                        WHERE d.attempt_id = attempt_row.id
                          AND EXISTS (
                              SELECT 1 FROM public.tryout_session_questions tq
                              WHERE tq.session_id = v_new_session_id AND tq.question_id = d.question_id
                          )
                        ON CONFLICT DO NOTHING;

                        INSERT INTO public.tryout_cbt_flags (attempt_id, question_id, flagged, updated_at)
                        SELECT v_new_attempt_id, f.question_id, f.flagged, f.updated_at
                        FROM public.tryout_cbt_flags f
                        WHERE f.attempt_id = attempt_row.id
                          AND EXISTS (
                              SELECT 1 FROM public.tryout_session_questions tq
                              WHERE tq.session_id = v_new_session_id AND tq.question_id = f.question_id
                          )
                        ON CONFLICT DO NOTHING;

                        INSERT INTO public.tryout_cbt_violations
                            (attempt_id, violation_type, detail, created_at)
                        SELECT v_new_attempt_id, v.violation_type, v.detail, v.created_at
                        FROM public.tryout_cbt_violations v
                        WHERE v.attempt_id = attempt_row.id;
                    END IF;
                END IF;
            END LOOP;

            v_split_count := v_split_count + 1;
            RAISE NOTICE 'BE-40: sesi % dipecah; mapel % dipindah ke sesi baru %',
                session_row.id, mapel_row.code, v_new_session_id;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'BE-40: total % sesi anak baru dibuat dari sesi multi-mapel', v_split_count;
END $$;

UPDATE public.auth_sessions a
SET tryout_event_id = s.event_id
FROM public.tryout_sessions s
WHERE s.id = a.tryout_session_id AND a.tryout_event_id IS NULL;

DO $$
DECLARE
    unsafe_count INTEGER;
BEGIN
    SELECT count(*)::INTEGER INTO unsafe_count
    FROM (
        SELECT session_id
        FROM public.tryout_session_mapels
        GROUP BY session_id
        HAVING count(*) > 1
    ) AS multi;

    IF unsafe_count = 0 THEN
        ALTER TABLE public.tryout_session_mapels
            DROP CONSTRAINT IF EXISTS uq_tryout_session_mapels_session;
        ALTER TABLE public.tryout_session_mapels
            ADD CONSTRAINT uq_tryout_session_mapels_session UNIQUE (session_id);
        RAISE NOTICE 'BE-40: UNIQUE(session_id) diterapkan pada tryout_session_mapels';
    ELSE
        RAISE NOTICE 'BE-40: UNIQUE(session_id) ditunda karena % sesi masih multi-mapel', unsafe_count;
    END IF;
END $$;
