CREATE TABLE IF NOT EXISTS question_presentation_variants (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    version_id BIGINT NOT NULL REFERENCES presentation_versions(id) ON DELETE RESTRICT,
    stem TEXT NOT NULL,
    question_type VARCHAR(32) NOT NULL,
    difficulty VARCHAR(16) NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_key VARCHAR(8),
    answer_text TEXT,
    explanation TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (question_id, version_id)
);

DROP TRIGGER IF EXISTS trg_presentation_variants_updated_at ON question_presentation_variants;
CREATE TRIGGER trg_presentation_variants_updated_at
BEFORE UPDATE ON question_presentation_variants
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_presentation_variants_version
    ON question_presentation_variants (version_id);
CREATE INDEX IF NOT EXISTS idx_presentation_variants_question
    ON question_presentation_variants (question_id);

INSERT INTO question_presentation_variants (
    question_id, version_id, stem, question_type, difficulty,
    options, correct_key, answer_text, explanation, metadata
)
SELECT
    q.id,
    pv.id,
    q.stem,
    q.question_type,
    q.difficulty,
    COALESCE(opt.options, '[]'::jsonb),
    corr.option_key,
    ak.answer_text,
    ak.explanation,
    jsonb_build_object('generated_by', 'phase5_migration', 'version', pv.code)
FROM questions q
CROSS JOIN presentation_versions pv
LEFT JOIN LATERAL (
    SELECT jsonb_agg(
        jsonb_build_object(
            'key', o.option_key,
            'content', o.content,
            'is_correct', o.is_correct
        ) ORDER BY o.position
    ) AS options
    FROM question_options o
    WHERE o.question_id = q.id
) opt ON true
LEFT JOIN answer_keys ak ON ak.question_id = q.id
LEFT JOIN question_options corr ON corr.question_id = q.id AND corr.is_correct
WHERE pv.is_active
ON CONFLICT (question_id, version_id) DO NOTHING;
