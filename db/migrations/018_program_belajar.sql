-- Program Belajar: data program, kelas, biaya, dan jadwal berulang.
-- Idempotent: aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS public.program_belajar (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    kelas INTEGER NOT NULL CHECK (kelas BETWEEN 1 AND 12),
    description TEXT,
    biaya NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (biaya >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT program_belajar_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.program_belajar_schedules (
    id BIGSERIAL PRIMARY KEY,
    program_id BIGINT NOT NULL REFERENCES public.program_belajar(id) ON DELETE CASCADE,
    day VARCHAR(10) NOT NULL CHECK (day IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT program_belajar_schedules_time_order CHECK (end_time > start_time),
    CONSTRAINT program_belajar_schedules_unique UNIQUE (program_id, day, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_program_belajar_schedules_program
    ON public.program_belajar_schedules (program_id, position);

DROP TRIGGER IF EXISTS trg_program_belajar_updated_at ON public.program_belajar;
CREATE TRIGGER trg_program_belajar_updated_at
BEFORE UPDATE ON public.program_belajar
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.permissions (code, description) VALUES
    ('program_belajar.manage', 'Kelola program belajar dan jadwalnya')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'program_belajar.manage'
WHERE r.code IN ('admin', 'editor')
ON CONFLICT DO NOTHING;
