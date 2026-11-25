ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS jenjang_id BIGINT;
ALTER TABLE public.question_sheets ADD COLUMN IF NOT EXISTS jenjang_id BIGINT;
ALTER TABLE public.tryout_events ADD COLUMN IF NOT EXISTS jenjang_id BIGINT;
ALTER TABLE public.program_belajar ADD COLUMN IF NOT EXISTS jenjang_id BIGINT;

DO $$
DECLARE
    v_jenjang_sd_id BIGINT;
BEGIN
    SELECT id INTO v_jenjang_sd_id FROM public.jenjang WHERE kode = 'SD';
    IF v_jenjang_sd_id IS NULL THEN
        RAISE EXCEPTION 'BE-46: jenjang SD belum tersedia; jalankan 031 terlebih dahulu';
    END IF;

    UPDATE public.questions SET jenjang_id = v_jenjang_sd_id WHERE jenjang_id IS NULL;
    UPDATE public.question_sheets SET jenjang_id = v_jenjang_sd_id WHERE jenjang_id IS NULL;
    UPDATE public.tryout_events SET jenjang_id = v_jenjang_sd_id WHERE jenjang_id IS NULL;
    UPDATE public.program_belajar SET jenjang_id = v_jenjang_sd_id WHERE jenjang_id IS NULL;
END $$;

ALTER TABLE public.questions ALTER COLUMN jenjang_id SET NOT NULL;
ALTER TABLE public.question_sheets ALTER COLUMN jenjang_id SET NOT NULL;
ALTER TABLE public.tryout_events ALTER COLUMN jenjang_id SET NOT NULL;
ALTER TABLE public.program_belajar ALTER COLUMN jenjang_id SET NOT NULL;

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_jenjang_id_fkey;
ALTER TABLE public.questions
    ADD CONSTRAINT questions_jenjang_id_fkey
    FOREIGN KEY (jenjang_id) REFERENCES public.jenjang(id) ON DELETE RESTRICT;
ALTER TABLE public.question_sheets DROP CONSTRAINT IF EXISTS question_sheets_jenjang_id_fkey;
ALTER TABLE public.question_sheets
    ADD CONSTRAINT question_sheets_jenjang_id_fkey
    FOREIGN KEY (jenjang_id) REFERENCES public.jenjang(id) ON DELETE RESTRICT;
ALTER TABLE public.tryout_events DROP CONSTRAINT IF EXISTS tryout_events_jenjang_id_fkey;
ALTER TABLE public.tryout_events
    ADD CONSTRAINT tryout_events_jenjang_id_fkey
    FOREIGN KEY (jenjang_id) REFERENCES public.jenjang(id) ON DELETE RESTRICT;
ALTER TABLE public.program_belajar DROP CONSTRAINT IF EXISTS program_belajar_jenjang_id_fkey;
ALTER TABLE public.program_belajar
    ADD CONSTRAINT program_belajar_jenjang_id_fkey
    FOREIGN KEY (jenjang_id) REFERENCES public.jenjang(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_questions_jenjang ON public.questions (jenjang_id);
CREATE INDEX IF NOT EXISTS idx_question_sheets_jenjang ON public.question_sheets (jenjang_id);
CREATE INDEX IF NOT EXISTS idx_tryout_events_jenjang ON public.tryout_events (jenjang_id);
CREATE INDEX IF NOT EXISTS idx_program_belajar_jenjang ON public.program_belajar (jenjang_id);

ALTER TABLE public.question_sheets DROP CONSTRAINT IF EXISTS question_sheets_code_format;
ALTER TABLE public.question_sheets ALTER COLUMN code TYPE VARCHAR(16);

UPDATE public.question_sheets sh
SET code = 'LS-' || m.code || '-SD-' || coalesce(
        substring(sh.code FROM '([0-9]{4})$'),
        to_char(sh.created_at AT TIME ZONE 'UTC', 'MMYY')
    )
FROM public.mapels m
WHERE m.id = sh.mapel_id
  AND sh.code !~ '^LS-[A-Z0-9]{4}-(SD|SMP|SMA)-[0-9]{4}$';

ALTER TABLE public.question_sheets
    ADD CONSTRAINT question_sheets_code_format
    CHECK (length(code) IN (15, 16) AND code ~ '^LS-[A-Z0-9]{4}-(SD|SMP|SMA)-[0-9]{4}$');

DROP VIEW IF EXISTS public.v_question_catalog;

CREATE VIEW public.v_question_catalog AS
SELECT
    q.id,
    q.stem,
    q.image_url,
    q.question_type,
    q.difficulty,
    q.status,
    m.code AS mapel_code,
    m.name AS mapel_name,
    j.kode AS jenjang_kode,
    j.nama AS jenjang_nama,
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
FROM public.questions q
JOIN public.mapels m ON m.id = q.mapel_id
JOIN public.jenjang j ON j.id = q.jenjang_id
LEFT JOIN public.question_sources qs ON qs.id = q.source_id
LEFT JOIN public.source_types st ON st.id = qs.type_id
LEFT JOIN public.answer_keys ak ON ak.question_id = q.id;

ALTER VIEW public.v_question_catalog OWNER TO bank_soal_user;
