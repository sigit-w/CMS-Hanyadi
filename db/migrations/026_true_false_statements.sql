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

ALTER TABLE question_statements OWNER TO bank_soal_user;
ALTER SEQUENCE question_statements_id_seq OWNER TO bank_soal_user;
ALTER TABLE submission_statement_answers OWNER TO bank_soal_user;
ALTER SEQUENCE submission_statement_answers_id_seq OWNER TO bank_soal_user;
ALTER VIEW v_question_catalog OWNER TO bank_soal_user;
