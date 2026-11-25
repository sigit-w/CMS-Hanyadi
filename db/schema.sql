CREATE TABLE IF NOT EXISTS contributors (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'editor'
        CHECK (role IN ('admin', 'editor', 'reviewer', 'qa')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mapels (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(4) NOT NULL UNIQUE
        CHECK (code ~ '^[A-Z0-9]{4}$'),
    name VARCHAR(64) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_types (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE
        CHECK (code IN ('manual', 'file_upload', 'external_collection')),
    name VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_sources (
    id BIGSERIAL PRIMARY KEY,
    type_id BIGINT NOT NULL REFERENCES source_types(id) ON DELETE RESTRICT,
    label VARCHAR(128) NOT NULL,
    original_filename VARCHAR(255),
    storage_path TEXT,
    mime_type VARCHAR(128),
    external_ref VARCHAR(255),
    collected_from VARCHAR(255),
    collected_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    uploaded_by BIGINT REFERENCES contributors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
    id BIGSERIAL PRIMARY KEY,
    mapel_id BIGINT NOT NULL REFERENCES mapels(id) ON DELETE RESTRICT,
    source_id BIGINT REFERENCES question_sources(id) ON DELETE SET NULL,
    stem TEXT NOT NULL,
    image_url TEXT,
    question_type VARCHAR(24) NOT NULL DEFAULT 'multiple_choice'
        CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'essay')),
    difficulty VARCHAR(12) NOT NULL DEFAULT 'medium'
        CHECK (difficulty IN ('easy', 'medium', 'hard')),
    status VARCHAR(16) NOT NULL DEFAULT 'approved'
        CHECK (status IN ('approved', 'rejected', 'archived')),
    is_multi_version_ready BOOLEAN NOT NULL DEFAULT false,
    created_by BIGINT REFERENCES contributors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT questions_stem_not_blank CHECK (length(btrim(stem)) > 0)
);

CREATE TABLE IF NOT EXISTS question_options (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_key VARCHAR(4) NOT NULL,
    content TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (question_id, option_key),
    CONSTRAINT question_options_content_not_blank CHECK (length(btrim(content)) > 0)
);

CREATE TABLE IF NOT EXISTS answer_keys (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL UNIQUE REFERENCES questions(id) ON DELETE CASCADE,
    correct_option_id BIGINT REFERENCES question_options(id) ON DELETE SET NULL,
    answer_text TEXT,
    explanation TEXT,
    updated_by BIGINT REFERENCES contributors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT answer_key_has_value CHECK (
        correct_option_id IS NOT NULL OR length(btrim(coalesce(answer_text, ''))) > 0
    )
);

CREATE TABLE IF NOT EXISTS question_statements (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    statement_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (question_id, position),
    CONSTRAINT question_statements_text_not_blank
        CHECK (length(btrim(statement_text)) > 0),
    CONSTRAINT question_statements_position_range
        CHECK (position BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_question_statements_question
    ON question_statements (question_id, position);

CREATE TABLE IF NOT EXISTS tryout_sessions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    session_date DATE NOT NULL,
    mapel_id BIGINT REFERENCES mapels(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    cbt_enabled BOOLEAN NOT NULL DEFAULT false,
    cbt_duration_minutes INTEGER CHECK (cbt_duration_minutes IS NULL OR cbt_duration_minutes BETWEEN 1 AND 600),
    cbt_shuffle_questions BOOLEAN NOT NULL DEFAULT false,
    cbt_shuffle_options BOOLEAN NOT NULL DEFAULT false,
    cbt_require_fullscreen BOOLEAN NOT NULL DEFAULT false,
    cbt_max_violations INTEGER NOT NULL DEFAULT 0 CHECK (cbt_max_violations BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_tryout_sessions_cbt_enabled_duration
        CHECK (NOT cbt_enabled OR cbt_duration_minutes IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tryout_sessions_active
    ON tryout_sessions ((is_active)) WHERE is_active;

CREATE TABLE IF NOT EXISTS tryout_session_questions (
    session_id BIGINT NOT NULL REFERENCES tryout_sessions(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_tryout_session_questions_question
    ON tryout_session_questions (question_id);

CREATE TABLE IF NOT EXISTS tryout_session_participants (
    session_id BIGINT NOT NULL REFERENCES tryout_sessions(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tryout_session_participants_user
    ON tryout_session_participants (user_id);

CREATE TABLE IF NOT EXISTS tryout_submissions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    session_id BIGINT REFERENCES tryout_sessions(id) ON DELETE SET NULL,
    version VARCHAR(16) NOT NULL,
    answer TEXT,
    is_correct BOOLEAN NOT NULL,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, question_id, version)
);

CREATE INDEX IF NOT EXISTS idx_tryout_submissions_user_version
    ON tryout_submissions (user_id, version);
CREATE INDEX IF NOT EXISTS idx_tryout_submissions_question
    ON tryout_submissions (question_id);
CREATE INDEX IF NOT EXISTS idx_tryout_submissions_session_user
    ON tryout_submissions (session_id, user_id);

CREATE TABLE IF NOT EXISTS submission_statement_answers (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES tryout_submissions(id) ON DELETE CASCADE,
    statement_id BIGINT NOT NULL REFERENCES question_statements(id) ON DELETE CASCADE,
    answer BOOLEAN NOT NULL,
    is_correct BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (submission_id, statement_id)
);

CREATE INDEX IF NOT EXISTS idx_submission_statement_answers_submission
    ON submission_statement_answers (submission_id);

CREATE TABLE IF NOT EXISTS tryout_attempts (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES tryout_sessions(id) ON DELETE CASCADE,
    participant_id BIGINT NOT NULL,
    seed VARCHAR(64) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deadline_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'submitted', 'expired')),
    violation_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, participant_id)
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

CREATE TABLE IF NOT EXISTS question_sheets (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(16) NOT NULL UNIQUE,
    description TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    mapel_id BIGINT NOT NULL REFERENCES mapels(id) ON DELETE RESTRICT,
    archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    created_by BIGINT REFERENCES contributors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT question_sheets_code_format CHECK (length(code) IN (15, 16) AND code ~ '^LS-[A-Z0-9]{4}-(SD|SMP|SMA)-[0-9]{4}$'),
    CONSTRAINT question_sheets_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS question_sheet_questions (
    sheet_id BIGINT NOT NULL REFERENCES question_sheets(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (sheet_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_question_sheet_questions_question
    ON question_sheet_questions (question_id);
CREATE INDEX IF NOT EXISTS idx_question_sheets_mapel_archived
    ON question_sheets (mapel_id, archived);

CREATE TABLE IF NOT EXISTS program_belajar (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    kelas INTEGER NOT NULL CHECK (kelas BETWEEN 1 AND 12),
    description TEXT,
    biaya NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (biaya >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT program_belajar_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS program_belajar_schedules (
    id BIGSERIAL PRIMARY KEY,
    program_id BIGINT NOT NULL REFERENCES program_belajar(id) ON DELETE CASCADE,
    day VARCHAR(10) NOT NULL CHECK (day IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT program_belajar_schedules_time_order CHECK (end_time > start_time),
    CONSTRAINT program_belajar_schedules_unique UNIQUE (program_id, day, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_program_belajar_schedules_program
    ON program_belajar_schedules (program_id, position);

CREATE TABLE IF NOT EXISTS presentation_versions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(16) NOT NULL UNIQUE,
    name VARCHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_version_readiness (
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    version_id BIGINT NOT NULL REFERENCES presentation_versions(id) ON DELETE RESTRICT,
    is_ready BOOLEAN NOT NULL DEFAULT false,
    validated_by BIGINT REFERENCES contributors(id) ON DELETE SET NULL,
    validated_at TIMESTAMPTZ,
    notes TEXT,
    PRIMARY KEY (question_id, version_id)
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_questions_updated_at ON questions;
CREATE TRIGGER trg_questions_updated_at
BEFORE UPDATE ON questions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_answer_keys_updated_at ON answer_keys;
CREATE TRIGGER trg_answer_keys_updated_at
BEFORE UPDATE ON answer_keys
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tryout_submissions_updated_at ON tryout_submissions;
CREATE TRIGGER trg_tryout_submissions_updated_at
BEFORE UPDATE ON tryout_submissions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_question_sheets_updated_at ON question_sheets;
CREATE TRIGGER trg_question_sheets_updated_at
BEFORE UPDATE ON question_sheets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_program_belajar_updated_at ON program_belajar;
CREATE TRIGGER trg_program_belajar_updated_at
BEFORE UPDATE ON program_belajar
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_questions_mapel_status
    ON questions (mapel_id, status);
CREATE INDEX IF NOT EXISTS idx_questions_source
    ON questions (source_id);
CREATE INDEX IF NOT EXISTS idx_questions_status
    ON questions (status);
CREATE INDEX IF NOT EXISTS idx_options_question
    ON question_options (question_id);
CREATE INDEX IF NOT EXISTS idx_answer_keys_option
    ON answer_keys (correct_option_id);
CREATE INDEX IF NOT EXISTS idx_sources_type
    ON question_sources (type_id);
CREATE INDEX IF NOT EXISTS idx_sources_created
    ON question_sources (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_readiness_version
    ON question_version_readiness (version_id) WHERE is_ready;

CREATE OR REPLACE VIEW v_question_catalog AS
SELECT
    q.id,
    q.stem,
    q.image_url,
    q.question_type,
    q.difficulty,
    q.status,
    m.code AS mapel_code,
    m.name AS mapel_name,
    st.code AS source_type,
    qs.label AS source_label,
    (ak.id IS NOT NULL) AS has_answer_key,
    (SELECT count(*) FROM question_options o WHERE o.question_id = q.id) AS option_count,
    (SELECT count(*) FROM question_version_readiness r
      WHERE r.question_id = q.id AND r.is_ready) AS ready_version_count,
    q.is_multi_version_ready,
    q.created_at,
    q.updated_at,
    (SELECT count(*) FROM question_statements s WHERE s.question_id = q.id) AS statement_count,
    (SELECT count(*) FROM question_statements s
      WHERE s.question_id = q.id AND s.is_correct) AS correct_statement_count
FROM questions q
JOIN mapels m ON m.id = q.mapel_id
LEFT JOIN question_sources qs ON qs.id = q.source_id
LEFT JOIN source_types st ON st.id = qs.type_id
LEFT JOIN answer_keys ak ON ak.question_id = q.id;

INSERT INTO mapels (code, name, description) VALUES
    ('MTKA', 'Matematika', 'Soal-soal matematika'),
    ('BIND', 'Bahasa Indonesia', 'Soal-soal Bahasa Indonesia'),
    ('IPAS', 'IPAS', 'Ilmu Pengetahuan Alam dan Sosial')
ON CONFLICT (code) DO NOTHING;

INSERT INTO source_types (code, name) VALUES
    ('manual', 'Input Manual'),
    ('file_upload', 'Upload File'),
    ('external_collection', 'Pengumpulan Eksternal')
ON CONFLICT (code) DO NOTHING;

INSERT INTO presentation_versions (code, name) VALUES
    ('v1', 'Versi 1'),
    ('v2', 'Versi 2'),
    ('v3', 'Versi 3')
ON CONFLICT (code) DO NOTHING;
