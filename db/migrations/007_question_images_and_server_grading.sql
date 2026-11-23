ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE question_presentation_variants ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TABLE IF NOT EXISTS tryout_submissions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    version VARCHAR(16) NOT NULL,
    answer TEXT,
    is_correct BOOLEAN NOT NULL,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, question_id, version)
);

DROP TRIGGER IF EXISTS trg_tryout_submissions_updated_at ON tryout_submissions;
CREATE TRIGGER trg_tryout_submissions_updated_at
BEFORE UPDATE ON tryout_submissions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tryout_submissions_user_version
    ON tryout_submissions (user_id, version);
CREATE INDEX IF NOT EXISTS idx_tryout_submissions_question
    ON tryout_submissions (question_id);
