-- Fase 6ab: antrean review soal hasil riset agent (n8n).
-- Draft tidak masuk ke tabel questions sebelum disetujui, sehingga gate publik
-- (question-sheet picker dan presentation service) tetap hanya melihat soal approved.
-- Idempotent: aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS public.research_submissions (
    id BIGSERIAL PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'need_review',
    source_system VARCHAR(32) NOT NULL DEFAULT 'n8n',
    external_ref VARCHAR(255),
    source_url TEXT,
    stem TEXT NOT NULL,
    mapel_id BIGINT NOT NULL REFERENCES public.mapels(id) ON DELETE RESTRICT,
    jenjang_id BIGINT NOT NULL REFERENCES public.jenjang(id) ON DELETE RESTRICT,
    question_type VARCHAR(24) NOT NULL DEFAULT 'multiple_choice',
    payload JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by BIGINT REFERENCES public.contributors(id) ON DELETE SET NULL,
    reviewed_by BIGINT REFERENCES public.contributors(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    decision_note TEXT,
    question_id BIGINT UNIQUE REFERENCES public.questions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT research_submissions_status_check
        CHECK (status IN ('need_review', 'approved', 'rejected')),
    CONSTRAINT research_submissions_question_type_check
        CHECK (question_type IN
            ('multiple_choice', 'true_false', 'multiple_answer', 'short_answer', 'essay')),
    CONSTRAINT research_submissions_stem_not_blank CHECK (length(btrim(stem)) > 0),
    CONSTRAINT research_submissions_payload_object CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT research_submissions_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

ALTER TABLE public.research_submissions OWNER TO bank_soal_user;
ALTER SEQUENCE IF EXISTS public.research_submissions_id_seq OWNER TO bank_soal_user;

CREATE INDEX IF NOT EXISTS idx_research_submissions_status_created
    ON public.research_submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_submissions_mapel_jenjang
    ON public.research_submissions (mapel_id, jenjang_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_research_submissions_source_ref
    ON public.research_submissions (source_system, external_ref)
    WHERE external_ref IS NOT NULL;

DROP TRIGGER IF EXISTS trg_research_submissions_updated_at ON public.research_submissions;
CREATE TRIGGER trg_research_submissions_updated_at
    BEFORE UPDATE ON public.research_submissions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.permissions (code, description) VALUES
    ('research_submissions.create', 'Buat draft soal hasil riset agent')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.roles (code, name, description, is_system) VALUES
    ('research_agent', 'Research Agent', 'Agent riset yang mengirim draft soal', true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = true;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'research_submissions.create'
WHERE r.code IN ('research_agent', 'admin')
ON CONFLICT DO NOTHING;
