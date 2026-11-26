-- Fase 6c: konfigurasi query riset agent dapat diubah dari CMS.
-- Tabel singleton; n8n mengambil query lewat endpoint terautentikasi, env hanya fallback.
-- Idempotent: aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS public.research_query_config (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    queries TEXT NOT NULL,
    mapel_code VARCHAR(4) NOT NULL REFERENCES public.mapels(code) ON UPDATE CASCADE ON DELETE RESTRICT,
    jenjang_kode VARCHAR(8) NOT NULL REFERENCES public.jenjang(kode) ON UPDATE CASCADE ON DELETE RESTRICT,
    max_questions INTEGER NOT NULL DEFAULT 3,
    updated_by BIGINT REFERENCES public.contributors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT research_query_config_queries_not_blank CHECK (length(btrim(queries)) > 0),
    CONSTRAINT research_query_config_max_questions_check CHECK (max_questions BETWEEN 1 AND 10)
);

ALTER TABLE public.research_query_config OWNER TO bank_soal_user;

DROP TRIGGER IF EXISTS trg_research_query_config_updated_at ON public.research_query_config;
CREATE TRIGGER trg_research_query_config_updated_at
    BEFORE UPDATE ON public.research_query_config
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.research_query_config
    (id, queries, mapel_code, jenjang_kode, max_questions)
VALUES
    (1, 'soal pilihan ganda kurikulum SD kelas 4 IPAS', 'IPAS', 'SD', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.permissions (code, description) VALUES
    ('research_queries.read', 'Baca konfigurasi query research agent'),
    ('research_queries.manage', 'Kelola konfigurasi query research agent')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'research_queries.read'
WHERE r.code IN ('research_agent', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'research_queries.manage'
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;
