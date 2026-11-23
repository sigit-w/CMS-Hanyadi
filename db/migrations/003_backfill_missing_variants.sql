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
    jsonb_build_object('generated_by', 'phase5_backfill', 'version', pv.code)
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
