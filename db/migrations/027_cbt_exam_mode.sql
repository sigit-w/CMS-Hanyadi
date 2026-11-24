ALTER TABLE tryout_sessions
    ADD COLUMN IF NOT EXISTS cbt_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cbt_duration_minutes INTEGER,
    ADD COLUMN IF NOT EXISTS cbt_shuffle_questions BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cbt_shuffle_options BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cbt_require_fullscreen BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cbt_max_violations INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tryout_sessions_cbt_duration') THEN
        ALTER TABLE tryout_sessions ADD CONSTRAINT ck_tryout_sessions_cbt_duration
            CHECK (cbt_duration_minutes IS NULL OR cbt_duration_minutes BETWEEN 1 AND 600);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tryout_sessions_cbt_enabled_duration') THEN
        ALTER TABLE tryout_sessions ADD CONSTRAINT ck_tryout_sessions_cbt_enabled_duration
            CHECK (NOT cbt_enabled OR cbt_duration_minutes IS NOT NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tryout_sessions_cbt_max_violations') THEN
        ALTER TABLE tryout_sessions ADD CONSTRAINT ck_tryout_sessions_cbt_max_violations
            CHECK (cbt_max_violations BETWEEN 0 AND 100);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS tryout_attempts (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES tryout_sessions(id) ON DELETE CASCADE,
    participant_id BIGINT NOT NULL,
    seed VARCHAR(64) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deadline_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    violation_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, participant_id),
    CONSTRAINT ck_tryout_attempts_status
        CHECK (status IN ('in_progress', 'submitted', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_tryout_attempts_session_status
    ON tryout_attempts (session_id, status);
CREATE INDEX IF NOT EXISTS idx_tryout_attempts_participant
    ON tryout_attempts (participant_id);

CREATE TABLE IF NOT EXISTS tryout_cbt_drafts (
    attempt_id BIGINT NOT NULL REFERENCES tryout_attempts(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS tryout_cbt_flags (
    attempt_id BIGINT NOT NULL REFERENCES tryout_attempts(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    flagged BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS tryout_cbt_violations (
    id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL REFERENCES tryout_attempts(id) ON DELETE CASCADE,
    violation_type VARCHAR(40) NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tryout_cbt_violations_attempt
    ON tryout_cbt_violations (attempt_id, created_at);

CREATE OR REPLACE FUNCTION public.assert_participant_exists() RETURNS trigger AS $$
BEGIN
  IF NEW.participant_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.siswa WHERE id = NEW.participant_id)
     AND NOT EXISTS (SELECT 1 FROM public.prospektus WHERE id = NEW.participant_id) THEN
    RAISE EXCEPTION 'participant_id % tidak ditemukan', NEW.participant_id
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.cascade_participant_delete() RETURNS trigger AS $$
BEGIN
  DELETE FROM public.auth_sessions WHERE participant_id = OLD.id;
  DELETE FROM public.tryout_submissions WHERE participant_id = OLD.id;
  DELETE FROM public.tryout_session_participants WHERE participant_id = OLD.id;
  DELETE FROM public.tryout_attempts WHERE participant_id = OLD.id;
  RETURN OLD;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tryout_attempts_participant_ref ON public.tryout_attempts;
CREATE TRIGGER trg_tryout_attempts_participant_ref
    BEFORE INSERT OR UPDATE OF participant_id ON public.tryout_attempts
    FOR EACH ROW EXECUTE FUNCTION public.assert_participant_exists();

CREATE OR REPLACE VIEW v_cbt_attempt_report AS
WITH scores AS (
    SELECT
        a.id AS attempt_id,
        count(s.id) AS question_count,
        count(s.id) FILTER (WHERE s.is_correct) AS correct_count,
        CASE WHEN count(s.id) = 0 THEN 0
             ELSE round(100.0 * count(s.id) FILTER (WHERE s.is_correct) / count(s.id), 2)
        END AS score
    FROM tryout_attempts a
    LEFT JOIN tryout_submissions s
        ON s.participant_id = a.participant_id
       AND s.session_id = a.session_id
       AND s.version = 'v1'
    GROUP BY a.id
)
SELECT
    a.id AS attempt_id,
    a.session_id,
    ts.name AS session_name,
    a.participant_id,
    p.nama AS participant,
    p.kelas,
    p.sekolah,
    a.seed,
    a.started_at,
    a.deadline_at,
    a.submitted_at,
    a.status,
    a.violation_count,
    coalesce(sc.question_count, 0) AS question_count,
    coalesce(sc.correct_count, 0) AS correct_count,
    sc.score
FROM tryout_attempts a
JOIN tryout_sessions ts ON ts.id = a.session_id
LEFT JOIN tryout_participants p ON p.id = a.participant_id
LEFT JOIN scores sc ON sc.attempt_id = a.id;

ALTER TABLE tryout_sessions OWNER TO bank_soal_user;
ALTER TABLE tryout_attempts OWNER TO bank_soal_user;
ALTER SEQUENCE tryout_attempts_id_seq OWNER TO bank_soal_user;
ALTER TABLE tryout_cbt_drafts OWNER TO bank_soal_user;
ALTER TABLE tryout_cbt_flags OWNER TO bank_soal_user;
ALTER TABLE tryout_cbt_violations OWNER TO bank_soal_user;
ALTER SEQUENCE tryout_cbt_violations_id_seq OWNER TO bank_soal_user;
ALTER VIEW v_cbt_attempt_report OWNER TO bank_soal_user;
