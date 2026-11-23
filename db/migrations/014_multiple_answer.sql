ALTER TABLE question_presentation_variants
  ADD COLUMN IF NOT EXISTS correct_keys JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE question_presentation_variants
SET correct_keys = jsonb_build_array(upper(btrim(correct_key)))
WHERE correct_keys = '[]'::jsonb
  AND correct_key IS NOT NULL
  AND btrim(correct_key) <> '';

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_question_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_question_type_check
  CHECK (question_type::text = ANY (ARRAY[
    'multiple_choice', 'true_false', 'multiple_answer', 'short_answer', 'essay'
  ]));
