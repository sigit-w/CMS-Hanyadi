CREATE TABLE IF NOT EXISTS public.question_sheets (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(12) NOT NULL UNIQUE,
    description TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    mapel_id BIGINT NOT NULL REFERENCES public.mapels(id) ON DELETE RESTRICT,
    archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    created_by BIGINT REFERENCES public.contributors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT question_sheets_code_format CHECK (length(code) = 12 AND code ~ '^[A-Z0-9-]{12}$'),
    CONSTRAINT question_sheets_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.question_sheet_questions (
    sheet_id BIGINT NOT NULL REFERENCES public.question_sheets(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (sheet_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_question_sheet_questions_question
    ON public.question_sheet_questions (question_id);
CREATE INDEX IF NOT EXISTS idx_question_sheets_mapel_archived
    ON public.question_sheets (mapel_id, archived);

DROP TRIGGER IF EXISTS trg_question_sheets_updated_at ON public.question_sheets;
CREATE TRIGGER trg_question_sheets_updated_at
BEFORE UPDATE ON public.question_sheets
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.permissions (code, description) VALUES
    ('question_sheets.manage', 'Buat, ubah, dan arsipkan lembar soal')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'question_sheets.manage'
WHERE r.code IN ('admin', 'editor')
ON CONFLICT DO NOTHING;
