-- Fase 6d: soft limit pemakaian Tavily/OpenAI untuk research agent.
-- Idempotent: aman dijalankan ulang.

ALTER TABLE public.research_query_config
    ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS max_searches INTEGER NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS max_results_per_query INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS max_output_tokens INTEGER NOT NULL DEFAULT 1200,
    ADD COLUMN IF NOT EXISTS max_runs_per_month INTEGER NOT NULL DEFAULT 25;

DO $do$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'research_query_config_max_searches_check'
    ) THEN
        ALTER TABLE public.research_query_config
            ADD CONSTRAINT research_query_config_max_searches_check
            CHECK (max_searches BETWEEN 1 AND 5);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'research_query_config_max_results_check'
    ) THEN
        ALTER TABLE public.research_query_config
            ADD CONSTRAINT research_query_config_max_results_check
            CHECK (max_results_per_query BETWEEN 1 AND 10);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'research_query_config_max_tokens_check'
    ) THEN
        ALTER TABLE public.research_query_config
            ADD CONSTRAINT research_query_config_max_tokens_check
            CHECK (max_output_tokens BETWEEN 300 AND 4000);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'research_query_config_max_runs_check'
    ) THEN
        ALTER TABLE public.research_query_config
            ADD CONSTRAINT research_query_config_max_runs_check
            CHECK (max_runs_per_month BETWEEN 1 AND 100);
    END IF;
END
$do$;

CREATE TABLE IF NOT EXISTS public.research_agent_usage (
    month DATE PRIMARY KEY,
    runs INTEGER NOT NULL DEFAULT 0,
    searches INTEGER NOT NULL DEFAULT 0,
    questions INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT research_agent_usage_month_first_day CHECK (date_trunc('month', month)::date = month),
    CONSTRAINT research_agent_usage_runs_nonnegative CHECK (runs >= 0),
    CONSTRAINT research_agent_usage_searches_nonnegative CHECK (searches >= 0),
    CONSTRAINT research_agent_usage_questions_nonnegative CHECK (questions >= 0)
);

ALTER TABLE public.research_agent_usage OWNER TO bank_soal_user;

DROP TRIGGER IF EXISTS trg_research_agent_usage_updated_at ON public.research_agent_usage;
CREATE TRIGGER trg_research_agent_usage_updated_at
    BEFORE UPDATE ON public.research_agent_usage
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
