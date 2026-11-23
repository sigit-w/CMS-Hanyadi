DROP VIEW IF EXISTS v_question_catalog;

DO $$
BEGIN
    IF to_regclass('public.categories') IS NOT NULL THEN
        ALTER TABLE public.categories RENAME TO mapels;
    END IF;
END $$;

ALTER SEQUENCE IF EXISTS categories_id_seq RENAME TO mapels_id_seq;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conname = 'categories_pkey') THEN
        ALTER TABLE public.mapels RENAME CONSTRAINT categories_pkey TO mapels_pkey;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conname = 'categories_code_key') THEN
        ALTER TABLE public.mapels RENAME CONSTRAINT categories_code_key TO mapels_code_key;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conname = 'categories_code_check') THEN
        ALTER TABLE public.mapels RENAME CONSTRAINT categories_code_check TO mapels_code_check;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'category_id') THEN
        ALTER TABLE public.questions RENAME COLUMN category_id TO mapel_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'tryout_sessions' AND column_name = 'category_id') THEN
        ALTER TABLE public.tryout_sessions RENAME COLUMN category_id TO mapel_id;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conname = 'questions_category_id_fkey') THEN
        ALTER TABLE public.questions RENAME CONSTRAINT questions_category_id_fkey TO questions_mapel_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conname = 'tryout_sessions_category_id_fkey') THEN
        ALTER TABLE public.tryout_sessions RENAME CONSTRAINT tryout_sessions_category_id_fkey TO tryout_sessions_mapel_id_fkey;
    END IF;
END $$;

ALTER INDEX IF EXISTS idx_questions_category_status RENAME TO idx_questions_mapel_status;

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
    q.updated_at
FROM questions q
JOIN mapels m ON m.id = q.mapel_id
LEFT JOIN question_sources qs ON qs.id = q.source_id
LEFT JOIN source_types st ON st.id = qs.type_id
LEFT JOIN answer_keys ak ON ak.question_id = q.id;
